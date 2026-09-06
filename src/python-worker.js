// Candidate Python runs off the UI thread. This is a bounded research harness,
// not a hardened sandbox against an adversary controlling the browser itself.
import { PythonRuntime } from '../runtime/src/python-runtime.js';
const ROOT = 'https://cdn.jsdelivr.net/pyodide/v0.29.4/full/';
const GUARD = String.raw`
import ast, json
_allowed_imports = {'time', 'math', 'robot_config', 'trajectories', 'workcell', 'lerobot', 'robobuddy', 'microduck'}
_forbidden_names = {'open','eval','exec','compile','__import__','globals','locals','getattr','setattr','delattr','vars','dir','help','input','breakpoint','type','object','super'}
for _filename, _source in json.loads(_bench_files_json).items():
    _tree = ast.parse(_source, filename=_filename)
    for _node in ast.walk(_tree):
        if isinstance(_node, (ast.Import, ast.ImportFrom)):
            _modules = [_node.module or ''] if isinstance(_node, ast.ImportFrom) else [a.name for a in _node.names]
            if any(m.split('.')[0] not in _allowed_imports for m in _modules) or getattr(_node, 'level', 0):
                raise ValueError('Unsupported import in ' + _filename)
        if isinstance(_node, ast.Name) and (_node.id.startswith('_') or _node.id in _forbidden_names):
            raise ValueError('Unsupported name ' + _node.id + ' in ' + _filename)
        if isinstance(_node, ast.Attribute) and _node.attr.startswith('_'):
            raise ValueError('Private attributes are not supported in benchmark programs')
        if isinstance(_node, (ast.ClassDef, ast.Global, ast.Nonlocal)):
            raise ValueError('Classes and global/nonlocal declarations are not supported')
`;
self.onmessage = async ({data}) => {
  try {
    self.window = self;
    const {loadPyodide} = await import(ROOT + 'pyodide.mjs');
    self.loadPyodide = loadPyodide;
    const runtime = new PythonRuntime();
    const py = await runtime.ensure();
    py.globals.set('_bench_files_json', JSON.stringify(data.files));
    try { await py.runPythonAsync(GUARD); }
    catch (e) { self.postMessage({ok:false,code:'PYTHON_VALIDATION',message:String(e.message)}); return; }
    if (data.validateOnly) { self.postMessage({ok:true}); return; }
    // A fresh worker is used per attempt: module state cannot leak between runs.
    await py.runPythonAsync(`import sys\n_bench_lines = 0\ndef _bench_trace(frame, event, arg):\n    global _bench_lines\n    if frame.f_code.co_filename in ('main.py','trajectories.py','robot_config.py','workcell.py'):\n        _bench_lines += 1\n        if _bench_lines > 200000:\n            raise RuntimeError('BENCHMARK_INSTRUCTION_BUDGET exceeded')\n    return _bench_trace\nsys.settrace(_bench_trace)`);
    const result = await runtime.compileWorkspace(data.files);
    result.stdout = String(result.stdout || '').slice(0,12000);
    result.stderr = String(result.stderr || '').slice(0,6000);
    if (result.events.length > 3000) throw Object.assign(new Error('At most 3000 robot events are allowed.'),{code:'EVENT_BUDGET'});
    self.postMessage({ok:true,result});
  } catch(e) { self.postMessage({ok:false,code:e.code || 'RUNTIME_UNAVAILABLE',message:String(e.message||e).slice(0,3000)}); }
};
