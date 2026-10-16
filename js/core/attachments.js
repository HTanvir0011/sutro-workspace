(function(S){
  'use strict';
  const limits={file:20*1024*1024,total:40*1024*1024,backup:58*1024*1024,files:50,pdfPages:100};
  let library;
  const files=value=>value instanceof Blob?[{blob:value,name:'Source scan'}]:value?.files||[];
  const safeName=name=>String(name||'Source scan').split(/[\\/]/).at(-1).replace(/[\x00-\x1f]/g,'').slice(0,120);
  async function pdf(blob){
    if(!library){const api=await import(new URL('assets/vendor/pdf/pdf.min.mjs',document.baseURI).href);api.GlobalWorkerOptions.workerSrc=new URL('assets/vendor/pdf/pdf.worker.min.mjs',document.baseURI).href;library=api;}
    const task=library.getDocument({data:new Uint8Array(await blob.arrayBuffer()),isEvalSupported:false,useWasm:false,useWorkerFetch:false,useSystemFonts:true,disableFontFace:true,maxImageSize:25000000,stopAtErrors:true});
    try{return await task.promise;}catch(error){await task.destroy();throw error;}
  }
  async function validate(file){
    if(!file||!file.size||file.size>limits.file)throw new Error('file-size-limit');
    const header=new Uint8Array(await file.slice(0,8).arrayBuffer());
    if(String.fromCharCode(...header).startsWith('%PDF-')){
      if(file.type&&file.type!=='application/pdf')throw new Error('file-type-mismatch');
      const blob=new Blob([file],{type:'application/pdf'}),doc=await pdf(blob);
      try{if(doc.numPages<1||doc.numPages>limits.pdfPages)throw new Error('pdf-page-limit');return {blob,name:safeName(file.name),pages:doc.numPages};}finally{await doc.loadingTask.destroy();}
    }
    return {blob:await S.images.image(file),name:safeName(file.name),pages:1};
  }
  async function get(envelope,docId){const key=envelope.packet.id+':'+docId;return S.sessionScans?.[key]||(envelope.metadata.attachments?.[docId]?.retained?await S.repository.scanGet(key):null);}
  async function capacity(envelope,docId,next){let count=0,total=0;for(const doc of envelope.packet.docs){const value=doc.id===docId?next:await get(envelope,doc.id);for(const file of files(value)){count++;total+=file.blob.size;}}if(count>limits.files||total>limits.total)throw new Error('case-limit-50-files-40-MiB');}
  async function backup(envelope){
    const scans=[];let total=0,count=0;
    for(const d of envelope.packet.docs){const record=await get(envelope,d.id),items=[];for(const file of files(record)){
      total+=file.blob.size;if(total>limits.total||++count>limits.files)throw new Error('backup-size-limit');
      const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(file.blob);});
      items.push({name:safeName(file.name),type:file.blob.type,base64});
    }if(items.length)scans.push({documentId:d.id,files:items});}
    S.download(envelope.packet.id+'.backup.sutro.json',{schemaVersion:1,packet:envelope.packet,metadata:envelope.metadata,backup:{version:1,scans}});
  }
  async function parse(file){
    if(file.size>limits.backup)throw new Error('backup-size-limit');const text=await file.text(),raw=JSON.parse(text);S.validation.inspect(raw);
    const envelope=S.validation.importJSON(JSON.stringify(raw.packet?{schemaVersion:raw.schemaVersion,packet:raw.packet,metadata:raw.metadata}:raw));
    const scans={},seen=new Set();let total=0,count=0;
    if(raw.backup){if(raw.backup.version!==1||!Array.isArray(raw.backup.scans)||raw.backup.scans.length>S.validation.limits.docs)throw new Error('invalid-backup');
      for(const entry of raw.backup.scans){
        if(!envelope.packet.docs.some(d=>d.id===entry.documentId)||seen.has(entry.documentId)||!Array.isArray(entry.files)||!entry.files.length||entry.files.length>20)throw new Error('invalid-backup-document');seen.add(entry.documentId);
        const items=[];for(const item of entry.files){
          if(!['image/png','image/jpeg','application/pdf'].includes(item.type)||typeof item.base64!=='string'||item.base64.length>Math.ceil(limits.file/3)*4||!/^[A-Za-z0-9+/]*={0,2}$/.test(item.base64))throw new Error('invalid-backup-file');
          const data=atob(item.base64);total+=data.length;if(total>limits.total||++count>limits.files)throw new Error('backup-size-limit');
          items.push(await validate(new File([Uint8Array.from(data,c=>c.charCodeAt(0))],safeName(item.name),{type:item.type})));
        }scans[entry.documentId]={version:1,files:items};
      }
    }return {envelope,scans,count};
  }
  // Canvas-only PDF preview: document scripts, forms, links and embedded actions are never mounted.
  async function renderPDF(blob,container,live){
    const doc=await pdf(blob);if(!live()){await doc.loadingTask.destroy();return ()=>{};}
    let pageNumber=1,disposed=false,renderTask,sequence=0,ready=false;
    const {el}=S.dom,canvas=el('canvas',{'aria-label':S.say('Rendered PDF page','PDF-এর পৃষ্ঠা')}),status=el('span',{role:'status'}),previous=S.button(S.say('Previous page','আগের পৃষ্ঠা'),()=>draw(pageNumber-1),true),next=S.button(S.say('Next page','পরের পৃষ্ঠা'),()=>draw(pageNumber+1),true);
    container.append(el('div',{class:'viewer-tools'},previous,status,next),el('div',{class:'source-viewport'},canvas));
    async function draw(number){
      const seq=++sequence;ready=false;renderTask?.cancel();pageNumber=Math.max(1,Math.min(doc.numPages,number));
      previous.disabled=true;next.disabled=true;canvas.hidden=true;status.textContent=S.say(`Rendering page ${pageNumber}…`,`পৃষ্ঠা ${pageNumber} তৈরি হচ্ছে…`);
      const page=await doc.getPage(pageNumber);if(disposed||!live()||seq!==sequence)return;
      const original=page.getViewport({scale:1}),scale=Math.min(1.5,1200/original.width,1600/original.height),viewport=page.getViewport({scale});
      canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport});
      try{await renderTask.promise;}catch(error){if(error.name!=='RenderingCancelledException')throw error;}
      if(!disposed&&live()&&seq===sequence){ready=true;canvas.hidden=false;status.textContent=S.say(`Page ${pageNumber} of ${doc.numPages}`,`পৃষ্ঠা ${pageNumber} / ${doc.numPages}`);previous.disabled=pageNumber===1;next.disabled=pageNumber===doc.numPages;}
    }
    try{await draw(1);}catch(error){await doc.loadingTask.destroy();throw error;}
    const dispose=()=>{disposed=true;++sequence;renderTask?.cancel();doc.loadingTask.destroy();};
    dispose.pageNumber=()=>pageNumber;dispose.pageBlob=()=>{if(!ready||disposed)return Promise.reject(new Error('pdf-page-rendering'));return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('pdf-page-unavailable')),'image/png'));};dispose.renderSize=()=>({width:canvas.width,height:canvas.height});return dispose;
  }
  S.exitWorkspace=action=>{
    const e=S.envelope,scans={};if(e)for(const d of e.packet.docs){const value=S.sessionScans?.[e.packet.id+':'+d.id];if(value&&!e.metadata.attachments?.[d.id]?.retained)scans[d.id]=value;}
    if(!Object.keys(scans).length)return action();
    return S.dom.dialog(S.say('Keep your attached pages before leaving?','বের হওয়ার আগে সংযুক্ত পৃষ্ঠা রাখবেন?'),S.dom.el('p',{},S.say('These pages are kept only in this open case. Leaving or reloading removes them unless you keep them on this device or download a backup.','এই পৃষ্ঠাগুলো শুধু খোলা কেসে আছে। বের হলে বা রিলোড করলে হারাবে। ডিভাইসে রাখুন বা আগে ব্যাকআপ নামান।')),[{label:S.say('Keep scans and continue','স্ক্যান রেখে এগিয়ে যান'),action:async()=>{
      await S.flush();const snapshot=structuredClone(e);snapshot.metadata.attachments||={};for(const id of Object.keys(scans))snapshot.metadata.attachments[id]={retained:true};
      const saved=await S.repository.save(snapshot,e.storageRevision||0,scans);e.storageRevision=saved.storageRevision;e.savedAt=saved.savedAt;e.metadata=saved.metadata;await action();
    }},{label:S.say('Leave without keeping scans','স্ক্যান না রেখে বের হোন'),action}]);
  };
  S.hasSessionSources=()=>!!S.envelope&&S.envelope.packet.docs.some(d=>S.sessionScans?.[S.envelope.packet.id+':'+d.id]&&!S.envelope.metadata.attachments?.[d.id]?.retained);
  function errorText(error){const messages={
    'case-limit-50-files-40-MiB':['A case can hold up to 50 files totaling 40 MiB. Remove or reduce a file before adding more.','প্রতি কেসে সর্বোচ্চ ৫০টি ফাইল, মোট ৪০ MiB রাখা যাবে। আরও যোগ করার আগে ফাইল কমান বা ছোট করুন।'],
    'maximum-20-files-per-document':['A document can have up to 20 source files.','একটি কাগজে সর্বোচ্চ ২০টি উৎস ফাইল রাখা যাবে।'],
    'file-size-limit':['Choose a file smaller than 20 MiB.','২০ MiB-এর চেয়ে ছোট ফাইল বেছে নিন।'],
    'image-byte-limit':['Choose an image smaller than 15 MiB.','১৫ MiB-এর চেয়ে ছোট ছবি বেছে নিন।'],
    'image-pixel-limit':['The image is too large to preview. Use a smaller image, up to 25 million pixels.','ছবিটি দেখানোর জন্য অতিরিক্ত বড়। সর্বোচ্চ ২.৫ কোটি পিক্সেলের ছোট ছবি দিন।'],
    'pdf-page-limit':['This PDF has too many pages. Use up to 100 pages per PDF.','PDF-এ অতিরিক্ত পৃষ্ঠা আছে। প্রতি PDF-এ সর্বোচ্চ ১০০ পৃষ্ঠা দিন।'],
    'backup-size-limit':['This backup exceeds the supported size. Export case data separately or reduce the source files.','ব্যাকআপটি অনুমোদিত আকারের বেশি। কেসের তথ্য আলাদা এক্সপোর্ট করুন বা উৎস ফাইল ছোট করুন।']
  };if(error.name==='PasswordException')return S.say('This PDF needs a password. Add an unlocked copy or photos of the pages.','এই PDF-এ পাসওয়ার্ড প্রয়োজন। খোলা কপি বা পৃষ্ঠার ছবি যোগ করুন।');return S.say(...(messages[error.message]||['This file could not be read. Use a valid JPEG, PNG, PDF or Sutro case backup. Your existing data is unchanged.','ফাইলটি পড়া যায়নি। সঠিক JPEG, PNG, PDF বা সূত্রের ব্যাকআপ দিন। আগের তথ্য অপরিবর্তিত আছে।']));}
  S.attachments={limits,files,get,validate,backup,parse,renderPDF,capacity,errorText};
})(window.Sutro);
