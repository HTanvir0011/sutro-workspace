'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const v=require('../js/core/validation'),{DEMO_PACKETS}=require('../js/demo-packets'),{snapshot}=require('../scripts/baseline-snapshot');
const clone=x=>structuredClone(x);
test('baseline exact results remain unchanged apart from documented engine version and new exclusion diagnostics',()=>{const baseline=require('../docs/implementation/engine-baseline.json');for(const item of baseline){const current=snapshot(DEMO_PACKETS.find(p=>p.id===item.id));delete current.excludedDocuments;current.engineVersion=item.result.engineVersion;assert.deepEqual(current,item.result);}});
test('one-case imports preserve exact strings and IDs but strip authority and evaluator claims',()=>{const p=clone(DEMO_PACKETS[0]);p.plot.jl='00045';p.offer.area='৭/৪০';p.labels={expected:'clean'};p.access='public-approved';const result=v.importJSON(JSON.stringify(p));assert.equal(result.packet.plot.jl,'00045');assert.equal(result.packet.offer.area,'৭/৪০');assert.equal(result.metadata.origin,'imported');assert.equal(result.packet.labels,undefined);assert.equal(result.packet.access,undefined);});
test('schema rejects poison keys, invalid types, duplicate IDs, years and huge fractions',()=>{
  assert.throws(()=>v.importJSON('{"__proto__":{}}'),/unsafe-key/);
  for(const mutate of [p=>p.docs.push(clone(p.docs[0])),p=>p.title={en:{}},p=>p.asOfYear='2026suffix',p=>p.offer.area='9'.repeat(65),p=>p.docs[0].owners={},p=>p.docs[0].id='bad#selector',p=>p.docs[0].owners[0].share='-1/2']){const p=clone(DEMO_PACKETS[0]);mutate(p);assert.throws(()=>v.importJSON(JSON.stringify(p)));}
  assert.throws(()=>v.importJSON(JSON.stringify({schemaVersion:99,packet:DEMO_PACKETS[0]})),/unsupported-version/);
  assert.throws(()=>v.importJSON(JSON.stringify({schemaVersion:1,packet:{...DEMO_PACKETS[0],schemaVersion:99}})),/unsupported-version/);
});
test('Bangla numeric normalization is strict and preserves identifier strings',()=>{assert.equal(v.year('১৯৬২'),1962);for(const bad of ['0','2026x','2201','1599'])assert.throws(()=>v.year(bad));assert.equal(v.rational(' ৭ / ৪০ ','share'),' ৭ / ৪০ ');});
