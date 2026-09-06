import test from 'node:test';
import assert from 'node:assert/strict';
import {adjustedHoldSeconds} from '../src/runner.js';
test('courier hold debit does not create floating-point extra plant ticks',()=>{
  for(let i=0;i<10000;i++){
    const before=i*0.02;
    const advanced=(before+0.02)-before;
    assert.equal(Math.ceil(adjustedHoldSeconds(0.26,advanced)/0.02),12);
  }
  assert.equal(adjustedHoldSeconds(0.01,0.02),0);
});
