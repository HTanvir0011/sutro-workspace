(function(S){'use strict';let worker,pending,serial=0;
  function cancel(){worker?.terminate();worker=null;if(pending){clearTimeout(pending.timer);pending.reject(new Error('cancelled'));pending=null;}}
  async function recognize(bitmap,kind='line'){
    if(pending){bitmap.close();throw new Error('ocr-busy');}
    if(!worker){worker=new Worker('js/workers/ocr.mjs',{type:'module'});worker.onmessage=({data})=>{if(!pending||pending.id!==data.id)return;const p=pending;pending=null;clearTimeout(p.timer);data.error?p.reject(new Error(data.error)):p.resolve(data);};worker.onerror=()=>cancel();}
    return new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(cancel,60000);pending={id,resolve,reject,timer};worker.postMessage({id,kind,bitmap},[bitmap]);});
  }
  window.addEventListener('pagehide',cancel,{once:true});S.ocrClient={recognize,cancel};
})(window.Sutro);
