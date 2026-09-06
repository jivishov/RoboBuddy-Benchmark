import {test,expect} from '@playwright/test';
test('visible reference button executes the real workcell and stays out of model comparisons',async({page})=>{
  test.setTimeout(180000);
  await page.goto('/');
  await expect(page.locator('#task option')).toHaveCount(3);
  await page.locator('#task').selectOption('so101-v2-08-burette-initial-reading');
  await page.locator('#demo').click();
  await expect(page.locator('#run-state')).toHaveText('FINALIZED',{timeout:125000});
  await expect(page.locator('#score')).toHaveText('100/100');
  await expect(page.locator('#comparison-body')).toContainText('No finalized model runs');
  await expect(page.locator('#canvas-empty')).toBeHidden();
  await page.screenshot({path:'test-results/reference-demo-workcell.png',fullPage:true});
});
