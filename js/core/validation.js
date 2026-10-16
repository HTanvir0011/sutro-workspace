(function(root) {
  'use strict';
  const BN='০১২৩৪৫৬৭৮৯', poison=new Set(['__proto__','constructor','prototype']);
  const limits={bytes:2097152,docs:500,rows:5000,depth:24,text:2000,fraction:64};
  const ascii=value=>String(value ?? '').replace(/[০-৯]/g,c=>String(BN.indexOf(c)));
  function fail(field,code='invalid-field') { throw Object.assign(new Error(code),{field,code}); }
  function inspect(value,depth=0,count={n:0}) {
    if(depth>limits.depth || ++count.n>50000) fail('packet','structure-too-large');
    if(value && typeof value==='object') for(const key of Object.keys(value)) {
      if(poison.has(key)) fail(key,'unsafe-key'); inspect(value[key],depth+1,count);
    }
  }
  function text(value,field,max=limits.text) { if(value==null) return ''; if(typeof value!=='string' && typeof value!=='number') fail(field); if(typeof value==='number' && !Number.isSafeInteger(value)) fail(field); const out=String(value); if(out.length>max) fail(field,'text-too-long'); return out; }
  function year(value,field='year',draft=false) { const raw=ascii(value).trim(); if(draft && !raw) return ''; if(!/^\d{4}$/.test(raw) || +raw<1600 || +raw>2200) fail(field,'invalid-year'); return +raw; }
  function rational(value,field,draft=false) { const raw=text(value,field,64), normalized=ascii(raw).trim(); if(draft && !normalized) return ''; if(!/^\d+(?:\.\d+)?$|^\d+\s*\/\s*\d+$/.test(normalized) || /\/\s*0+$/.test(normalized)) fail(field,'invalid-fraction'); return raw; }
  function id(value,field='id') { const out=text(value,field,128); if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(out)) fail(field,'invalid-id'); return out; }
  function object(value,field) { if(!value || Array.isArray(value) || typeof value!=='object') fail(field); return value; }
  function translated(value,field) { if(typeof value==='string') return {en:text(value,field,256),bn:text(value,field,256)}; const o=object(value,field); return {en:text(o.en,field,256),bn:text(o.bn ?? o.en,field,256)}; }
  function packet(value,{draft=false}={}) {
    inspect(value); const p=object(value,'packet');
    if(p.schemaVersion!==undefined&&p.schemaVersion!==1)fail('packet.schemaVersion','unsupported-version');
    if(p.revision!=null&&(!Number.isSafeInteger(p.revision)||p.revision<0))fail('revision');
    if(p.synthetic!=null&&typeof p.synthetic!=='boolean')fail('synthetic');
    if(!Array.isArray(p.docs)||p.docs.length>limits.docs) fail('docs','document-limit');
    const out={id:id(p.id),schemaVersion:1,synthetic:p.synthetic===true,title:translated(p.title||p.id,'title'),asOfYear:year(p.asOfYear,'asOfYear',draft),revision:Number.isSafeInteger(p.revision)&&p.revision>=0?p.revision:0};
    const plot=object(p.plot||{},'plot'),offer=object(p.offer||{},'offer');
    out.plot={district:text(plot.district,'district',128),upazila:text(plot.upazila,'upazila',128),mouza:text(plot.mouza,'mouza',256),jl:text(plot.jl,'jl',128),dags:{}};
    if(plot.selectedSurvey){if(!['CS','SA','RS','BS','City'].includes(plot.selectedSurvey))fail('selectedSurvey');out.plot.selectedSurvey=plot.selectedSurvey;}
    for(const s of ['CS','SA','RS','BS','City']) if(plot.dags && plot.dags[s]!=null) out.plot.dags[s]=text(plot.dags[s],'dag',128);
    out.offer={seller:text(offer.seller,'seller',256),area:rational(offer.area ?? '','offer.area',true),basisKhatian:text(offer.basisKhatian,'basisKhatian',128)};
    const ids=new Set(); let rows=0;
    const fields={khatian:['survey','khatianNo','year','dag','area'],deed:['deedNo','year','dag','basisKhatian','previousDeeds'],mutation:['caseNo','year','deedNo','transferees'],heirCert:['decedent','deathYear','religion','school','will','issuer'],search:['fromYear','toYear','dag','office','deedsFound']};
    out.docs=p.docs.map((d,index)=>{
      object(d,'docs'); if(!Object.hasOwn(fields,d.type)) fail('type','unsupported-document');
      const doc={id:id(d.id,'document.id'),type:d.type,provenance:d.provenance==='certified'?'certified':'seller_copy'};
      if(ids.has(doc.id)) fail('id','duplicate-document'); ids.add(doc.id);
      for(const field of fields[d.type]) doc[field]=/Year$|^year$/.test(field)?year(d[field],`docs.${index}.${field}`,draft):field==='area'?rational(d[field],field,draft):text(d[field],field, ['dag','khatianNo','deedNo','caseNo','basisKhatian'].includes(field)?128:2000);
      const enums={survey:['CS','SA','RS','BS','City'],religion:['unknown','muslim','hindu','christian','buddhist','other'],school:['unknown','hanafi','other'],will:['unknown','yes','no']};
      for(const [field,values]of Object.entries(enums))if(doc[field]&&!values.includes(doc[field]))fail(field,'unsupported-value');
      for(const [key,cols] of Object.entries({owners:['name','share'],sellers:['name','area'],buyers:['name','area'],heirs:['name','relation','status','childrenSurvived','statedShare']})) {
        const needed=d.type==='khatian'?key==='owners':d.type==='deed'?['sellers','buyers'].includes(key):d.type==='heirCert'?key==='heirs':false;
        if(!needed) continue;
        if(!Array.isArray(d[key])||(rows+=d[key].length)>limits.rows) fail(key,'row-limit');
        doc[key]=d[key].map(row=>{ object(row,key); const r={}; for(const col of cols) r[col]=['share','area','statedShare'].includes(col)?rational(row[col]??'',col,draft||col==='statedShare'):text(row[col],col,256); return r; });
      }
      return doc;
    });
    return out;
  }
  function importJSON(source) {
    if(typeof source!=='string'||new TextEncoder().encode(source).length>limits.bytes) fail('file','file-too-large');
    const raw=JSON.parse(source); inspect(raw);
    if(raw.schemaVersion!==undefined && raw.schemaVersion!==1) fail('schemaVersion','unsupported-version');
    if(raw.packets) fail('packets','one-case-only');
    const out=packet(raw.packet||raw,{draft:true});
    // Imported claims never grant source permissions or application review status.
    const refs=raw.metadata?.sourceRefs||[];if(!Array.isArray(refs)||refs.length>64)fail('sourceRefs');
    const sourceRefs=refs.map(ref=>{object(ref,'sourceRef');const version=text(ref.datasetVersion,'datasetVersion',128);if(!/^[A-Za-z0-9_@.-]{1,128}$/.test(version))fail('datasetVersion');const projected={recordId:id(ref.recordId,'recordId'),datasetVersion:version,status:'unverified-imported-reference'};if(ref.dagRowId)projected.dagRowId=id(ref.dagRowId,'dagRowId');return projected;});
    return {schemaVersion:1,packet:out,metadata:{origin:'imported',importedCaseId:out.id,review:{},sourceRefs}};
  }
  const api={packet,importJSON,year,rational,ascii,id,inspect,limits};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  else root.Sutro=Object.assign(root.Sutro||{},{validation:api});
})(typeof globalThis!=='undefined'?globalThis:this);
