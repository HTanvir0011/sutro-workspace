'use strict';
const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
test('bilingual responsive shells, inert labels, CSP, exact engine results and case reload',async({page,context})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const width of [320,390,768,1280]){
    await page.setViewportSize({width,height:900});
    for(const name of ['index','workspace','intake','timeline','audit','report','library','about','models','ocr']){
      await page.goto('/'+name+'.html?case=demo-b');
      await expect(page.locator('h1')).toHaveCount(1);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' at '+width).toBe(true);
    }
  }
  await page.goto('/intake.html?case=demo-b');
  await page.evaluate(()=>{const S=window.Sutro;S.envelope.packet.title.en=S.envelope.packet.title.bn='<img src=x onerror=alert(1)>';S.markChanged();});
  await page.getByRole('button',{name:'English',exact:true}).click();
  await expect(page.locator('html')).toHaveAttribute('lang','en');
  await expect(page.locator('.case-context strong')).toHaveText('<img src=x onerror=alert(1)>');
  expect(await page.locator('.case-context img').count()).toBe(0);
  const seller=page.getByLabel('Seller',{exact:true});await seller.fill('Reviewed person');await expect(page.locator('#save-status')).toHaveText('Saved on this device');
  await page.reload();await expect(seller).toHaveValue('Reviewed person');
  await page.goto('/audit.html?case=demo-a');
  expect(await page.evaluate(()=>window.Sutro.analyze(window.Sutro.envelope.packet).offer.chain.held.toString())).toBe('35');
  await page.goto('/library.html');await expect(page.locator('.record-card')).toHaveCount(3);
  const external=await page.evaluate(()=>performance.getEntriesByType('resource').filter(r=>new URL(r.name).origin!==location.origin).map(r=>r.name));expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
test('transaction conflict and retained legacy migration are explicit',async({page})=>{
  await page.goto('/workspace.html');
  const result=await page.evaluate(async()=>{const S=window.Sutro,e=S.newCase();const first=await S.repository.save(e,0);try{await S.repository.save(e,0);return 'bad';}catch(error){return error.message;}});expect(result).toBe('case-conflict');
  const migration=await page.evaluate(async()=>{const S=window.Sutro,raw=JSON.stringify({packets:S.DEMO_PACKETS});localStorage.setItem('sutro.packets.v1',raw);await S.repository.migrate();return {retained:localStorage.getItem('sutro.packets.v1')===raw,saved:!!await S.repository.get('demo-c')};});expect(migration).toEqual({retained:true,saved:true});
});

test('a blocked storage upgrade can be retried after the older tab closes',async({page,context})=>{
  await context.addInitScript(()=>{
    localStorage.setItem('sutro.lang','en');
    window.olderDatabase=new Promise((resolve,reject)=>{const q=indexedDB.open('sutro',1);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
  });
  await page.goto('/workspace.html');
  await expect(page.getByRole('heading',{name:'This view could not be opened.'})).toBeVisible();
  const rows=await page.evaluate(async()=>{(await window.olderDatabase).close();return window.Sutro.repository.list();});
  expect(rows).toEqual([]);
});

test('navigation waits for edits made during an earlier save',async({page,context})=>{
  await context.addInitScript(()=>localStorage.setItem('sutro.lang','en'));
  await page.goto('/intake.html?case=demo-b');
  await page.evaluate(()=>{const S=window.Sutro,save=S.repository.save;window.saveGates=[];S.repository.save=async(...args)=>{await new Promise(resolve=>window.saveGates.push(resolve));return save(...args);};});
  const seller=page.getByLabel('Seller',{exact:true});await seller.fill('Earlier edit');
  await expect.poll(()=>page.evaluate(()=>window.saveGates.length)).toBe(1);
  await seller.fill('Latest edit');
  await page.getByRole('link',{name:'Review evidence →',exact:true}).dispatchEvent('click');
  await page.evaluate(()=>window.saveGates.shift()());
  await expect.poll(()=>page.evaluate(()=>window.saveGates.length)).toBe(1);
  expect(page.url()).toContain('/intake.html');
  await page.evaluate(()=>window.saveGates.shift()());
  await expect(page).toHaveURL(/\/review.html\?case=demo-b$/);
  await page.goto('/intake.html?case=demo-b');await expect(seller).toHaveValue('Latest edit');
});

test('failed saves keep an exportable draft, retry, and import without review authority',async({page,context})=>{
  await context.addInitScript(()=>localStorage.setItem('sutro.lang','en'));
  await page.goto('/intake.html?case=demo-a');
  await page.evaluate(()=>{const S=window.Sutro;window.originalSave=S.repository.save;S.repository.save=async()=>{throw new DOMException('Storage quota exceeded','QuotaExceededError');};});
  await page.getByLabel('Seller',{exact:true}).fill('Recoverable draft');
  await expect(page.locator('#save-status')).toHaveText('Save failed — retry or export');
  expect(await page.evaluate(()=>window.Sutro.dirty)).toBe(true);
  const expected=await page.evaluate(()=>window.Sutro.envelope.packet);
  const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Export case',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Case data only',exact:true}).click();
  const exported=JSON.parse(fs.readFileSync(await (await downloading).path(),'utf8'));
  expect(exported.packet).toEqual(expected);expect(exported.schemaVersion).toBe(1);
  await page.evaluate(()=>{window.Sutro.repository.save=window.originalSave;});
  await page.getByRole('button',{name:'Retry save',exact:true}).click();
  await expect(page.locator('#save-status')).toHaveText('Saved on this device');
  await page.goto('/workspace.html');
  exported.metadata.review={field:{status:'user-reviewed',origin:'ocr'}};
  await page.locator('#import-case').setInputFiles({name:'draft.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});
  const dialog=page.getByRole('dialog',{name:'Import one case'});await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(`${expected.docs.length} documents`);
  await dialog.getByRole('button',{name:'Add case',exact:true}).click();
  await expect(page).toHaveURL(/\/intake.html\?case=import-/);
  await expect(page.getByLabel('Seller',{exact:true})).toHaveValue('Recoverable draft');
  const imported=await page.evaluate(()=>window.Sutro.envelope);
  expect(imported.packet.id).not.toBe(expected.id);expect(imported.packet.docs).toEqual(expected.docs);
  expect(imported.metadata.review).toEqual({});expect(imported.metadata.origin).toBe('imported');
});

test('scans default to session-only, persist by choice, and leave no document residue',async({page,context})=>{
  await context.addInitScript(()=>localStorage.setItem('sutro.lang','en'));
  await page.goto('/intake.html?case=demo-a');
  const png=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=2;canvas.getContext('2d').fillRect(0,0,2,2);return canvas.toDataURL().split(',')[1];});
  const attach=()=>page.locator('#attach-image').setInputFiles({name:'scan.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  const scan=page.locator('.source-image'),retention=page.getByLabel('Keep scan on this device',{exact:true});
  await attach();await expect(scan).toBeVisible();await expect(retention).not.toBeChecked();
  await expect(page.locator('#save-status')).toHaveText('Saved on this device');
  await page.reload();await expect(scan).toHaveCount(0);
  await attach();await expect(scan).toBeVisible();await retention.check();await expect(page.locator('.source-panel')).toContainText('Persistent local scan');
  await expect(page.locator('#save-status')).toHaveText('Saved on this device');await page.reload();await expect(scan).toBeVisible();
  // A failed opt-out must preserve the actual retained choice and the stored blob.
  await page.evaluate(()=>{const S=window.Sutro;window.originalDelete=S.repository.scanDelete;S.repository.scanDelete=async()=>{throw new Error('storage-failed');};});
  await retention.click();await expect(retention).toBeChecked();await expect(page.locator('#feedback')).toContainText('previous storage choice is unchanged');
  await page.evaluate(()=>{window.Sutro.repository.scanDelete=window.originalDelete;});
  await retention.uncheck();await expect(scan).toBeVisible();await expect(page.locator('.source-panel')).toContainText('Session-only');
  await page.locator('.doc-tab').nth(1).click();await page.locator('.doc-tab').first().click();await expect(scan).toBeVisible();
  const removedId=await page.evaluate(()=>window.Sutro.envelope.packet.docs[0].id);
  await page.locator('#document-editor').getByRole('button',{name:'Remove',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Confirm',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(id=>{const S=window.Sutro,key=S.envelope.packet.id+':'+id;return {session:!!S.sessionScans?.[key],metadata:!!S.envelope.metadata.attachments[id]};},removedId)).toEqual({session:false,metadata:false});
  await expect(page.locator('#save-status')).toHaveText('Saved on this device');await page.reload();await expect(scan).toHaveCount(0);
});

test('an interrupted migration retains originals and resumes without replacing saved cases',async({page})=>{
  await page.goto('/workspace.html');
  const result=await page.evaluate(async()=>{
    const S=window.Sutro,raw=JSON.stringify({packets:S.DEMO_PACKETS});localStorage.setItem('sutro.packets.v1',raw);
    // Abort the second write transaction to model a storage failure after the first commit.
    const transaction=IDBDatabase.prototype.transaction;let writes=0;
    IDBDatabase.prototype.transaction=function(...args){const tx=transaction.apply(this,args);if(args[0]==='cases'&&args[1]==='readwrite'&&++writes===2)queueMicrotask(()=>tx.abort());return tx;};
    let rejected=false;try{await S.repository.migrate();}catch{rejected=true;}finally{IDBDatabase.prototype.transaction=transaction;}
    const retained=localStorage.getItem('sutro.packets.v1')===raw,first=await S.repository.get('demo-a');
    const resumed=await S.repository.migrate();return {rejected,retained,firstRevision:first.storageRevision,resumed:resumed.status,afterRevision:(await S.repository.get('demo-a')).storageRevision,all:(await S.repository.list()).length};
  });
  expect(result).toEqual({rejected:true,retained:true,firstRevision:1,resumed:'verified',afterRevision:1,all:3});
});

test('clearing local cases is atomic and keeps recovery originals when storage aborts',async({page})=>{
  await page.goto('/workspace.html');
  const result=await page.evaluate(async()=>{
    const S=window.Sutro,raw=JSON.stringify({packets:S.DEMO_PACKETS});localStorage.setItem('sutro.packets.v1',raw);await S.repository.migrate();
    await S.repository.scanPut('demo-a:scan',new Blob(['test scan']));
    const transaction=IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction=function(...args){const tx=transaction.apply(this,args);if(Array.isArray(args[0])&&args[0].length===3&&args[1]==='readwrite')queueMicrotask(()=>tx.abort());return tx;};
    let rejected=false;try{await S.repository.clear();}catch{rejected=true;}finally{IDBDatabase.prototype.transaction=transaction;}
    const afterFailure={cases:(await S.repository.list()).length,scan:!!await S.repository.scanGet('demo-a:scan'),original:localStorage.getItem('sutro.packets.v1')===raw};
    await S.repository.clear();return {rejected,afterFailure,afterClear:{cases:(await S.repository.list()).length,scan:!!await S.repository.scanGet('demo-a:scan'),original:localStorage.getItem('sutro.packets.v1')!==null}};
  });
  expect(result).toEqual({rejected:true,afterFailure:{cases:3,scan:true,original:true},afterClear:{cases:0,scan:false,original:false}});
});

test('OCR candidates require current crop, current case, and explicit review',async({page,context})=>{
  await context.addInitScript(()=>localStorage.setItem('sutro.lang','en'));
  await page.goto('/intake.html?case=demo-a');
  await page.evaluate(()=>{
    const S=window.Sutro;window.ocrGates=[];
    // Isolated UI fixture; no model-quality claim is made by this test.
    S.ocrClient.recognize=bitmap=>{bitmap.close();return new Promise(resolve=>window.ocrGates.push(()=>resolve({text:'00123',version:'test-fixture',sha256:'test-only'})));};
  });
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=20;return c.toDataURL().split(',')[1];});
  await page.locator('#attach-image').setInputFiles({name:'crop.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
  await expect(page.locator('.source-image')).toBeVisible();
  await page.getByRole('button',{name:'Read a crop',exact:true}).click();
  let dialog=page.getByRole('dialog'),run=dialog.getByRole('button',{name:'Read selected crop',exact:true}),candidate=dialog.getByLabel('Recognized candidate (editable)',{exact:true});
  await run.click();await expect.poll(()=>page.evaluate(()=>window.ocrGates.length)).toBe(1);
  await dialog.getByLabel('width',{exact:true}).fill('10');await page.evaluate(()=>window.ocrGates.shift()());
  await expect(dialog.locator('[role=status]')).toContainText('stale-crop-selection');await expect(candidate).toHaveValue('');
  await run.click();await expect.poll(()=>page.evaluate(()=>window.ocrGates.length)).toBe(1);await page.evaluate(()=>window.ocrGates.shift()());
  await expect(candidate).toHaveValue('00123');
  const before=await page.evaluate(()=>window.Sutro.envelope.packet.docs[0].khatianNo);
  await dialog.getByRole('button',{name:'Apply reviewed value',exact:true}).click();
  expect(await page.evaluate(()=>window.Sutro.envelope.packet.docs[0].khatianNo)).toBe(before);
  await dialog.getByRole('checkbox').check();await candidate.fill('00456');await expect(dialog.getByRole('checkbox')).not.toBeChecked();
  await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Apply reviewed value',exact:true}).click();await expect(dialog).toHaveCount(0);
  const applied=await page.evaluate(()=>{const S=window.Sutro,d=S.envelope.packet.docs[0];return {value:d.khatianNo,review:S.envelope.metadata.review[d.id+'.khatianNo']};});
  expect(applied.value).toBe('00456');expect(applied.review).toMatchObject({origin:'ocr',status:'user-reviewed',raw:'00123',value:'00456',crop:{x:0,y:0,width:10,height:20}});
  await page.getByRole('button',{name:'Read a crop',exact:true}).click();dialog=page.getByRole('dialog');
  await dialog.getByRole('button',{name:'Read selected crop',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.ocrGates.length)).toBe(1);
  await page.evaluate(()=>{window.Sutro.markChanged();window.ocrGates.shift()();});
  await expect(dialog.locator('[role=status]')).toContainText('stale-case-revision');
  await expect(dialog.getByLabel('Recognized candidate (editable)',{exact:true})).toHaveValue('');
  await dialog.getByRole('button',{name:'Close',exact:true}).click();await page.evaluate(()=>window.Sutro.flush());
});
