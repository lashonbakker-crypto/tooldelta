/** ToolDelta's shared, dependency-free browser/CLI analysis engine. */
export const VERSION = '0.1.0';
export const MAX_BYTES = 2 * 1024 * 1024;
const own = (o, k) => Object.hasOwn(o, k);
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const define = (o, k, v) => Object.defineProperty(o, k, {value:v, enumerable:true, configurable:true, writable:true});
const copy = v => JSON.parse(JSON.stringify(v));
const ordered = a => [...a].sort();
export const canonical = v => Array.isArray(v) ? '['+v.map(canonical).join(',')+']' : object(v) ? '{'+ordered(Object.keys(v)).map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}' : JSON.stringify(v);
const equal = (a,b) => canonical(a) === canonical(b);
const ptr = parts => '/' + parts.map(v=>String(v).replaceAll('~','~0').replaceAll('/','~1')).join('/');
const types = ['null','boolean','object','array','number','integer','string'];
const meta = new Set(['title','description','default','examples','$comment','deprecated','readOnly','writeOnly']);
const supported = new Set(['type','properties','required','additionalProperties','items','enum','const','minimum','maximum','exclusiveMinimum','exclusiveMaximum','minLength','maxLength','minItems','maxItems','uniqueItems','minProperties','maxProperties',...meta]);
const counts = ['minLength','maxLength','minItems','maxItems','minProperties','maxProperties'];
const numbers = ['minimum','maximum','exclusiveMinimum','exclusiveMaximum'];
const NO = Symbol('no candidate');

/** A bounded JSON parser: duplicate keys, unsafe integers and nonfinite values fail. */
export function parseSnapshot(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('Snapshot must be UTF-8 JSON at most 2 MiB.');
  let i=0, nodes=0;
  const fail = () => {throw new Error(`Invalid or ambiguous JSON at character ${i+1}.`);};
  const ws = () => {while (/[\t\r\n ]/.test(text[i]??'x')) i++;};
  function value(depth) {
    if(depth>40 || ++nodes>20000) throw new Error('Snapshot exceeds the depth/node limit (40 / 20000).');
    ws(); const c=text[i];
    if(c==='"') {
      const start=i++; let closed=false;
      while(i<text.length) {if(text[i]==='\\'){i+=2;continue;} if(text[i++]==='"'){closed=true;break;}}
      if(!closed) fail();
      try{return JSON.parse(text.slice(start,i));}catch{fail();}
    }
    if(c==='{' || c==='[') {
      i++; ws(); const obj=c==='{'?Object.create(null):[], end=c==='{'?'}':']';
      if(text[i]===end){i++;return obj;}
      while(i<text.length) {
        if(c==='{') {
          if(text[i]!=='"') fail(); const key=value(depth+1); ws();
          if(text[i++]!==':' || own(obj,key)) fail();
          define(obj,key,value(depth+1));
        } else obj.push(value(depth+1));
        ws(); if(text[i]===end){i++;return obj;} if(text[i++]!==',') fail(); ws();
      }
      fail();
    }
    for(const [s,v] of [['true',true],['false',false],['null',null]]) if(text.startsWith(s,i)){i+=s.length;return v;}
    const match=/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(text.slice(i));
    if(!match) fail(); i+=match[0].length; const n=Number(match[0]);
    if(!Number.isFinite(n) || (Number.isInteger(n)&&!Number.isSafeInteger(n))) throw new Error('Numbers must be finite and integer values must be within the JavaScript safe-integer range.');
    return n;
  }
  const data=value(0); ws(); if(i!==text.length) fail(); return data;
}

function budget() {let left=250000;return ()=>{if(--left<0) throw new Error('Analysis work limit exceeded; no complete report was produced.');};}

function inspectSchema(s, at, unknown, tick, depth=0) {
  tick(); if(depth>32) throw new Error('Schema nesting exceeds 32 levels.');
  if(typeof s==='boolean') return;
  if(!object(s)) throw new Error(`Expected a schema object or boolean at ${at}.`);
  for(const key of Object.keys(s)) if(!supported.has(key)) {
    if(key==='$schema' && s[key]==='https://json-schema.org/draft/2020-12/schema') continue;
    unknown.push(at+'/'+key);
  }
  if(own(s,'type')) {const t=Array.isArray(s.type)?s.type:[s.type];if(!t.length || t.some(x=>!types.includes(x)) || new Set(t).size!==t.length) throw new Error(`Invalid type at ${at}.`);}
  if(own(s,'properties')) {
    if(!object(s.properties)) throw new Error(`properties must be an object at ${at}.`);
    for(const [key,child] of Object.entries(s.properties)) inspectSchema(child,at+'/properties/'+key,unknown,tick,depth+1);
  }
  if(own(s,'required') && (!Array.isArray(s.required)||s.required.some(k=>typeof k!=='string')||new Set(s.required).size!==s.required.length)) throw new Error(`Invalid required list at ${at}.`);
  if(own(s,'enum') && (!Array.isArray(s.enum)||!s.enum.length||new Set(s.enum.map(canonical)).size!==s.enum.length)) throw new Error(`Invalid enum at ${at}.`);
  for(const key of counts) if(own(s,key) && (!Number.isSafeInteger(s[key])||s[key]<0)) throw new Error(`Invalid ${key} at ${at}.`);
  for(const key of numbers) if(own(s,key)&&typeof s[key]!=='number') throw new Error(`Invalid ${key} at ${at}.`);
  if(own(s,'uniqueItems')&&typeof s.uniqueItems!=='boolean') throw new Error(`Invalid uniqueItems at ${at}.`);
  for(const key of ['items','additionalProperties']) if(own(s,key)) inspectSchema(s[key],at+'/'+key,unknown,tick,depth+1);
}

function normalize(data,tick) {
  const result=object(data)&&own(data,'result')?data.result:data;
  if(object(result)&&own(result,'nextCursor')&&result.nextCursor!==undefined&&result.nextCursor!==null&&result.nextCursor!=='') throw new Error('Paginated tools/list snapshot is incomplete. Merge all pages and remove nextCursor first.');
  const tools=Array.isArray(result)?result:result?.tools;
  if(!Array.isArray(tools)||tools.length>200) throw new Error('Expected a tool array, {tools:[...]} or {result:{tools:[...]}}; maximum 200 tools.');
  const map=new Map();
  for(const tool of tools) {
    tick(); if(!object(tool)||typeof tool.name!=='string'||!tool.name.trim()||tool.name.length>128) throw new Error('Each tool needs a nonempty name of at most 128 characters.');
    if(map.has(tool.name)) throw new Error('Duplicate tool names are ambiguous.');
    if(!object(tool.inputSchema)||tool.inputSchema.type!=='object') throw new Error(`Tool ${JSON.stringify(tool.name)} needs inputSchema with type "object".`);
    const unknown=[]; inspectSchema(tool.inputSchema,'/inputSchema',unknown,tick);
    if(own(tool,'annotations')&&!object(tool.annotations)) throw new Error('annotations must be an object.');
    for(const key of ['readOnlyHint','destructiveHint','idempotentHint','openWorldHint']) if(own(tool.annotations??{},key)&&typeof tool.annotations[key]!=='boolean') throw new Error(`${key} must be boolean.`);
    map.set(tool.name,{tool,unknown});
  }
  return map;
}

const matchesType = (value,type) => type==='null'?value===null:type==='array'?Array.isArray(value):type==='object'?object(value):type==='integer'?Number.isInteger(value):type==='number'?typeof value==='number':typeof value===type;
function validate(s,v,tick) {
  tick(); if(typeof s==='boolean') return s;
  if(own(s,'type') && !(Array.isArray(s.type)?s.type:[s.type]).some(t=>matchesType(v,t))) return false;
  if(own(s,'enum')&&!s.enum.some(x=>equal(x,v))) return false;
  if(own(s,'const')&&!equal(s.const,v)) return false;
  if(typeof v==='number') {
    if(own(s,'minimum')&&v<s.minimum || own(s,'maximum')&&v>s.maximum || own(s,'exclusiveMinimum')&&v<=s.exclusiveMinimum || own(s,'exclusiveMaximum')&&v>=s.exclusiveMaximum) return false;
  }
  if(typeof v==='string') {const n=[...v].length;if(own(s,'minLength')&&n<s.minLength || own(s,'maxLength')&&n>s.maxLength) return false;}
  if(Array.isArray(v)) {
    if(own(s,'minItems')&&v.length<s.minItems || own(s,'maxItems')&&v.length>s.maxItems) return false;
    if(s.uniqueItems&&new Set(v.map(canonical)).size!==v.length) return false;
    if(own(s,'items')&&v.some(x=>!validate(s.items,x,tick))) return false;
  }
  if(object(v)) {
    if((s.required??[]).some(k=>!own(v,k))) return false;
    const keys=Object.keys(v);if(own(s,'minProperties')&&keys.length<s.minProperties || own(s,'maxProperties')&&keys.length>s.maxProperties) return false;
    for(const key of keys) if(!validate(own(s.properties??{},key)?s.properties[key]:(s.additionalProperties??true),v[key],tick)) return false;
  }
  return true;
}

function sample(s,tick,depth=0) {
  tick(); if(depth>32||s===false) return NO; if(s===true) return null;
  if(own(s,'const')) return validate(s,s.const,tick)?copy(s.const):NO;
  if(own(s,'enum')) {for(const v of s.enum) if(validate(s,v,tick)) return copy(v);return NO;}
  for(const type of own(s,'type')?(Array.isArray(s.type)?s.type:[s.type]):['object','string','number','null','boolean','array']) {
    let v=NO;
    if(type==='null') v=null;
    if(type==='boolean') v=false;
    if(type==='number'||type==='integer') {
      for(let x of [0,1,-1,0.5,s.minimum,s.maximum,s.exclusiveMinimum!==undefined?s.exclusiveMinimum+1:undefined,s.exclusiveMaximum!==undefined?s.exclusiveMaximum-1:undefined]) {
        if(x===undefined||!Number.isFinite(x)) continue; if(type==='integer') x=Math.ceil(x);
        if(validate(s,x,tick)){v=x;break;}
      }
    }
    if(type==='string') {const n=s.minLength??Math.min(s.maxLength??7,7);if(n<=64) v='x'.repeat(n);}
    if(type==='array'&&(s.minItems??0)<=16) {
      v=[]; for(let i=0;i<(s.minItems??0);i++){const child=sample(s.items??true,tick,depth+1);if(child===NO){v=NO;break;}v.push(child);}
    }
    if(type==='object'&&(s.minProperties??0)<=32&&(s.required??[]).length<=32) {
      v=Object.create(null);
      for(const key of s.required??[]) {const child=sample(own(s.properties??{},key)?s.properties[key]:(s.additionalProperties??true),tick,depth+1);if(child===NO){v=NO;break;}define(v,key,child);}
      if(v!==NO) for(const key of ordered(Object.keys(s.properties??{}))) {
        if(Object.keys(v).length>=(s.minProperties??0)) break;
        if(!own(v,key)){const child=sample(s.properties[key],tick,depth+1);if(child!==NO) define(v,key,child);}
      }
      let i=0;
      while(v!==NO&&Object.keys(v).length<(s.minProperties??0)) {const key='extra'+i++;if(own(v,key))continue;const child=sample(s.additionalProperties??true,tick,depth+1);if(child===NO){v=NO;break;}define(v,key,child);}
    }
    if(v!==NO&&validate(s,v,tick)) return v;
  }
  return NO;
}

function schemaAt(s,path) {for(const key of path){if(!object(s))return true;s=typeof key==='number'?(s.items??true):(own(s.properties??{},key)?s.properties[key]:(s.additionalProperties??true));}return s;}
function dataAt(data,path) {for(const key of path){if((!object(data)&&!Array.isArray(data))||!own(data,key))return NO;data=data[key];}return data;}
function demonstrates(f,s,args,tick) {
  if(f.code==='TOOL_REMOVED')return true;
  const v=dataAt(args,f.dataPath??[]);if(v===NO)return false;
  if(f.code==='REQUIRED_ADDED')return object(v)&&!own(v,f.after);
  if(f.code==='PROPERTY_REMOVED')return true;
  if(f.code==='EXTRA_PROPERTIES_CHANGED')return object(v)&&Object.keys(v).some(k=>!own(schemaAt(s,f.dataPath??[]).properties??{},k));
  const keyword=f.path.split('/').at(-1);
  if(['type','enum','const','uniqueItems',...numbers,...counts].includes(keyword))return !validate({[keyword]:f.after},v,tick);
  return !validate(schemaAt(s,f.dataPath??[]),v,tick);
}
function changedValue(base,path,value) {
  if(!path.length)return copy(value); const result=copy(base);let at=result;
  for(let i=0;i<path.length-1;i++){const key=path[i];if(!object(at)&&!Array.isArray(at))return NO;if(!own(at,key)||(!object(at[key])&&!Array.isArray(at[key]))) define(at,key,typeof path[i+1]==='number'?[]:Object.create(null));at=at[key];}
  if(!object(at)&&!Array.isArray(at))return NO;define(at,path.at(-1),copy(value));return result;
}

function witness(before,after,finding,tick) {
  if(before.unknown.length||after?.unknown.length) return null;
  const s=before.tool.inputSchema, base=sample(s,tick);if(base===NO) return null;
  const candidates=[base], sub=schemaAt(s,finding.dataPath??[]);
  let values=[...(object(sub)&&Array.isArray(sub.enum)?sub.enum:[]),...(object(sub)&&own(sub,'const')?[sub.const]:[]),finding.before,0,1,-1,0.5,'','x','example',null,true,false,[],{},[null,null],['x','x'],[0,0]];
  if(object(sub)) {const value=sample(sub,tick);if(value!==NO)values.unshift(value);for(const k of numbers) if(own(sub,k))values.push(sub[k],sub[k]+1,sub[k]-1);}
  if(typeof finding.after==='number') {
    values.push(finding.after-1,finding.after,finding.after+1);
    for(const n of [finding.after-1,finding.after+1])if(Number.isSafeInteger(n)&&n>=0&&n<=64)values.push('x'.repeat(n),Array(n).fill(null));
  }
  for(const value of values.slice(0,64)) if(value!==undefined) {const v=changedValue(base,finding.dataPath??[],value);if(v!==NO)candidates.push(v);}
  for(const args of candidates) if(object(args)&&validate(s,args,tick)&&(!after||(!validate(after.tool.inputSchema,args,tick)&&demonstrates(finding,after.tool.inputSchema,args,tick)))) return {arguments:args,before:'accepted by input schema',after:after?'rejected by input schema':'tool absent from new snapshot',verified:true};
  return null;
}

/** Static drift analysis, not a full JSON Schema compatibility decision. */
export function compareSnapshots(oldData,newData) {
  const tick=budget(), before=normalize(oldData,tick),after=normalize(newData,tick), findings=[];
  function add(tool,severity,code,path,message,a,b,dataPath=[]) {
    tick();if(findings.length>=1000)throw new Error('More than 1000 findings; narrow the snapshots.');
    const f={tool,severity,code,path,message,dataPath};if(a!==undefined)f.before=a;if(b!==undefined)f.after=b;findings.push(f);
  }
  function diff(name,a,b,path,dataPath) {
    tick();if(equal(a,b))return;
    if(typeof a==='boolean'||typeof b==='boolean') {add(name,b===true||a===false?'info':'risk','BOOLEAN_SCHEMA_CHANGED',path,'Boolean schema changed.',a,b,dataPath);return;}
    const at=new Set(own(a,'type')?(Array.isArray(a.type)?a.type:[a.type]):types),bt=new Set(own(b,'type')?(Array.isArray(b.type)?b.type:[b.type]):types);
    const lost=[...at].filter(t=>!bt.has(t)&&!(t==='integer'&&bt.has('number')));
    if(!equal(ordered(at),ordered(bt)))add(name,lost.length?'risk':'info','TYPE_CHANGED',path+'/type','Accepted input types changed.',[...at],[...bt],dataPath);
    for(const key of b.required??[])if(!(a.required??[]).includes(key))add(name,'risk','REQUIRED_ADDED',path+'/required','A caller must now provide '+JSON.stringify(key)+'.',false,key,dataPath);
    for(const key of a.required??[])if(!(b.required??[]).includes(key))add(name,'info','REQUIRED_RELAXED',path+'/required','An argument is no longer required.',key,false,dataPath);
    for(const key of [...numbers,...counts]) if(!equal(a[key],b[key]) && !(key.startsWith('min')&&counts.includes(key)&&(a[key]??0)===(b[key]??0))) {
      const lower=key.startsWith('min')||key==='exclusiveMinimum',tight=own(b,key)&&(!own(a,key)||(lower?b[key]>a[key]:b[key]<a[key]));
      add(name,tight?'risk':'info','BOUND_CHANGED',path+'/'+key,key+' changed.',a[key],b[key],dataPath);
    }
    if(!equal(a.enum?.map(canonical).sort(),b.enum?.map(canonical).sort())) {const removed=own(b,'enum')&&(!own(a,'enum')||a.enum.some(v=>!b.enum.some(w=>equal(v,w))));add(name,removed?'risk':'info','ENUM_CHANGED',path+'/enum','Allowed enum values changed.',a.enum,b.enum,dataPath);}
    if(!equal(a.const,b.const))add(name,own(b,'const')?'risk':'info','CONST_CHANGED',path+'/const','Constant-value constraint changed.',a.const,b.const,dataPath);
    if(!equal(a.uniqueItems,b.uniqueItems))add(name,b.uniqueItems?'risk':'info','UNIQUE_ITEMS_CHANGED',path+'/uniqueItems','Array uniqueness changed.',a.uniqueItems,b.uniqueItems,dataPath);
    const extraA=a.additionalProperties??true,extraB=b.additionalProperties??true;
    if(!equal(extraA,extraB))add(name,extraB===false?'risk':extraB===true?'info':'review','EXTRA_PROPERTIES_CHANGED',path+'/additionalProperties','Handling of undeclared arguments changed.',extraA,extraB,dataPath);
    const ap=a.properties??{},bp=b.properties??{};
    for(const key of ordered(new Set([...Object.keys(ap),...Object.keys(bp)]))) {
      const p=path+'/properties/'+ptr([key]).slice(1),d=[...dataPath,key];
      if(!own(ap,key)){add(name,'info','PROPERTY_ADDED',p,'Argument definition added.',undefined,bp[key],d);diff(name,extraA,bp[key],p,d);}
      else if(!own(bp,key)){add(name,extraB===false?'risk':'info','PROPERTY_REMOVED',p,'Argument definition removed.',ap[key],undefined,d);if(object(extraB))diff(name,ap[key],extraB,p,d);}
      else diff(name,ap[key],bp[key],p,d);
    }
    if(!equal(a.items,b.items))diff(name,a.items??true,b.items??true,path+'/items',[...dataPath,0]);
    for(const key of meta)if(!equal(a[key],b[key]))add(name,key==='description'?'review':'info','SCHEMA_METADATA_CHANGED',path+'/'+key,'Schema '+key+' changed; model routing may need review.',a[key],b[key],dataPath);
    for(const key of ordered(new Set([...Object.keys(a),...Object.keys(b)])))if(!supported.has(key)&&!equal(a[key],b[key]))add(name,'review','UNSUPPORTED_SCHEMA_CHANGED',path+'/'+key,'This keyword needs manual semantic review.',a[key],b[key],dataPath);
  }
  for(const name of ordered(new Set([...before.keys(),...after.keys()]))) {
    const a=before.get(name),b=after.get(name);
    if(!a){add(name,'info','TOOL_ADDED','/tools','Tool added.');continue;}
    if(!b){add(name,'risk','TOOL_REMOVED','/tools','Existing callers can no longer find this tool.');continue;}
    if(!equal(a.tool.inputSchema,b.tool.inputSchema)) {
      diff(name,a.tool.inputSchema,b.tool.inputSchema,'/inputSchema',[]);
      if(a.unknown.length||b.unknown.length)add(name,'review','PARTIAL_SCHEMA_ANALYSIS','/inputSchema','Complex/unknown keywords prevent full validation and verified examples.',a.unknown,b.unknown);
    }
    for(const key of ordered(new Set([...Object.keys(a.tool),...Object.keys(b.tool)]))) {
      if(key==='name'||key==='inputSchema'||equal(a.tool[key],b.tool[key]))continue;
      add(name,key==='title'||key==='icons'?'info':'review',key==='annotations'?'ANNOTATIONS_CHANGED':'TOOL_METADATA_CHANGED','/'+key,key==='annotations'?'Advisory tool hints changed; review permissions and behavior.':'Tool '+key+' changed; review downstream behavior.',a.tool[key],b.tool[key]);
    }
  }
  for(const f of findings) if(f.severity==='risk') f.witness=witness(before.get(f.tool),after.get(f.tool),f,tick);
  const summary={toolsBefore:before.size,toolsAfter:after.size,risks:findings.filter(f=>f.severity==='risk').length,verified:new Set(findings.filter(f=>f.witness).map(f=>canonical({name:f.tool,arguments:f.witness.arguments}))).size,review:findings.filter(f=>f.severity==='review').length,info:findings.filter(f=>f.severity==='info').length,changedTools:new Set(findings.map(f=>f.tool)).size};
  return {schema:'tooldelta-report-v1',version:VERSION,status:summary.risks?'breaking-risk':summary.review?'needs-review':findings.length?'changes-found':'unchanged',summary,findings,limits:'Static input-schema comparison; complex keywords require review. Verified examples use the documented subset validator, not a live MCP server. No compatibility or security guarantee.'};
}

const md = v => String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('|','&#124;').replaceAll('`','&#96;').replace(/[\r\n]/g,' ');
export function toMarkdown(report) {
  let out=`# ToolDelta report\n\n**${report.status}** · ${report.summary.risks} risk findings · ${report.summary.verified} verified examples · ${report.summary.review} review findings\n\n${report.limits}\n\n`;
  for(const f of report.findings){out+=`## ${md(f.tool)} — ${md(f.code)}\n\n${md(f.message)}\n\nPath: \`${md(f.path)}\` · ${f.severity}\n\n`;if(f.witness)out+='Old schema accepts; new schema rejects (or tool is absent):\n\n```json\n'+JSON.stringify({name:f.tool,arguments:f.witness.arguments},null,2)+'\n```\n\n';}
  if(!report.findings.length)out+='No tool-definition drift found in these snapshots.\n';return out;
}

const escape = v => String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
export function toHTML(report) {
  return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><title>ToolDelta report</title><style>body{max-width:900px;margin:50px auto;padding:20px;background:#10141b;color:#e4e9f2;font:16px system-ui}article{padding:22px;border:1px solid #394153;border-radius:12px;margin:16px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#070b12;padding:18px}h1{color:#b2f1da}small{color:#abb8ce}</style><h1>ToolDelta / '+escape(report.status)+'</h1><p>'+escape(report.limits)+'</p><p>'+report.summary.risks+' risk findings · '+report.summary.verified+' verified examples · '+report.summary.review+' review findings</p>'+report.findings.map(f=>'<article><small>'+escape(f.severity)+' / '+escape(f.code)+'</small><h2>'+escape(f.tool)+'</h2><p>'+escape(f.message)+'</p><code>'+escape(f.path)+'</code>'+(f.witness?'<details open><summary>Old schema accepts → new schema rejects / tool absent</summary><pre>'+escape(JSON.stringify({name:f.tool,arguments:f.witness.arguments},null,2))+'</pre></details>':'')+'</article>').join('')+'</html>';
}
