'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');

function setup(save){
  const statuses=[],messages=[],S={envelope:{storageRevision:0,packet:{id:'draft',revision:0,offer:{seller:''}}},say:en=>en,repository:{save},dom:{message:text=>messages.push(text)}};
  const window={Sutro:S,addEventListener:()=>{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/core/state.js'),'utf8'),{window,document:{getElementById:()=>null},structuredClone,setTimeout:()=>1,clearTimeout:()=>{}});
  S.setSaveStatus=text=>statuses.push(text);
  return {S,statuses,messages};
}
function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}

test('flush waits for edits made during a write and advances transactional revisions',async()=>{
  const writes=[],{S,statuses}=setup((snapshot,expected)=>{const gate=deferred();writes.push({snapshot,expected,gate});return gate.promise;});
  S.envelope.packet.offer.seller='First edit';S.markChanged();const first=S.flush();await Promise.resolve();
  S.envelope.packet.offer.seller='Latest edit';S.markChanged();assert.equal(S.flush(),first);
  writes[0].gate.resolve({storageRevision:1,savedAt:'first'});await new Promise(setImmediate);
  assert.equal(writes.length,2);assert.equal(writes[0].snapshot.packet.offer.seller,'First edit');
  assert.equal(writes[1].snapshot.packet.offer.seller,'Latest edit');assert.equal(writes[1].expected,1);
  assert.equal(S.saving,true);assert.ok(!statuses.includes('Saved on this device'));
  writes[1].gate.resolve({storageRevision:2,savedAt:'latest'});await first;
  assert.equal(S.envelope.storageRevision,2);assert.equal(S.dirty,false);assert.equal(S.saving,false);
  assert.equal(statuses.at(-1),'Saved on this device');
});

test('a failed write preserves the latest draft and retries without advancing its revision',async()=>{
  const gate=deferred(),writes=[];let fail=true;
  const {S,statuses,messages}=setup((snapshot,expected)=>{writes.push({snapshot,expected});return fail?gate.promise:Promise.resolve({storageRevision:expected+1,savedAt:'retry'});});
  S.markChanged();const pending=S.flush();await Promise.resolve();
  S.envelope.packet.offer.seller='Recover this';S.markChanged();gate.reject(new Error('save-failed'));
  await assert.rejects(pending,/save-failed/);assert.equal(S.dirty,true);assert.equal(S.saving,false);assert.equal(S.envelope.storageRevision,0);
  assert.match(statuses.at(-1),/Save failed/);assert.match(messages[0],/export/);
  fail=false;await S.flush();assert.equal(writes[1].snapshot.packet.offer.seller,'Recover this');assert.equal(writes[1].expected,0);assert.equal(S.dirty,false);
});

test('a cross-tab conflict leaves a recoverable unsaved draft',async()=>{
  const {S,messages}=setup(async()=>{throw new Error('case-conflict');});
  S.markChanged();await assert.rejects(S.flush(),/case-conflict/);
  assert.equal(S.dirty,true);assert.equal(S.envelope.storageRevision,0);assert.match(messages[0],/Another tab/);
});
