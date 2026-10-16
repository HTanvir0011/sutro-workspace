'use strict';
const {parentPort,workerData}=require('node:worker_threads');
const fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
let db,revision;
function open(){
  const active=JSON.parse(fs.readFileSync(path.join(workerData.runtime,'active.json'),'utf8'));
  if(active.schemaVersion!==1||!/^[a-f0-9]{20}$/.test(active.revision)||active.file!==`catalog-${active.revision}.sqlite`)throw new Error('catalog-invalid');
  if(revision!==active.revision){const next=new DatabaseSync(path.join(workerData.runtime,active.file),{readOnly:true,enableForeignKeyConstraints:true,allowExtension:false});next.exec('PRAGMA query_only=ON; PRAGMA trusted_schema=OFF;');db?.close();db=next;revision=active.revision;}
}
const permitted="access IN ('public-approved','local-review-only')";
function allowed(id){return db.prepare(`SELECT id,dataset,kind,source_id,title,survey,year,split,asset_id,land_id FROM records WHERE id=? AND ${permitted}`).get(id);}
function project(r){return {id:r.id,kind:r.kind,sourceId:r.source_id,title:r.title,survey:r.survey||undefined,year:r.year||undefined,datasetVersion:r.dataset+'@'+db.prepare('SELECT version FROM datasets WHERE id=?').get(r.dataset).version,previewAssetId:r.asset_id||undefined};}
function query(action,input){
  open();if(input.revision&&input.revision!==revision)throw Object.assign(new Error('catalog-version-changed'),{status:410});
  if(action==='capabilities'||action==='datasets'){
    const datasets=db.prepare(`SELECT d.id,d.version,d.domain,d.license,COUNT(r.id) AS records FROM datasets d JOIN records r ON r.dataset=d.id WHERE r.${permitted} GROUP BY d.id,d.version,d.domain,d.license ORDER BY d.id`).all();
    return {schemaVersion:1,profile:'local-full',version:revision,fullCorpusAccepted:false,models:false,datasets,capabilities:['packet','khatian']};
  }
  if(action==='list'){
    const where=[permitted,'id > ?'],args=[input.last||''];
    for(const [key,col]of [['dataset','dataset'],['kind','kind'],['survey','survey'],['split','split']])if(input[key]){where.push(`${col}=?`);args.push(input[key]);}
    const q=((input.q||'')+' '+(input.location||'')).normalize('NFC').trim().toLowerCase();
    if(q){const words=q.split(/\s+/);if(words.length>4)throw Object.assign(new Error('invalid-filter'),{status:400});for(const word of words){where.push('id IN (SELECT record_id FROM record_tokens WHERE token>=? AND token<?)');args.push(word,word+'\u{10ffff}');}}
    const sql=`SELECT id,dataset,kind,source_id,title,survey,year,split,asset_id,land_id FROM records WHERE ${where.join(' AND ')} ORDER BY id LIMIT ?`;
    const rows=db.prepare(sql).all(...args,input.limit+1),more=rows.length>input.limit;rows.length=Math.min(rows.length,input.limit);
    return {version:revision,items:rows.map(project),last:more?rows.at(-1).id:null};
  }
  if(action==='detail'||action==='relationships'||action==='packet'){
    const r=allowed(input.id);if(!r)throw Object.assign(new Error('not-found'),{status:404});
    if(action==='packet'){
      if(r.kind!=='packet')throw Object.assign(new Error('unsupported-mapping'),{status:422});
      const value=db.prepare('SELECT payload FROM packets WHERE id=?').get(input.id);
      return {schemaVersion:1,packet:JSON.parse(value.payload)};
    }
    if(action==='relationships')return {version:revision,items:r.land_id?db.prepare(`SELECT id,dataset,kind,source_id,title,survey,year,split,asset_id,land_id FROM records WHERE land_id=? AND id>? AND ${permitted} ORDER BY id LIMIT ?`).all(r.land_id,input.last||'',input.limit+1).slice(0,input.limit).map(project):[],nextCursor:null};
    const out=project(r);out.version=revision;out.license=db.prepare('SELECT license FROM datasets WHERE id=?').get(r.dataset).license;
    if(r.kind==='khatian'){
      const k=db.prepare('SELECT area,khatian_no,image_id,land_id FROM khatians WHERE id=?').get(r.id);out.totalKhatianArea=k.area;out.khatianNo=k.khatian_no;
      out.location=db.prepare('SELECT division,district,upazila,mouza,jl FROM lands WHERE id=?').get(k.land_id);
      out.owners=db.prepare('SELECT id,name,share,printed_share AS printedShare FROM owners WHERE khatian_id=? ORDER BY source_row LIMIT 100').all(r.id);
      out.dagRows=db.prepare('SELECT id,dag,land_class AS landClass,total_acre AS totalAcre,total_dec AS totalDecimals,share_in_dag AS shareInDag,area_acre AS areaAcre,area_dec AS areaDecimals FROM dag_rows WHERE khatian_id=? ORDER BY row_index LIMIT 100').all(r.id);
      out.fields=db.prepare('SELECT field_type AS field,row_index AS row,text,polygon FROM field_annotations WHERE asset_id=? ORDER BY field_type,row_index,id LIMIT 100').all(k.image_id).map(f=>({...f,polygon:JSON.parse(f.polygon)}));
      const dimensions=db.prepare('SELECT width,height FROM assets WHERE id=?').get(k.image_id);out.dimensions=dimensions;
    }
    return out;
  }
  if(action==='asset'){
    const asset=db.prepare(`SELECT id,dataset,relative_path,sha256,kind,width,height,access FROM assets WHERE id=? AND ${permitted}`).get(input.id);
    if(!asset||!['.jpg','.png'].includes(asset.kind))throw Object.assign(new Error('not-found'),{status:404});return {version:revision,...asset};
  }
  throw Object.assign(new Error('not-found'),{status:404});
}
parentPort.on('message',({id,action,input})=>{try{parentPort.postMessage({id,result:query(action,input)});}catch(error){parentPort.postMessage({id,error:{code:['not-found','unsupported-mapping','catalog-version-changed'].includes(error.message)?error.message:'catalog-unavailable',status:error.status||503}});}});
