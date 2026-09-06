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
  test.setTimeout(1000000);await page.goto('/');
  const catalog=await page.evaluate(async()=>await (await fetch('./data/catalog.json')).json());
  const rows=[];
  for(const task of catalog.tasks){
    const entry={taskId:task.id,profile:task.profile,title:task.title};
    for(const kind of ['reference','noop']){
      entry[kind]=await page.evaluate(async({task,kind})=>{
        const {RobotRunner}=await import('./src/runner.js');const {runtimeGrade}=await import('./src/core.js');
        const c=await (await fetch('./data/catalog.json')).json();
        const runner=new RobotRunner(document.querySelector('#simulation'));const controller=new AbortController();
        let timeout;const started=performance.now();
        const deadline=new Promise((_,reject)=>{timeout=setTimeout(()=>{controller.abort();runner.stop();reject(new Error('120-second wall budget exceeded.'));},120000);});
        try{
          const b=await (await fetch(`./data/references/${task.id}.json`)).json();if(kind==='noop')b.files=c.starters[task.id];
          const obs=await Promise.race([runner.execute(task,b,controller.signal),deadline]);
          if(kind==='reference'){document.querySelector('#canvas-empty').hidden=true;document.querySelector('#progress').textContent=`Reference check: ${task.title}`;}
          return {...runtimeGrade(obs,task),durationMs:Math.round(performance.now()-started),diagnostics:obs.fault||null,actionCount:obs.actionCount??obs.boundaries,rootPose:obs.rootPose,visitedFrames:obs.visitedFrames};
        }catch(e){return {error:e.code||'ERROR',message:String(e.message).slice(-1600),durationMs:Math.round(performance.now()-started)};}
        finally{clearTimeout(timeout);runner.dispose();}
      },{task,kind});
      console.log(`${task.id} / ${kind}: ${entry[kind].score??entry[kind].error} (${entry[kind].durationMs} ms)`);
    }
    entry.qualified=entry.reference?.passed===true&&entry.noop?.passed===false;
    rows.push(entry);
    await writeFile('test-results/runtime-progress.json',JSON.stringify(rows,null,2));
  }
  const report={schema:'robobuddy.runtime-smoke.v1',benchmarkCommit:catalog.benchmarkCommit,generatedAt:new Date().toISOString(),wallBudgetSeconds:120,nativeAgentTested:false,note:'Public-reference replay and no-op control on CI Chromium. Not hardware or LLM benchmark results.',tasks:rows};
  await writeFile('dist/data/smoke-report.json',JSON.stringify(report,null,2));await writeFile('test-results/runtime-smoke.json',JSON.stringify(report,null,2));
  for(const task of catalog.tasks){const r=rows.find(x=>x.taskId===task.id);task.verification={qualified:r.qualified,referenceScore:r.reference?.score??null,referenceError:r.reference?.error??null,checkedAt:report.generatedAt};}
  await writeFile('dist/data/catalog.json',JSON.stringify(catalog,null,2));
  expect(report.tasks).toHaveLength(7);
  expect(report.tasks.filter(t=>t.qualified).length,'At least four actual runtimes must pass reference and fail no-op.').toBeGreaterThanOrEqual(4);
});
