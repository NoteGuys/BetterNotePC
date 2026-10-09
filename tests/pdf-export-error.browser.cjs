const assert=require('node:assert/strict');
module.exports=async({page})=>{
 const languages=['en','th','zh','ru'];
 for(const language of languages){
  await page.evaluate(language=>qa.mountExportError(language),language);
  await page.locator('#qa-export-error').getByRole('button').nth(2).click();
  await page.waitForFunction(()=>typeof qa.exportAlert==='string');
  const result=await page.evaluate(()=>({alert:qa.exportAlert,expected:qa.i18n.t('exportDialogPdfRange','',{first:1,last:3})}));
  assert.ok(result.alert.includes(result.expected));assert.ok(result.alert.includes('1')&&result.alert.includes('3'));
  assert.ok(!result.alert.includes('{first}')&&!result.alert.includes('{last}'));
  await page.evaluate(()=>qa.unmountExportError());
 }
 console.log('PASS PDF export error UI: failed native load displays the actual page range in all four languages');
 return 1;
};
