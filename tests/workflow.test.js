'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {Fraction}=require('../js/fraction'),{analyze}=require('../js/engine'),validation=require('../js/core/validation'),{DEMO_PACKETS}=require('../js/demo-packets');
function setup(){const S={Fraction,analyze,validation,say:en=>en};vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../js/core/workflow.js'),'utf8'),{window:{Sutro:S},document:{querySelector:()=>null}});return S;}
function envelope(){return {packet:{...structuredClone(DEMO_PACKETS[1]),revision:0},metadata:{origin:'manual',review:{}}};}

test('a populated case requires explicit document review and analysis of the current revision',()=>{
  const S=setup(),e=envelope();let w=S.workflow.inspect(e);assert.equal(w.ready,true);assert.equal(w.reviewed,false);assert.equal(w.analyzed,false);
  for(const d of e.packet.docs)e.metadata.review[d.id+'.document']={status:'user-reviewed'};
  w=S.workflow.inspect(e);assert.equal(w.state,'ready');
  e.metadata.analysisRevision=e.packet.revision;assert.equal(S.workflow.inspect(e).state,'findings');
  e.packet.revision++;assert.equal(S.workflow.inspect(e).analyzed,false);
  S.envelope=e;S.workflow.invalidateDocument(e.packet.docs[0].id);assert.equal(S.workflow.inspect(e).reviewed,false);
});

test('missing plot, zero area and incomplete document rows cannot become report-ready',()=>{
  const S=setup(),e=envelope();e.packet.plot.dags={};e.packet.offer.area='0';e.packet.docs[0].owners[0].name='';
  for(const d of e.packet.docs)e.metadata.review[d.id+'.document']={status:'user-reviewed'};
  e.metadata.analysisRevision=e.packet.revision;const w=S.workflow.inspect(e);
  assert.equal(w.ready,false);assert.equal(w.analyzed,false);assert.ok(w.issues.some(i=>i.key==='dag'));assert.ok(w.issues.some(i=>i.key==='area'));assert.ok(w.issues.some(i=>i.key==='required:'+e.packet.docs[0].id));
});

test('location survives imports while externally supplied analysis and review approvals are discarded',()=>{
  const S=setup(),e=envelope();e.packet.plot.district='Test district';e.packet.plot.upazila='Test upazila';e.metadata.analysisRevision=e.packet.revision;
  for(const d of e.packet.docs)e.metadata.review[d.id+'.document']={status:'user-reviewed'};
  const imported=validation.importJSON(JSON.stringify({schemaVersion:1,...e}));
  assert.equal(imported.packet.plot.district,'Test district');assert.equal(imported.packet.plot.upazila,'Test upazila');assert.equal(S.workflow.inspect(imported).reviewed,false);assert.equal(imported.metadata.analysisRevision,undefined);
});
