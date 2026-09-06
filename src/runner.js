import {BenchError,requireThat,LIMITS} from './core.js';
const tick = () => new Promise(resolve=>requestAnimationFrame(resolve));
// Avoid an extra plant tick when floating subtraction falls just above a tick boundary.
export function adjustedHoldSeconds(seconds, alreadyAdvanced) { return Math.max(0, seconds-alreadyAdvanced-1e-9); }
export class RobotRunner {
  constructor(canvas,onProgress=()=>{}){this.canvas=canvas;this.onProgress=onProgress;this.host=null;this.worker=null;this.bridge=null;this.overlays=[];}
  async ensure(signal){
    if(this.host)return;
    try {
      const [host,profiles,three,bridge] = await Promise.all([
        import('../runtime/src/simulator-host.js'),import('../runtime/src/profiles.js'),
        import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js'),import('../runtime/src/microduck/python-bridge.js')
      ]);
      this.check(signal);this.profiles=profiles;this.THREE=three;this.Bridge=bridge.MicroDuckPythonBridge;
      this.host=new host.SimulatorHost(this.canvas);
      this.resizeObserver=new ResizeObserver(()=>this.host?.resize());this.resizeObserver.observe(this.canvas.parentElement);
    } catch(e){this.check(signal);throw new BenchError(/webgl|context/i.test(e.message)?'WEBGL_UNAVAILABLE':'DEPENDENCY_UNAVAILABLE',`Cannot load pinned renderer: ${e.message}`);}
  }
  check(signal){if(signal?.aborted)throw new BenchError('ABORTED','Run stopped or its time budget expired.');}
  async prepare(task,signal){
    this.check(signal);await this.ensure(signal);this.check(signal);this.clearOverlays();
    try{
      const response=await fetch(`./data/scenarios/${task.id}.json`,{signal});
      if(!response.ok)throw new Error(`Scenario HTTP ${response.status}`);
      const scenario=await response.json();this.check(signal);
      await this.host.setScenario(task.profile,task.profile==='unitree'?null:scenario,this.profiles.PROFILES[task.profile].rest);
      this.host.resize();this.host.fit();this.check(signal);
    }catch(e){if(signal?.aborted)this.check(signal);throw new BenchError('DEPENDENCY_UNAVAILABLE',`Pinned workcell could not initialize: ${e.message}`);}
  }
  compile(files,signal,validateOnly=false){
    return new Promise((resolve,reject)=>{
      const worker=new Worker(new URL('./python-worker.js',import.meta.url),{type:'module'});this.worker=worker;
      const finish=(error,value)=>{worker.terminate();if(this.worker===worker)this.worker=null;signal?.removeEventListener('abort',abort);clearTimeout(timer);error?reject(error):resolve(value);};
      const abort=()=>finish(new BenchError('ABORTED','Python worker stopped.'));
      let phase='loading';
      const timer=setTimeout(()=>finish(new BenchError(phase==='loading'?'RUNTIME_UNAVAILABLE':'PYTHON_TIMEOUT',phase==='loading'?'Python dependencies did not load within 60 seconds.':'Python execution exceeded 60 seconds.')),60000);
      worker.onmessage=({data})=>{if(data.phase){phase=data.phase;return;}data.ok?finish(null,data.result):finish(new BenchError(data.code,data.message));};
      worker.onerror=e=>finish(new BenchError('RUNTIME_UNAVAILABLE',e.message || 'Python worker unavailable.'));
      signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted){abort();return;}worker.postMessage({files,validateOnly});
    });
  }
  clearOverlays(){for(const mesh of this.overlays){mesh.parent?.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}this.overlays=[];}
  addOverlays(assets,profile){const T=this.THREE,scene=this.host.backend?.scene;if(!scene)return;const unit=profile==='microduck'?0.001:1;
    for(const a of assets){const geometry=a.shape==='sphere'?new T.SphereGeometry(0.5,16,12):a.shape==='cylinder'?new T.CylinderGeometry(0.5,0.5,1,20):new T.BoxGeometry(1,1,1);const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({color:a.color,transparent:true,opacity:.42,wireframe:true}));mesh.name=`visual-only:${a.id}`;mesh.position.fromArray(a.position_mm.map(n=>n*unit));mesh.scale.fromArray(a.size_mm.map(n=>n*unit));scene.add(mesh);this.overlays.push(mesh);}
  }
  async execute(task,bundle,signal){
    this.onProgress('Initializing pinned robot and fixed workcell…');await this.prepare(task,signal);this.addOverlays(bundle.assets,task.profile);
    if(task.profile==='microduck')return this.executeDuck(bundle,signal);
    this.onProgress('Checking and compiling Python in an isolated worker…');const compiled=await this.compile(bundle.files,signal);this.check(signal);
    if(compiled.exception)throw new BenchError('PYTHON_ERROR',compiled.exception.slice(-3000));
    const events=compiled.events;let seconds=0,actions=0;let connected=false;
    for(const e of events){
      if(e.kind==='connect')connected=true;
      else if(e.kind==='disconnect')connected=false;
      else if(e.kind==='send_action'){requireThat(connected,'NOT_CONNECTED','Actions must occur between connect and disconnect.');this.profiles.validateAction(task.profile,e.action);requireThat(Object.values(e.action).every(Number.isFinite),'INVALID_ACTION','Non-finite action.');actions++;}
      else if(e.kind==='sleep'){requireThat(Number.isFinite(e.seconds)&&e.seconds>=0&&e.seconds<=30,'TIME_BUDGET','Each modeled sleep must be between 0 and 30 seconds.');seconds+=e.seconds;}
      else requireThat(e.kind==='get_observation','INVALID_EVENT','Unknown robot event.');
    }
    requireThat(seconds<=LIMITS.seconds,'TIME_BUDGET','Total modeled sleep exceeds 120 seconds.');
    const samples=[this.host.getTelemetry()];let fault=null,executedActions=0,commandAdvance=0;let lastBase={};
    this.onProgress(`Replaying ${actions} actions through the pinned simulator…`);
    for(const [i,e] of events.entries()){
      this.check(signal);
      try{
        if(e.kind==='send_action'){const before=Number(this.host.getTelemetry().simulation_clock_s||0);const accepted=await this.host.applyAction(e.action,{beforeTick:()=>!signal.aborted});this.check(signal);requireThat(accepted!==false,'ACTION_REJECTED','Simulator rejected the action.');executedActions++;lastBase={...lastBase,...e.action};commandAdvance=Number(this.host.getTelemetry().simulation_clock_s||0)-before;samples.push(this.host.getTelemetry());}
        if(e.kind==='sleep'){
          // The source viewer advances a tick when applying a command. LeKiwi
          // reference hold durations already include that command tick; debit it
          // to avoid accumulating an extra 20 ms per route segment.
          const duration=task.profile==='lekiwi'?adjustedHoldSeconds(e.seconds,commandAdvance):e.seconds;
          commandAdvance=0;
          await this.host.advanceTime(duration,{realtime:false,beforeTick:()=>!signal.aborted});this.check(signal);samples.push(this.host.getTelemetry());
        }
      }catch(e){this.check(signal);fault=String(e.message).slice(0,1200);break;}
      if(i%6===0)await tick();
    }
    const snapshot=this.host.backend?.engine?.snapshot();
    const telemetry=this.host.getTelemetry();
    // End-of-program base motion is not a valid stopped courier submission.
    if(task.profile==='lekiwi'&&['x.vel','y.vel','theta.vel'].some(k=>Math.abs(lastBase[k]||0)>1e-6))fault ||= 'BASE_NOT_STOPPED';
    return {kind:'observed-runtime',profile:task.profile,actionCount:executedActions,plannedActionCount:actions,modeledSeconds:seconds,simulationClockSeconds:telemetry.simulation_clock_s,timingAdapter:task.profile==='lekiwi'?'hold-inclusive-command-tick-v1':'source-plant-v1',samples:samples.slice(-LIMITS.events),grade:snapshot?.grade || null,contacts:this.host.getContacts(),objects:snapshot?.objects || null,rootPose:snapshot?.rootPose||null,visitedFrames:snapshot?.visitedFrames||[],fault,stdout:compiled.stdout,stderr:compiled.stderr,events,observationSemantics:'Source profiles compile to an open-loop action trace. Python get_observation returns shim command state; score uses the separately replayed source plant.'};
  }
  async executeDuck(bundle,signal){
    this.onProgress('Checking async MicroDuck program…');await this.compile(bundle.files,signal,true);this.check(signal);
    const initial=this.host.getState();let boundaries=0;
    this.bridge=new this.Bridge({simulator:this.host,runTimeoutMs:90000,onOutput:()=>{},onBoundary:()=>{boundaries++;},onState:()=>{}});
    const abort=()=>this.bridge?.cancel('STOP',{immediate:true});signal.addEventListener('abort',abort,{once:true});
    try {this.onProgress('Running live MicroDuck policy simulation…');const result=await this.bridge.start(bundle.files,{workspaceEpoch:1,mode:'run'});this.check(signal);return {kind:'observed-runtime',profile:'microduck',initial,final:this.host.getState(),boundaries,stdout:String(result.stdout||'').slice(0,12000),stderr:String(result.stderr||'').slice(0,6000),fault:null,observationSemantics:'Live async policy simulation; approximate dynamics, no hardware or RL-environment parity.'};}
    finally{signal.removeEventListener('abort',abort);this.bridge=null;}
  }
  stop(){this.bridge?.cancel('STOP',{immediate:true});this.worker?.terminate();this.clearOverlays();this.resizeObserver?.disconnect();this.host?.dispose();this.host=null;}
  dispose(){this.worker?.terminate();this.stop();this.clearOverlays();this.resizeObserver?.disconnect();this.host?.dispose();this.host=null;}
}
