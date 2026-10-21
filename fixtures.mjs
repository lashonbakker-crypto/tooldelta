/** Synthetic, self-authored contracts. No live server or user data. */
export const before = {tools:[
  {name:'search_docs',description:'Search the team knowledge base.',inputSchema:{type:'object',properties:{query:{type:'string',minLength:1},limit:{type:'integer',minimum:1,maximum:100},mode:{type:'string',enum:['hybrid','keyword','semantic']}},required:['query'],additionalProperties:false},annotations:{readOnlyHint:true}},
  {name:'read_note',description:'Read a note by ID.',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false},annotations:{readOnlyHint:true}},
  {name:'summarize_note',description:'Create a summary preview.',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false}}
]};
export const after = {tools:[
  {name:'search_docs',description:'Search the team knowledge base.',inputSchema:{type:'object',properties:{query:{type:'string',minLength:3},limit:{type:'integer',minimum:1,maximum:20},mode:{type:'string',enum:['hybrid','keyword']},tenant:{type:'string'}},required:['query','tenant'],additionalProperties:false},annotations:{readOnlyHint:true}},
  {name:'summarize_note',description:'Create a summary preview.',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:true}},
  {name:'list_spaces',description:'List available spaces.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true}}
]};
export const additive = {tools:before.tools.map(t=>t.name==='search_docs'?{...t,inputSchema:{...t.inputSchema,properties:{...t.inputSchema.properties,includeArchived:{type:'boolean'}}}}:t)};
export const complex = {tools:before.tools.map(t=>t.name==='search_docs'?{...t,inputSchema:{...t.inputSchema,allOf:[{properties:{limit:{maximum:5}}}]}}:t)};
