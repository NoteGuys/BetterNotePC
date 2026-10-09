const assert=require('node:assert/strict');
module.exports=async({page,fixture,check})=>{
 const homeReady=async()=>{for(let i=0;i<100;i++){if(await page.evaluate(()=>Boolean(qa.library)))return;await page.clock.runFor(25);}throw new Error('App library did not mount');};
 await page.clock.install({time:new Date('2026-10-09T12:00:00Z')});await page.clock.pauseAt(new Date('2026-10-09T12:00:01Z'));
 await check('Production App shows only the brief home toast for a real-check-shaped Store update',async()=>{
  await fixture('daily-app-note',1);
  await page.evaluate(()=>{localStorage.removeItem('betternote_update_attempt_v2');localStorage.removeItem('betternote_update_result_v2');localStorage.removeItem('betternote_update_notice_v2');electronAPI.getAppInfo=async()=>({version:'1.2.1',distribution:'store'});qa.nativeUpdateCalls=0;electronAPI.checkStoreUpdate=async()=>{qa.nativeUpdateCalls++;return{success:true,status:'available',hasUpdate:true};};qa.mountApp();});
  await homeReady();await page.clock.runFor(15001);await page.locator('.bn-update-toast').waitFor();
  assert.equal(await page.locator('.bn-update-modal-backdrop').count(),0);assert.equal(await page.evaluate(()=>qa.nativeUpdateCalls),1);
  await page.clock.runFor(5001);assert.equal(await page.locator('.bn-update-toast').count(),0);
 });
 await check('Production App persists once-daily checks and notices across remount',async()=>{
  await page.evaluate(()=>qa.mountApp());await homeReady();await page.clock.runFor(15001);
  assert.equal(await page.locator('.bn-update-toast').count(),0);assert.equal(await page.evaluate(()=>qa.nativeUpdateCalls),1);
 });
};

