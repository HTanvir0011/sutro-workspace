'use strict';
const {Worker}=require('node:worker_threads'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {error,stream,safePath}=require('./http');
function createAPI({runtime=path.resolve(__dirname,'../docs/.runtime')}={}){
  const worker=new Worker(path.join(__dirname,'catalog-worker.js'),{workerData:{runtime},resourceLimits:{maxOldGenerationSizeMb:192}}),pending=new Map(),secret=crypto.randomBytes(32);let serial=0,ready=false;
  worker.on('message',message=>{const p=pending.get(message.id);if(!p)return;pending.delete(message.id);clearTimeout(p.timer);if(message.error){if(message.error.status===503)ready=false;p.reject(Object.assign(new Error(message.error.code),{status:message.error.status}));}else{ready=true;p.resolve(message.result);}});
  worker.on('error',()=>{ready=false;for(const p of pending.values()){clearTimeout(p.timer);p.reject(Object.assign(new Error('catalog-unavailable'),{status:503}));}pending.clear();});
  function query(action,input={}){if(pending.size>=16)return Promise.reject(Object.assign(new Error('busy'),{status:429}));return new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{pending.delete(id);reject(Object.assign(new Error('catalog-timeout'),{status:503}));},3000);pending.set(id,{resolve,reject,timer});worker.postMessage({id,action,input});});}
  query('capabilities').catch(()=>{});
  const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
  const sign=value=>crypto.createHmac('sha256',secret).update(value).digest('base64url');
  function decode(cursor,filter){if(!cursor)return {};if(cursor.length>1500)throw new Error('invalid-cursor');const [value,signature,...rest]=cursor.split('.');if(rest.length||!signature||signature.length!==sign(value).length||!crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(sign(value))))throw new Error('invalid-cursor');const data=JSON.parse(Buffer.from(value,'base64url'));if(data.filter!==digest(filter)||!/^([a-f0-9]{32})$/.test(data.last)||!/^[a-f0-9]{20}$/.test(data.revision))throw new Error('invalid-cursor');return data;}
  function encode(last,revision,filter){const value=Buffer.from(JSON.stringify({last,revision,filter:digest(filter)})).toString('base64url');return value+'.'+sign(value);}
  async function api(req,res,url,pathname){
    try{
      const allowed=new Set(['dataset','kind','survey','split','q','location','cursor','limit']);for(const [key,value]of url.searchParams){if(!allowed.has(key)||value.length>(key==='cursor'?1500:128)||url.searchParams.getAll(key).length!==1)throw new Error('invalid-filter');}
      const filter=Object.fromEntries(['dataset','kind','survey','split','q','location'].map(k=>[k,url.searchParams.get(k)||'']));
      const rawLimit=url.searchParams.get('limit')||'24';if(!/^\d{1,3}$/.test(rawLimit)||+rawLimit<1||+rawLimit>100)throw new Error('invalid-limit');
      if(filter.kind&&!['packet','khatian'].includes(filter.kind)||filter.survey&&!['CS','SA','RS','BS','City'].includes(filter.survey))throw new Error('invalid-filter');
      const input={...filter,limit:+rawLimit,...decode(url.searchParams.get('cursor'),filter)};
      let result;
      if(pathname==='/api/v1/capabilities')result=await query('capabilities');
      else if(pathname==='/api/v1/datasets')result=await query('datasets');
      else if(pathname==='/api/v1/records'){result=await query('list',input);result.nextCursor=result.last?encode(result.last,result.version,filter):null;delete result.last;}
      else if(pathname==='/api/v1/models')result={schemaVersion:1,models:[],status:'runtime-validation-pending'};
      else {
        const match=pathname.match(/^\/api\/v1\/(records|packets|assets)\/([a-f0-9]{32})(?:\/(relationships|preview))?$/);
        if(!match)return error(res,404,'not-found');input.id=match[2];
        if(match[1]==='assets'&&match[3]==='preview'){
          const a=await query('asset',input);const filename=a.sha256+'-'+a.access+'-thumbnail-v1.jpg';const file=safePath(path.join(runtime,'previews'),filename);if(!file)return error(res,404,'preview-unavailable');
          if(req.headers.range)return error(res,416,'range-unsupported');res.setHeader('Cache-Control','private, no-store');return stream(req,res,file,'image/jpeg');
        }
        result=await query(match[1]==='packets'?'packet':match[3]==='relationships'?'relationships':'detail',input);
      }
      if(req.aborted||res.destroyed)return;
      const bytes=Buffer.from(JSON.stringify(result));if(bytes.length>100*1024)return error(res,413,'detail-too-large');
      res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Length':bytes.length,'Cache-Control':'private, no-store'});res.end(req.method==='HEAD'?undefined:bytes);
    }catch(e){const known=['invalid-filter','invalid-limit','invalid-cursor'];error(res,e.status||(known.includes(e.message)?400:503),e.status||known.includes(e.message)?e.message:'catalog-unavailable');}
  }
  api.ready=()=>ready;api.close=()=>worker.terminate();api.query=query;return api;
}
module.exports={createAPI};
