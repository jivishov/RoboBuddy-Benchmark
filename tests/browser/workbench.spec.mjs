import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
test('manual workbench, real workflow import and native feature detection',async({page})=>{
  await page.goto('/');await expect(page.locator('#task option')).toHaveCount(3);
  await expect(page.locator('#native-status')).toContainText('manual');
  await page.getByLabel('Prompt + workflow',{exact:false}).check();await page.locator('#sample-workflow').click();await expect(page.locator('#workflow-summary')).toContainText('nodes');
  await page.locator('#provider').fill('Test harness');await page.locator('#model').fill('UI smoke');await page.locator('#start-run').click();await expect(page.locator('#run-state')).toHaveText('ACTIVE');
  await page.locator('#stage').click();await expect(page.locator('#revision')).toHaveText('REV 1');await page.locator('#validate').click();await expect(page.locator('#diagnostics')).toContainText('"valid": true');
  await page.locator('#finalize').click();await expect(page.locator('#score')).toHaveText('0/100');await expect(page.locator('#comparison-body')).toContainText('UI smoke');
  await page.screenshot({path:'test-results/workbench.png',fullPage:true});
});
test('registered native tool handlers traverse the actual session lifecycle (mock registration only)',async({page})=>{
  await page.addInitScript(()=>{document.modelContext={registerTool:async(tool,{signal})=>{window.testTools||={};window.testTools[tool.name]=tool;signal.addEventListener('abort',()=>delete window.testTools[tool.name]);}};});
  await page.goto('/');await page.locator('#provider').fill('Harness');await page.locator('#model').fill('Tool mock');await page.locator('#start-run').click();await page.locator('#agent-access').check();await expect(page.locator('#native-status')).toContainText('8 site tools');
  const result=await page.evaluate(async()=>{const tools=window.testTools;const input=JSON.parse((await tools.read_benchmark_input.execute({})).content[0].text);const bundle={schema:'robobuddy.task-bundle.v1',title:'No-op',files:input.starterFiles,assets:[],workflow_map:[],limitations:['No hardware qualification.']};const staged=JSON.parse((await tools.stage_robotic_task.execute({run_id:input.run_id,expected_revision:0,bundle})).content[0].text);return JSON.parse((await tools.finalize_benchmark_run.execute({run_id:input.run_id,expected_revision:staged.revision})).content[0].text);});
  expect(result.result.score).toBe(0);await expect(page.locator('#comparison-body')).toContainText('webmcp');
});
test('real pinned runtimes: public reference and no-op smoke evidence for every task',async({page})=>{
  test.setTimeout(1500000);await page.goto('/');
  const report=await page.evaluate(async()=>{
    const {RobotRunner}=await import('./src/runner.js');const {runtimeGrade}=await import('./src/core.js');const c=await (await fetch('./data/catalog.json')).json();
    const rows=[];
    for(const task of c.tasks){
      const entry={taskId:task.id,profile:task.profile,title:task.title};
      for(const kind of ['reference','noop']){
        const runner=new RobotRunner(document.querySelector('#simulation'));const controller=new AbortController();const timeout=setTimeout(()=>{controller.abort();runner.stop();},150000);
        try {const b=await (await fetch(`./data/references/${task.id}.json`)).json();if(kind==='noop')b.files=c.starters[task.id];const obs=await runner.execute(task,b,controller.signal);entry[kind]={...runtimeGrade(obs,task),diagnostics:obs.fault||null,actionCount:obs.actionCount??obs.boundaries};}
        catch(e){entry[kind]={error:e.code||'ERROR',message:String(e.message).slice(-1600)};}
        finally{clearTimeout(timeout);runner.dispose();}
      }
      entry.qualified=entry.reference?.passed===true&&entry.noop?.passed===false;
      rows.push(entry);
    }
    return {schema:'robobuddy.runtime-smoke.v1',generatedAt:new Date().toISOString(),nativeAgentTested:false,note:'Public-reference replay and no-op control on CI Chromium. Not hardware or LLM benchmark results.',tasks:rows};
  });
  await writeFile('dist/data/smoke-report.json',JSON.stringify(report,null,2));await writeFile('test-results/runtime-smoke.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
  // A failing runtime is reported and remains unqualified, never silently called verified.
  expect(report.tasks).toHaveLength(7);
  expect(report.tasks.filter(t=>t.qualified).length,'At least one genuine runtime must pass reference and fail no-op.').toBeGreaterThan(0);
});
