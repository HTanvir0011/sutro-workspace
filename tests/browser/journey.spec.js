'use strict';
const {test,expect}=require('@playwright/test'),fs=require('node:fs');
test.beforeEach(async({context})=>{await context.addInitScript(()=>{if(!localStorage.getItem('sutro.lang'))localStorage.setItem('sutro.lang','en');});});
async function png(page){return Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=20;c.getContext('2d').fillRect(0,0,20,20);return c.toDataURL().split(',')[1];}),'base64');}
function pdf(){
  const streams=['BT /F1 18 Tf 30 340 Td (Synthetic page one) Tj ET','BT /F1 18 Tf 30 340 Td (Synthetic page two) Tj ET'];
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Count 2 /Kids [3 0 R 5 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${streams[0].length} >>\nstream\n${streams[0]}\nendstream`,
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>',
    `<< /Length ${streams[1].length} >>\nstream\n${streams[1]}\nendstream`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  let text='%PDF-1.7\n',offsets=[0];objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(text));text+=`${i+1} 0 obj\n${object}\nendobj\n`;});
  const start=Buffer.byteLength(text);text+=`xref\n0 8\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF\n`;return Buffer.from(text);
}

test('a new buyer can identify land, review evidence, reach findings and prepare a report',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/setup.html');expect(await page.evaluate(()=>window.Sutro.repository.list())).toEqual([]);
  await page.getByLabel('District (optional)',{exact:true}).fill('Test district');await page.getByLabel('Upazila (optional)',{exact:true}).fill('Test upazila');
  await page.getByLabel('Mouza',{exact:true}).fill('Test mouza');await page.getByLabel('Survey on your document',{exact:true}).selectOption('BS');await page.getByLabel('Selected dag number',{exact:true}).fill('00123');
  await page.getByLabel('Seller',{exact:true}).fill('Test seller');await page.getByLabel('Area offered (decimals)',{exact:true}).fill('50');
  await page.getByRole('button',{name:'Continue to documents →',exact:true}).click();await expect(page).toHaveURL(/intake.html\?case=case-/);
  await expect(page.getByRole('heading',{name:'Documents for this plot',exact:true})).toBeVisible();const caseId=await page.evaluate(()=>window.Sutro.envelope.packet.id);
  await page.getByRole('button',{name:'+ Add document',exact:true}).click();const editor=page.locator('#document-editor');
  await editor.getByLabel('Khatian no.',{exact:true}).fill('0007');await editor.getByLabel('Year',{exact:true}).fill('2020');await editor.getByLabel('Area (decimals)',{exact:true}).fill('100');await editor.getByLabel('Name',{exact:true}).fill('Test seller');await editor.getByLabel('Share (e.g. 1/2)',{exact:true}).fill('1');
  await page.locator('#attach-image').setInputFiles({name:'synthetic-scan.png',mimeType:'image/png',buffer:await png(page)});await expect(page.locator('.source-image')).toBeVisible();
  await page.getByRole('link',{name:'Review evidence →',exact:true}).click();await expect(page.getByRole('button',{name:'Analyze this evidence →',exact:true})).toBeDisabled();
  // Navigation within the case retains private, in-memory source pages.
  await page.locator('.steps a[href^="intake"]').click();await expect(page.locator('.source-image')).toBeVisible();
  await editor.getByLabel('I compared these fields with the source.',{exact:true}).check();
  await editor.getByLabel('Area (decimals)',{exact:true}).fill('101');await expect(editor.getByRole('checkbox')).not.toBeChecked();await editor.getByLabel('Area (decimals)',{exact:true}).fill('100');
  await page.getByRole('link',{name:'Review evidence →',exact:true}).click();await page.locator('.review-document input[type=checkbox]').check();
  await page.getByRole('button',{name:'Analyze this evidence →',exact:true}).click();await expect(page).toHaveURL(/audit.html/);await expect(page.locator('#case-readiness')).toHaveText('Findings available');
  await expect(page.locator('.comparison-panel')).toContainText('Accounted for by supplied history');
  await page.locator('.next-actions input[type=checkbox]').first().check();await expect(page.locator('#save-status')).toHaveText('Saved on this device');await expect(page.locator('#case-readiness')).toHaveText('Findings available');
  await page.getByRole('link',{name:'Prepare report →',exact:true}).click();await expect(page.getByRole('button',{name:'Print / save PDF',exact:true})).toBeEnabled();
  expect(await page.locator('a[href="report.html?case='+caseId+'"]').count()).toBe(1); // Only the workflow step, no self-referencing next action.
  await expect(page.locator('.report-cover')).toContainText('Test district');await expect(page.locator('.source-register')).toContainText('1 attached file');
  const download=page.waitForEvent('download');await page.locator('.report-actions').getByRole('button',{name:'Back up including scans',exact:true}).click();const backup=JSON.parse(fs.readFileSync(await(await download).path(),'utf8'));
  expect(backup.backup.scans).toHaveLength(1);expect(backup.packet.plot.dags.BS).toBe('00123');
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));await page.screenshot({path:'docs/implementation/screenshots/flow-report-1280.png',fullPage:true});
  await page.emulateMedia({media:'print'});await page.evaluate(()=>document.querySelectorAll('main details').forEach(d=>d.open=true));await expect(page.locator('.case-context')).toBeHidden();await expect(page.locator('.report-cover')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'docs/implementation/screenshots/flow-report-print.png',fullPage:true});await page.emulateMedia({media:'screen'});
  await page.goto('/workspace.html');await page.locator('#import-case').setInputFiles({name:'case.backup.sutro.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await page.getByRole('dialog').getByRole('button',{name:'Restore case and scans',exact:true}).click();await expect(page).toHaveURL(/intake.html\?case=import-/);await expect(page.locator('.source-image')).toBeVisible();await expect(page.getByLabel('Keep scan on this device',{exact:true})).toBeChecked();
  expect(await page.evaluate(()=>window.Sutro.envelope.metadata.analysisRevision)).toBeUndefined();expect(errors).toEqual([]);
});

test('PDF pages and multiple source files render locally without external requests',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/intake.html?case=demo-a');
  await page.locator('#attach-image').setInputFiles([{name:'image.png',mimeType:'image/png',buffer:await png(page)},{name:'two-pages.pdf',mimeType:'application/pdf',buffer:pdf()}]);
  await page.getByLabel('Source file',{exact:true}).selectOption('1');
  await expect(page.locator('.pdf-preview canvas')).toBeVisible();await expect(page.locator('.pdf-preview [role=status]')).toHaveText('Page 1 of 2');
  await page.getByRole('button',{name:'Next page',exact:true}).click();await expect(page.locator('.pdf-preview [role=status]')).toHaveText('Page 2 of 2');
  await page.getByRole('button',{name:'Read a crop from this page',exact:true}).click();await expect(page.getByRole('dialog',{name:'Read & review a crop',exact:true})).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
  await page.getByLabel('Source file',{exact:true}).selectOption('0');await expect(page.locator('.source-image')).toBeVisible();
  await page.getByRole('button',{name:'Zoom in',exact:true}).click();await expect(page.locator('.source-image')).toHaveCSS('transform',/matrix\(1.25/);
  const external=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>new URL(r.name).origin!==location.origin).map(r=>r.name));expect(external).toEqual([]);expect(errors).toEqual([]);
});

test('the example gallery uses bilingual search and exposes only supported controls',async({page})=>{
  await page.goto('/library.html');await expect(page.locator('.record-card')).toHaveCount(3);await expect(page.locator('select')).toHaveCount(0);
  await page.getByLabel('Find an example',{exact:true}).fill('জামাল');await expect(page.locator('.record-card')).toHaveCount(1);
  await page.getByLabel('Find an example',{exact:true}).fill('');await expect(page.locator('.record-card')).toHaveCount(3);
  await page.screenshot({path:'docs/implementation/screenshots/flow-library-1280.png',fullPage:true});
});

test('incomplete and imported cases cannot masquerade as prepared reports',async({page})=>{
  await page.goto('/report.html');await expect(page.getByRole('heading',{name:'Choose a case to continue',exact:true})).toBeVisible();expect(await page.evaluate(()=>window.Sutro.repository.list())).toEqual([]);
  await page.goto('/workspace.html');
  const id=await page.evaluate(async()=>{const S=window.Sutro,raw={schemaVersion:1,packet:S.DEMO_PACKETS[1],metadata:{analysisRevision:0,review:{}}},e=S.validation.importJSON(JSON.stringify(raw));e.packet.id='import-readiness-test';await S.repository.save(e,0);return e.packet.id;});
  await page.goto('/report.html?case='+id);await expect(page.getByRole('heading',{name:'Incomplete analysis preview',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Print / save PDF',exact:true})).toBeDisabled();await expect(page.locator('.report-cover')).toContainText('DRAFT');
  await page.goto('/review.html?case='+id);await expect(page.getByRole('button',{name:'Analyze this evidence →',exact:true})).toBeDisabled();
});

test('leaving with session pages offers an explicit retained copy',async({page})=>{
  await page.goto('/intake.html?case=demo-a');await page.locator('#attach-image').setInputFiles({name:'session-source.png',mimeType:'image/png',buffer:await png(page)});await expect(page.locator('.source-image')).toBeVisible();
  await page.locator('.backlink').click();await expect(page.getByRole('dialog',{name:'Keep your attached pages before leaving?',exact:true})).toBeVisible();expect(page.url()).toContain('/intake.html');
  await page.getByRole('button',{name:'Keep scans and continue',exact:true}).click();await expect(page).toHaveURL(/workspace.html$/);
  await page.locator('.case-card h2 a').click();await expect(page.getByRole('heading',{name:'Review your evidence',exact:true})).toBeVisible();await page.locator('.steps a[href^="intake"]').click();await expect(page.locator('.source-image')).toBeVisible();await expect(page.getByLabel('Keep scan on this device',{exact:true})).toBeChecked();
});

test('a slower prior record response cannot replace the selected record',async({page})=>{
  // Local-full provider fixture, isolated to this test; no production response is fabricated.
  await page.route('**/health/live',route=>route.fulfill({json:{profile:'local-full'}}));
  await page.route('**/api/v1/capabilities',route=>route.fulfill({json:{profile:'local-full',capabilities:['packet'],datasets:[{id:'fixture',domain:'synthetic'}]}}));
  await page.route('**/api/v1/records?**',route=>route.fulfill({json:{version:'fixture',items:[{id:'first',title:'First record',kind:'packet'},{id:'second',title:'Second record',kind:'packet'}],nextCursor:null}}));
  await page.goto('/library.html');await expect(page.locator('.record-card')).toHaveCount(2);
  await page.evaluate(()=>{const S=window.Sutro;S.provider.detail=id=>id==='first'?new Promise(resolve=>{window.finishFirstRecord=()=>resolve({id,title:'First record',kind:'packet'});}):Promise.resolve({id,title:'Second record',kind:'packet'});S.provider.relationships=async()=>({items:[]});});
  await page.locator('.record-card').first().getByRole('button',{name:'Inspect record →',exact:true}).click();
  await page.locator('.record-card').nth(1).getByRole('button',{name:'Inspect record →',exact:true}).click();await expect(page.locator('.record-detail h2')).toHaveText('Second record');
  await page.evaluate(()=>window.finishFirstRecord());await expect(page.locator('.record-detail h2')).toHaveText('Second record');
});

test('public and case screens fit small widths and the home shows a calculated example',async({page})=>{
  for(const width of [320,390,768,1280]){
    await page.setViewportSize({width,height:900});
    for(const route of ['index','setup','review','audit','report','library']){
      await page.goto('/'+route+'.html'+(['review','audit','report'].includes(route)?'?case=demo-b':''));await expect(page.locator('h1')).toHaveCount(1);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route+' '+width).toBe(true);
    }
  }
  await page.goto('/index.html');await expect(page.locator('.preview-metrics')).toContainText('15');
  await page.screenshot({path:'docs/implementation/screenshots/flow-home-1280.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Menu',exact:true}).click();await page.getByRole('button',{name:'বাংলা',exact:true}).click();await expect(page.locator('html')).toHaveAttribute('lang','bn');await page.screenshot({path:'docs/implementation/screenshots/flow-home-bn-390.png',fullPage:true});
});
