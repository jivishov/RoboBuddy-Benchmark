import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeWorkflow,groupResults} from '../src/core.js';
import {BenchmarkSession} from '../src/session.js';

test('workflow retains full action parameters and initial state',()=>{
  const input={id:'lab',initialState:{volume:10},process:{startNodeId:'step',nodes:[{id:'step',title:'Dispense',type:'action',params:{volume:2.5,unit:'mL'}}],edges:[]}};
  const workflow=normalizeWorkflow(input);
  assert.equal(workflow.sourceDocument.process.nodes[0].params.volume,2.5);
  assert.equal(workflow.sourceDocument.initialState.volume,10);
  input.process.nodes[0].params.volume=99;
  assert.equal(workflow.sourceDocument.process.nodes[0].params.volume,2.5);
});

test('benchmark build identity changes the frozen comparison hash',async()=>{
  const task={id:'test',profile:'unitree',title:'Test',prompt:'Perform the specified inspection pose.'};
  const config={taskId:'test',prompt:task.prompt,track:'prompt',model:{provider:'Test',name:'Test',settings:''},maxAttempts:1};
  const one=new BenchmarkSession({catalog:{tasks:[task],benchmarkCommit:'build-one'},runner:{}});
  const two=new BenchmarkSession({catalog:{tasks:[task],benchmarkCommit:'build-two'},runner:{}});
  await one.create(config);await two.create(config);
  assert.notEqual(one.current.specHash,two.current.specHash);
});

test('unqualified workcells are excluded from model comparisons',()=>{
  const run={status:'finalized',kind:'model',spec:{runtimeQualified:false},result:{score:100,passed:true}};
  assert.deepEqual(groupResults([run]),[]);
});
