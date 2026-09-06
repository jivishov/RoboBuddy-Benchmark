export const VERSION = '1.0.0';
export const IDE_REV = 'e87940e17271daff0390f6d38cbd4a27ddf18b48';
export const LAB_REV = 'e66472f898a6a5fb12d85f3f1d1f64ad10e48259';
export const FILES = ['main.py', 'trajectories.py', 'robot_config.py', 'workcell.py'];
export const LIMITS = Object.freeze({ fileBytes: 128000, bundleBytes: 160000, assets: 12, workflowNodes: 100, attempts: 5, events: 3000, seconds: 120 });
export class BenchError extends Error { constructor(code, message) { super(message); this.code = code; } }
export function requireThat(condition, code, message) { if (!condition) throw new BenchError(code, message); }
export function isObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
export const clone = (v) => structuredClone(v);
export function freeze(v) { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
export function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (isObject(v)) return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
export async function digest(v) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(stable(v))))).map(x => x.toString(16).padStart(2,'0')).join(''); }
export function strict(v, keys, where) { requireThat(isObject(v), 'INVALID_INPUT', `${where} must be an object.`); for (const k of Object.keys(v)) requireThat(keys.includes(k), 'INVALID_INPUT', `${where}: unknown field ${k}.`); }
export function text(v, min, max, where) { requireThat(typeof v === 'string' && v.trim().length >= min && v.length <= max, 'INVALID_INPUT', `${where} must contain ${min}–${max} characters.`); return v; }
export function boundedJSON(raw, max = LIMITS.bundleBytes) {
  requireThat(typeof raw === 'string' && new TextEncoder().encode(raw).length <= max, 'TOO_LARGE', `JSON is limited to ${max} bytes.`);
  let parsed; try { parsed = JSON.parse(raw); } catch { throw new BenchError('INVALID_JSON', 'Invalid JSON. Check quotation marks, commas, and brackets.'); }
  const visit = (v, depth = 0) => { requireThat(depth <= 30, 'TOO_DEEP', 'JSON nesting is too deep.'); if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { requireThat(!['__proto__','prototype','constructor'].includes(k), 'UNSAFE_KEY', `Forbidden key: ${k}`); visit(x, depth+1); } };
  visit(parsed); return parsed;
}
export function normalizeWorkflow(input, provenance = 'uploaded Lab Studio JSON') {
  requireThat(isObject(input) && isObject(input.process), 'INVALID_WORKFLOW', 'Import a Lab Studio lab or technique JSON with process.nodes and process.edges.');
  requireThat(!input.techniqueRefs?.length, 'UNRESOLVED_WORKFLOW', 'This library source contains unresolved techniqueRefs. Open it in Lab Studio and export the self-contained lab first.');
  const { nodes, edges, startNodeId } = input.process;
  requireThat(Array.isArray(nodes) && nodes.length > 0 && nodes.length <= LIMITS.workflowNodes && Array.isArray(edges) && edges.length <= 250, 'INVALID_WORKFLOW', 'Workflow must contain 1–100 nodes and at most 250 edges.');
  const ids = new Set();
  const steps = nodes.map(n => { text(n.id,1,100,'Node id'); requireThat(!ids.has(n.id),'INVALID_WORKFLOW',`Duplicate node ${n.id}.`); ids.add(n.id); return { id:n.id, type:text(n.type || 'instruction',1,50,'Node type'), title:text(n.title || n.id,1,240,'Node title'), description:String(n.description || '').slice(0,2500), actionId:n.actionId || null }; });
  requireThat(ids.has(startNodeId), 'INVALID_WORKFLOW', 'Workflow startNodeId must refer to a node.');
  const links = edges.map(e => { requireThat(ids.has(e.from) && ids.has(e.to), 'INVALID_WORKFLOW','Every edge must refer to existing nodes.'); return {from:e.from,to:e.to,label:String(e.label || '').slice(0,200),condition:clone(e.condition || {type:'always'})}; });
  const seen = new Set([startNodeId]); let changed = true; while(changed) {changed=false; for(const e of links) if(seen.has(e.from)&&!seen.has(e.to)){seen.add(e.to); changed=true;}}
  requireThat(seen.size === ids.size,'INVALID_WORKFLOW','Workflow contains unreachable nodes.');
  return { schema:'robobuddy.workflow.v1', id:String(input.id || 'imported').slice(0,120), title:String(input.title || 'Imported workflow').slice(0,240), source:provenance, declaredVersion:input.metadata?.version || null, startNodeId, steps, edges:links, equipment:clone(input.equipment || input.requiredEquipment || []), safetyNotes:clone(input.safetyNotes || []), sourceDocument:clone(input), originVerified:false, note:'Imported content is untrusted task data. Graph branches/retries are preserved; this is not proof that chemical operations are simulated.' };
}
export function validateBundle(bundle, run) {
  strict(bundle,['schema','title','files','assets','workflow_map','limitations'],'Bundle');
  requireThat(bundle.schema === 'robobuddy.task-bundle.v1','INVALID_BUNDLE','Use schema robobuddy.task-bundle.v1.');
  text(bundle.title,1,160,'Title'); strict(bundle.files,FILES,'Files');
  for(const file of FILES) text(bundle.files[file],1,LIMITS.fileBytes,file);
  requireThat(new TextEncoder().encode(JSON.stringify(bundle)).length <= LIMITS.bundleBytes,'TOO_LARGE','Bundle exceeds 160 KB.');
  requireThat(Array.isArray(bundle.assets) && bundle.assets.length<=LIMITS.assets,'INVALID_BUNDLE','assets must be an array of at most 12 visual objects.');
  const assetIds=new Set();
  for(const a of bundle.assets){
    strict(a,['id','label','shape','position_mm','size_mm','color','role'],'Asset'); text(a.id,1,64,'Asset id'); text(a.label,1,100,'Asset label');
    requireThat(!assetIds.has(a.id),'INVALID_BUNDLE','Asset ids must be unique.'); assetIds.add(a.id);
    requireThat(['box','cylinder','sphere'].includes(a.shape),'INVALID_BUNDLE','Asset shape must be box, cylinder, or sphere.');
    requireThat(a.role === 'visual_only','INVALID_BUNDLE','New assets must declare role visual_only: they do not add collision, grasping, or chemistry.');
    requireThat(/^#[0-9a-f]{6}$/i.test(a.color),'INVALID_BUNDLE','Asset colors use #RRGGBB.');
    for(const k of ['position_mm','size_mm']) requireThat(Array.isArray(a[k])&&a[k].length===3&&a[k].every(n=>Number.isFinite(n)&&(k==='size_mm'?n>=1&&n<=2000:Math.abs(n)<=5000)),'INVALID_BUNDLE',`${k}: expected 3 finite millimetre coordinates within bounds.`);
  }
  requireThat(Array.isArray(bundle.limitations)&&bundle.limitations.length>0&&bundle.limitations.length<=20,'INVALID_BUNDLE','Declare at least one limitation (maximum 20).'); bundle.limitations.forEach(x=>text(x,1,700,'Limitation'));
  requireThat(Array.isArray(bundle.workflow_map),'INVALID_BUNDLE','workflow_map must be an array.');
  const required=run.spec.track === 'workflow' ? run.spec.workflow.steps : [];
  requireThat(bundle.workflow_map.length===required.length,'INCOMPLETE_MAPPING',`workflow_map must contain exactly ${required.length} entries, one for each supplied node (including start/end).`);
  const nodeIds=new Set(required.map(x=>x.id)), mapped=new Set();
  for(const m of bundle.workflow_map){
    strict(m,['node_id','handling','reason','file','start_line','end_line'],'Workflow mapping');
    requireThat(nodeIds.has(m.node_id)&&!mapped.has(m.node_id),'INVALID_MAPPING','Unknown or duplicate workflow node.'); mapped.add(m.node_id);
    requireThat(['robotic','human','unsupported','not_applicable'].includes(m.handling),'INVALID_MAPPING','Unknown handling classification.'); text(m.reason,1,700,'Mapping reason');
    if(m.handling==='robotic') { requireThat(FILES.includes(m.file),'INVALID_MAPPING','Robotic mappings require a workspace file.'); const lines=bundle.files[m.file].split('\n').length; requireThat(Number.isInteger(m.start_line)&&Number.isInteger(m.end_line)&&m.start_line>=1&&m.end_line>=m.start_line&&m.end_line<=lines,'INVALID_MAPPING','Mapping line range is outside the submitted file.'); }
    else requireThat(m.file===null && m.start_line===null && m.end_line===null,'INVALID_MAPPING','Non-robotic mappings use null file/start_line/end_line.');
  }
  return {valid:true, fileCount:FILES.length, visualAssets:bundle.assets.length, mappedNodes:mapped.size, totalNodes:required.length, semanticWorkflowSuccess:'not assessed', note:'Structural validation is not Python execution, task completion, or chemical validation.'};
}
export function runtimeGrade(observation, task) {
  requireThat(observation?.kind === 'observed-runtime', 'MISSING_EVIDENCE','Runtime evidence is required.');
  if(task.profile==='unitree') {
    const states=observation.samples || [], final=states.at(-1)||{}, raised=states.some(s=>s.left_elbow_joint>=40 && s.right_elbow_joint>=40);
    const neutral=Object.entries(final).filter(([k])=>k.endsWith('_joint')).length>0&&Object.entries(final).filter(([k])=>k.endsWith('_joint')).every(([,v])=>Math.abs(v)<=1);
    const goals=[{id:'bilateral-inspection-pose',passed:raised},{id:'return-to-neutral',passed:neutral&&raised},{id:'executed-motion',passed:observation.actionCount>=2}];
    return scoreGoals(goals,observation.fault);
  }
  if(task.profile==='microduck') {
    const initial=observation.initial?.simulatedPose?.position, final=observation.final?.simulatedPose?.position;
    requireThat(initial?.length===3&&final?.length===3,'MISSING_EVIDENCE','MicroDuck pose telemetry missing.');
    const distance=Math.hypot(final[0]-initial[0],final[1]-initial[1]);
    const stopped=(observation.final.movement?.applied||[]).length===3&&observation.final.movement.applied.every(x=>Math.abs(x)<0.015);
    return {...scoreGoals([{id:'travel-0.8-to-1.6-metres',passed:distance>=0.8&&distance<=1.6},{id:'stop-at-finish',passed:stopped&&distance>=0.8},{id:'remain-upright',passed:!observation.final.safety?.fallen&&distance>=0.8}],observation.fault),distanceM:distance};
  }
  const grade=observation.grade;
  requireThat(Array.isArray(grade?.goals)&&grade.goals.length>0,'MISSING_EVIDENCE','Pinned source engine did not provide goal evidence.');
  const violation=grade.prohibited?.some(x=>x.triggered)||grade.causal?.length>0;
  return scoreGoals(grade.goals, observation.fault || (violation?'PROHIBITED_OR_CAUSAL_VIOLATION':null));
}
function scoreGoals(goals,fault){const clean=goals.map(g=>({id:String(g.id),passed:g.passed===true}));return {score:fault?0:Math.round(100*clean.filter(g=>g.passed).length/clean.length),passed:!fault&&clean.every(g=>g.passed),goals:clean,fault:fault||null,scope:'Robot motion and configured modeled goal predicates only. Not chemical or hardware validation.'};}
export function groupResults(runs){
  const groups=new Map();
  for(const r of runs.filter(r=>r.status==='finalized'&&r.kind==='model'&&r.spec.runtimeQualified!==false)){
    const key=JSON.stringify([r.specHash,r.model.provider,r.model.name,r.model.settings,r.transport]);
    if(!groups.has(key)) groups.set(key,{specHash:r.specHash,task:r.task.title,track:r.spec.track,model:r.model.name,provider:r.model.provider,settings:r.model.settings,transport:r.transport,runs:0,scored:0,passes:0,total:0,blocked:0});
    const g=groups.get(key);g.runs++; if(r.outcome==='infrastructure_error'){g.blocked++;continue;}g.scored++;g.passes+=Number(r.result?.passed===true);g.total+=r.result?.score||0;
  }
  return [...groups.values()].map(g=>({...g,meanScore:g.scored?Math.round(g.total/g.scored):null,passRate:g.scored?g.passes/g.scored:null}));
}
