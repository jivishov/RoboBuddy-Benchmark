import {readFile} from 'node:fs/promises';
import {validateBundle,FILES,LIMITS} from '../src/core.js';
import {TOOL_DEFINITIONS} from '../src/webmcp.js';
const catalog=JSON.parse(await readFile('dist/data/catalog.json','utf8'));
const schema=TOOL_DEFINITIONS.find(t=>t.name==='stage_robotic_task').inputSchema.properties.bundle;
for(const task of catalog.tasks){
  const bundle=JSON.parse(await readFile(`dist/data/references/${task.id}.json`,'utf8'));
  validateBundle(bundle,{spec:{track:'prompt'}});
  for(const file of FILES){
    if(schema.properties.files.properties[file].maxLength!==LIMITS.fileBytes)throw new Error('WebMCP and UI file limits diverged.');
  }
  validateBundle({...bundle,files:catalog.starters[task.id]},{spec:{track:'prompt'}});
}
console.log(`Verified all ${catalog.tasks.length} reference and starter bundles against the same visible-control and WebMCP size/schema limits.`);
