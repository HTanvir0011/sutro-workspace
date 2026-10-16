'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite'),{createAPI}=require('../server/api');
test('catalog policy, bounded records, restricted IDs, version changes and missing catalog fail closed',async t=>{
  const runtime=fs.mkdtempSync(path.join(os.tmpdir(),'sutro-catalog-'));let api;t.after(async()=>{await api?.close();fs.rmSync(runtime,{recursive:true,force:true});});
  const revision='a'.repeat(20),file='catalog-'+revision+'.sqlite';const db=new DatabaseSync(path.join(runtime,file));
  db.exec('CREATE TABLE datasets(id TEXT,version TEXT,domain TEXT,license TEXT);CREATE TABLE records(id TEXT,dataset TEXT,kind TEXT,source_id TEXT,title TEXT,search_text TEXT,survey TEXT,year INTEGER,split TEXT,access TEXT,asset_id TEXT,land_id TEXT);CREATE INDEX list_idx ON records(access,id);CREATE TABLE assets(id TEXT,dataset TEXT,relative_path TEXT,sha256 TEXT,kind TEXT,width INTEGER,height INTEGER,access TEXT);');
  db.prepare('INSERT INTO datasets VALUES(?,?,?,?)').run('fixture','v1','synthetic','MIT');
  for(let i=1;i<=5;i++)db.prepare('INSERT INTO records VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(String(i).padStart(32,'0'),'fixture','packet','p'+i,'Synthetic '+i,'synthetic '+i,'',null,'train',i===5?'restricted':'local-review-only',null,null);
  db.close();fs.writeFileSync(path.join(runtime,'active.json'),JSON.stringify({schemaVersion:1,revision,file}));
  api=createAPI({runtime});
  const caps=await api.query('capabilities');assert.equal(caps.datasets[0].records,4);assert.equal(caps.fullCorpusAccepted,false);
  const list=await api.query('list',{limit:2});assert.equal(list.items.length,2);assert.equal(list.last,'2'.padStart(32,'0'));
  await assert.rejects(api.query('detail',{id:'5'.padStart(32,'0')}),e=>e.status===404);assert.equal(api.ready(),true);
  await assert.rejects(api.query('list',{limit:2,revision:'b'.repeat(20)}),e=>e.status===410);
  fs.renameSync(path.join(runtime,'active.json'),path.join(runtime,'inactive.json'));await assert.rejects(api.query('capabilities'),e=>e.status===503);
});
