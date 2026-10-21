#!/usr/bin/env node
import {open} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {MAX_BYTES,VERSION,compareSnapshots,parseSnapshot,toHTML,toMarkdown} from './core.mjs';

async function readSnapshot(path) {
  const file=await open(path,'r');
  try {if(!(await file.stat()).isFile())throw new Error('Snapshot input must be a regular file.');const buffer=Buffer.alloc(MAX_BYTES+1);let used=0;while(used<buffer.length){const {bytesRead}=await file.read(buffer,used,buffer.length-used,null);if(!bytesRead)break;used+=bytesRead;}if(used>MAX_BYTES)throw new Error('Snapshot exceeds 2 MiB.');return parseSnapshot(new TextDecoder('utf-8',{fatal:true}).decode(buffer.subarray(0,used)));} finally {await file.close();}
}

export async function main(args=process.argv.slice(2)) {
  if(args.length===1&&args[0]==='--version'){console.log('ToolDelta '+VERSION);return 0;}
  if(args.length===1&&args[0]==='--help'){console.log('Usage: node tooldelta.mjs BEFORE.json AFTER.json [--format text|json|markdown|html] [--fail-on risk|review|none]\n\nDefault: text output, fail on risk. Exit 0: no gated findings; 1: gated findings; 2: invalid input or analysis failure.\nReads local files only. No MCP connections, tool execution, models, or telemetry.');return 0;}
  try {
    let format='text',failOn='risk';const files=[];
    for(let i=0;i<args.length;i++) {if(args[i]==='--format'){format=args[++i];}else if(args[i]==='--fail-on'){failOn=args[++i];}else if(args[i].startsWith('-'))throw new Error('Unknown option; use --help.');else files.push(args[i]);}
    if(files.length!==2||!['text','json','markdown','html'].includes(format)||!['risk','review','none'].includes(failOn))throw new Error('Expected two paths and valid options; use --help.');
    const [a,b]=await Promise.all(files.map(readSnapshot));const report=compareSnapshots(a,b);
    if(format==='json')console.log(JSON.stringify(report,null,2));else if(format==='markdown')console.log(toMarkdown(report));else if(format==='html')console.log(toHTML(report));else {
      console.log(`ToolDelta ${VERSION} · ${report.status}\n${report.summary.toolsBefore} → ${report.summary.toolsAfter} tools · ${report.summary.risks} risks · ${report.summary.verified} verified examples · ${report.summary.review} need review\n`);
      for(const f of report.findings)console.log(`[${f.severity}] ${JSON.stringify(f.tool)} ${f.code} ${JSON.stringify(f.path)}${f.witness?' — verified example':''}`);
      console.log('\n'+report.limits);
    }
    return failOn!=='none'&&(report.summary.risks||(failOn==='review'&&report.summary.review))?1:0;
  } catch(error) {console.error('ToolDelta: '+(error instanceof Error?error.message:'analysis failed'));return 2;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)process.exitCode=await main();
