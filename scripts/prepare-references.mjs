import {readFile,writeFile} from 'node:fs/promises';
// Reference-only adaptation: use the pinned public API and observed displacement
// rather than a browser-dependent, fixed wall-clock movement interval.
const file='dist/data/references/microduck-policy-demonstrator.json';
const bundle=JSON.parse(await readFile(file,'utf8'));
bundle.title='Benchmark reference: MicroDuck observed-distance inspection';
bundle.files['main.py']=`# Benchmark-authored reference using the pinned MicroDuck public API.
# Approximate browser dynamics only; no hardware or chemistry validation.
import math
from robot_config import create_robot

robot = create_robot()
await robot.connect()
try:
    await robot.enable(True)
    state = await robot.get_state()
    origin = state["simulatedPose"]["position"]
    await robot.move(0.30, 0.0, 0.0)
    distance = 0.0
    for attempt in range(100):
        await robot.sleep(0.15)
        state = await robot.get_state()
        position = state["simulatedPose"]["position"]
        distance = math.hypot(position[0] - origin[0], position[1] - origin[1])
        if distance >= 1.05:
            break
    await robot.stop()
    state = await robot.get_state()
    print("Observed route distance (m)", distance)
    print("Final modeled position", state["simulatedPose"]["position"])
finally:
    await robot.disconnect()
`;
bundle.limitations=bundle.limitations.filter(x=>!x.startsWith('Public source-authored reference.'));
bundle.limitations.push('Benchmark-authored observed-distance reference using the unchanged pinned MicroDuck API. Public demonstration, excluded from model comparisons.');
await writeFile(file,JSON.stringify(bundle,null,2));
const provenanceFile='dist/data/provenance.json';
const provenance=JSON.parse(await readFile(provenanceFile,'utf8'));
provenance.referenceAdapters={microduck:'Observed-displacement feedback, target 1.05 m, at most 100 checks; fixed workcell motion rubric unchanged.'};
await writeFile(provenanceFile,JSON.stringify(provenance,null,2));
console.log('Prepared explicitly labeled MicroDuck observed-distance reference; upstream repositories and scoring rules unchanged.');
