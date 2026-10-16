(function(root){
  'use strict';
  let pending;
  function open(){
    if(pending) return pending;
    let attempt;attempt=new Promise((resolve,reject)=>{
      let abandoned=false;
      const request=indexedDB.open('sutro',2);
      request.onupgradeneeded=()=>{for(const name of ['cases','scans','meta']) if(!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);};
      request.onsuccess=()=>{if(abandoned){request.result.close();return;}request.result.onversionchange=()=>{request.result.close();if(pending===attempt)pending=null;};resolve(request.result);};
      request.onerror=()=>{if(pending===attempt)pending=null;reject(request.error);};
      request.onblocked=()=>{abandoned=true;if(pending===attempt)pending=null;reject(new Error('storage-upgrade-blocked'));};
    });pending=attempt;return pending;
  }
  async function request(store,mode,fn){ const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(store,mode);let result;try{result=fn(tx.objectStore(store));}catch(e){tx.abort();return reject(e);}tx.oncomplete=()=>resolve(result?.result);tx.onabort=tx.onerror=()=>reject(tx.error||new Error('storage-failed'));}); }
  const get=id=>request('cases','readonly',s=>s.get(id));
  async function save(envelope,expected,scans={}){
    const db=await open();return new Promise((resolve,reject)=>{
      const tx=db.transaction(Object.keys(scans).length?['cases','scans']:'cases','readwrite'),store=tx.objectStore('cases');let conflict=false,newValue;
      const q=store.get(envelope.packet.id);
      q.onsuccess=()=>{const old=q.result;if((old?.storageRevision??0)!==expected){conflict=true;tx.abort();return;}newValue=structuredClone(envelope);newValue.storageRevision=expected+1;newValue.savedAt=new Date().toISOString();store.put(newValue,envelope.packet.id);for(const [docId,record]of Object.entries(scans))tx.objectStore('scans').put(record,envelope.packet.id+':'+docId);};
      tx.oncomplete=()=>resolve(newValue);tx.onabort=tx.onerror=()=>reject(new Error(conflict?'case-conflict':'save-failed'));
    });
  }
  const list=async()=>{const db=await open();return new Promise((resolve,reject)=>{const rows=[],tx=db.transaction('cases'),q=tx.objectStore('cases').openCursor();q.onsuccess=()=>{const c=q.result;if(!c)return;const v=c.value;rows.push({id:c.key,title:v.packet.title,synthetic:v.packet.synthetic,origin:v.metadata?.origin,savedAt:v.savedAt,revision:v.packet.revision,mouza:v.packet.plot.mouza,seller:v.packet.offer.seller,docCount:v.packet.docs.length,needsReview:v.packet.docs.some(d=>v.metadata?.review?.[d.id+'.document']?.status!=='user-reviewed'),analysisCurrent:v.metadata?.analysisRevision===v.packet.revision});c.continue();};tx.oncomplete=()=>resolve(rows);tx.onerror=()=>reject(tx.error);});};
  async function remove(id){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction(['cases','scans'],'readwrite');tx.objectStore('cases').delete(id);const q=tx.objectStore('scans').openCursor();q.onsuccess=()=>{const c=q.result;if(!c)return;if(String(c.key).startsWith(id+':'))c.delete();c.continue();};tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error||new Error('storage-failed'));});}
  async function migrate(){
    const old=localStorage.getItem('sutro.packets.v1');if(!old)return {status:'none'};
    if(await request('meta','readonly',s=>s.get('legacy-migrated')))return {status:'already-migrated'};
    const parsed=JSON.parse(old);root.Sutro.validation.inspect(parsed);
    if(!Array.isArray(parsed.packets)||parsed.packets.length>500)throw new Error('legacy-invalid');
    const migrated=parsed.packets.map(p=>root.Sutro.validation.importJSON(JSON.stringify(p)));
    for(const e of migrated){e.metadata.origin='legacy-import';if(!await get(e.packet.id))await save(e,0);const check=await get(e.packet.id);if(!check)throw new Error('migration-verification-failed');}
    await request('meta','readwrite',s=>s.put(true,'legacy-migrated'));
    // Preserve the original localStorage value for explicit owner recovery/removal.
    return {status:'verified',count:migrated.length};
  }
  async function clear(){const db=await open();await new Promise((resolve,reject)=>{const tx=db.transaction(['cases','scans','meta'],'readwrite');for(const store of ['cases','scans','meta'])tx.objectStore(store).clear();tx.oncomplete=()=>resolve();tx.onabort=tx.onerror=()=>reject(tx.error||new Error('storage-failed'));});localStorage.removeItem('sutro.packets.v1');}
  root.Sutro=Object.assign(root.Sutro||{},{repository:{get,save,list,remove,migrate,scanGet:key=>request('scans','readonly',s=>s.get(key)),scanPut:(key,blob)=>request('scans','readwrite',s=>s.put(blob,key)),scanDelete:key=>request('scans','readwrite',s=>s.delete(key)),clear}});
})(window);
