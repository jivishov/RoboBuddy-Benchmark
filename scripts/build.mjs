import {cp,mkdir,readFile,writeFile,rm,access} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {VERSION,IDE_REV,LAB_REV} from '../src/core.js';
const root=process.cwd(), out=path.join(root,'dist');
const ide=path.resolve(process.env.IDE_SOURCE || '.upstream/ide');
const lab=path.resolve(process.env.LAB_SOURCE || '.upstream/lab');
await access(path.join(ide,'src/task-catalog.js'));
const catalog=await import(pathToFileURL(path.join(ide,'src/task-catalog.js')));
const {PROFILES}=await import(pathToFileURL(path.join(ide,'src/profiles.js')));
const {buildPatchedWorkspace}=await import(pathToFileURL(path.join(ide,'src/task-workspace.js')));
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const name of ['index.html','styles.css','src','docs'])await cp(path.join(root,name),path.join(out,name),{recursive:true});
await writeFile(path.join(out,'.nojekyll'),'');
await mkdir(path.join(out,'runtime/src'),{recursive:true});
for(const name of ['simulator-host.js','source-simulator.js','canonical-rig.js','profiles.js','task-catalog.js','python-runtime.js','microduck'])await cp(path.join(ide,'src',name),path.join(out,'runtime/src',name),{recursive:true});
for(const name of ['assets','licenses','LICENSE'])await cp(path.join(ide,name),path.join(out,'runtime',name),{recursive:true});
// These two tiny assets are document-relative in the unchanged upstream renderer.
await mkdir(path.join(out,'assets/microduck'),{recursive:true});
for(const name of ['generated','visual'])await cp(path.join(ide,'assets/microduck',name),path.join(out,'assets/microduck',name),{recursive:true});
for(const name of ['scenarios','references','workflows'])await mkdir(path.join(out,'data',name),{recursive:true});
const data={version:VERSION,benchmarkCommit:process.env.GITHUB_SHA||'local-unversioned',runtimeRevision:IDE_REV,labRevision:LAB_REV,profiles:{},tasks:[],starters:{}};
const json=(file,value)=>writeFile(path.join(out,file),JSON.stringify(value,null,2));
for(const [id,p] of Object.entries(PROFILES)){
  data.profiles[id]={id,label:p.label,limits:p.limits,rest:p.rest,units:p.units||{},driver:p.driver,source:p.source,limitations:p.task.limitations,simulationOnly:true,pythonRules:'Only time, math, the four workspace modules, and supplied robot adapters. No file/network access, private attributes, classes, or dynamic evaluation. Source profiles compile then replay (not live sensor feedback). MicroDuck uses async live methods.',assetRules:'Visual-only primitives in Three.js Y-up millimetres. workcell.py is metadata, not a physical scene loader.'};
  for(const descriptor of catalog.tasksForProfile(id)){
    const scenario=await catalog.loadPatchedScenario(id,descriptor.id);
    const reference=buildPatchedWorkspace(id,scenario);
    let prompt;
    if(id==='unitree')prompt='Build a browser-only G1 lab-inspection pose routine. Raise both elbows to at least 40 degrees using bounded named joint commands, inspect the pose, then return every joint to neutral. Keep the root fixed and do not claim walking, grasping, or collision validation.';
    else if(id==='microduck')prompt='Build a browser-only MicroDuck inspection route. Walk 0.8 to 1.6 metres from the reset position, stop at the finish, and remain upright. Report the modeled state. Do not claim laboratory manipulation or hardware validation.';
    else prompt=`Build a Python robotic lab routine for ${scenario.title}. ${scenario.brief || scenario.description || ''} Satisfy the supplied workcell goal predicates with bounded public send_action commands. Do not bypass contact, support, or prohibited-state checks. Declare any laboratory steps the robot cannot model.`;
    const task={id:descriptor.id,profile:id,title:descriptor.title,prompt,mode:scenario.simulationMode||'source_plant',rubric:id==='unitree'?['Both elbows >=40 degrees','All joints return within 1 degree of neutral','At least two actions']:id==='microduck'?['Travel 0.8–1.6 m in the ground plane','Stop at the finish','Remain upright']:scenario.goalPredicates,scope:id==='unitree'?'Kinematic poses only':id==='microduck'?'Live policies, approximate dynamics':'Fixed workcell; source-plant motion goals',workcell:{objects:scenario.objects||[],fixtures:scenario.fixtures||[],frames:scenario.frames||{},prohibitedStates:scenario.prohibitedStates||[]},qualification:'Public workcell; consult the published smoke-test report. No hardware qualification.'};
    data.tasks.push(task);
    const starter={...reference,'main.py':id==='microduck'?'from robot_config import create_robot\n\nrobot = create_robot()\nawait robot.connect()\ntry:\n    # Add your async robot routine here.\n    pass\nfinally:\n    await robot.disconnect()\n':'import time\nfrom robot_config import create_robot\n\nrobot = create_robot()\nrobot.connect()\ntry:\n    # Add your robot.send_action routine here.\n    pass\nfinally:\n    robot.disconnect()\n','trajectories.py':'# Define your own bounded trajectory here. No reference solution is supplied.\n'};
    // Each task has its own workcell metadata even when profiles are shared.
    data.starters[descriptor.id]=starter;
    await json(`data/scenarios/${descriptor.id}.json`,scenario);
    await json(`data/references/${descriptor.id}.json`,{schema:'robobuddy.task-bundle.v1',title:`Reference demonstration: ${descriptor.title}`,files:reference,assets:[],workflow_map:[],limitations:[p.task.limitations,'Public source-authored reference. Excluded from model comparisons.']});
  }
}
await json('data/catalog.json',data);
const workflow=JSON.parse(await readFile(path.join(lab,'public/techniques/titration-endpoint.json'),'utf8'));
await json('data/workflows/titration-endpoint.json',workflow);
await json('data/provenance.json',{version:VERSION,benchmarkCommit:process.env.GITHUB_SHA||'local-unversioned',timingAdapter:'LeKiwi hold-inclusive-command-tick-v1; other source plants unchanged',ide:{repository:'jivishov/RoboBuddy_IDE',revision:IDE_REV,access:'read-only build dependency'},lab:{repository:'jivishov/Lab-Studio_WebMCP',revision:LAB_REV,workflow:'public/techniques/titration-endpoint.json'},sourceEngine:{repository:'jivishov/RoboBuddy_AI',revision:catalog.TASK_PATCH_REVISION},notes:['No upstream repositories are modified.','Model/provider labels are user-declared.','Public references are not a secret holdout.','GitHub Pages stores no model API keys or centralized leaderboard.']});
console.log(`Built ${data.tasks.length} fixed-workcell tasks / ${Object.keys(data.profiles).length} robot profiles into dist.`);
