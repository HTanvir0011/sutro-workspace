(function(S){
  'use strict';
  let timer,pendingFlush;
  S.markChanged=({evidence=true}={})=>{S.dirty=true;const previous=S.envelope.packet.revision++;if(!evidence&&S.envelope.metadata.analysisRevision===previous)S.envelope.metadata.analysisRevision=S.envelope.packet.revision;S.setSaveStatus(S.say('Unsaved changes','পরিবর্তন সংরক্ষিত হয়নি'));clearTimeout(timer);timer=setTimeout(()=>S.flush().catch(()=>{}),350);};
  S.setSaveStatus=text=>{const n=document.getElementById('save-status');if(n)n.textContent=text;const badge=document.getElementById('case-readiness');if(badge&&S.workflow&&S.envelope){const w=S.workflow.inspect(S.envelope);badge.replaceChildren(S.badge(S.workflow.label(w.state),w.reviewed?'neutral':'warning'));}};
  S.flush=()=>{
    clearTimeout(timer);if(pendingFlush)return pendingFlush;if(!S.dirty)return Promise.resolve();
    S.saving=true;
    // Navigation and explicit retries share one drain, including edits made during a write.
    pendingFlush=Promise.resolve().then(async()=>{
      while(S.dirty){
        const envelope=S.envelope,snapshot=structuredClone(envelope),expected=envelope.storageRevision||0;
        S.dirty=false;S.setSaveStatus(S.say('Saving…','সংরক্ষণ হচ্ছে…'));
        try{
          const saved=await S.repository.save(snapshot,expected);
          envelope.storageRevision=saved.storageRevision;envelope.savedAt=saved.savedAt;
        }catch(e){
          S.dirty=true;S.setSaveStatus(S.say('Save failed — retry or export','সংরক্ষণ হয়নি — আবার চেষ্টা বা এক্সপোর্ট'));
          S.dom.message(e.message==='case-conflict'?S.say('Another tab changed this case. Export your draft before reloading.','অন্য ট্যাবে কেসটি বদলেছে। রিলোডের আগে খসড়া এক্সপোর্ট করুন।'):S.say('Could not save. Check storage space and export your draft.','সংরক্ষণ হয়নি। জায়গা পরীক্ষা করে খসড়া এক্সপোর্ট করুন।'),true);throw e;
        }
      }
      S.setSaveStatus(S.say('Saved on this device','এই ডিভাইসে সংরক্ষিত'));
    }).finally(()=>{pendingFlush=null;S.saving=false;});
    return pendingFlush;
  };
  S.exportCase=()=>S.dom.dialog(S.say('Download a case backup','কেসের ব্যাকআপ নামান'),S.dom.el('p',{},S.say('Include source scans to keep the evidence with your case. A data-only export contains entered values and references, without the attached pages.','কেসের সঙ্গে মূল কাগজ রাখতে স্ক্যানসহ নামান। শুধু তথ্য এক্সপোর্টে লেখা তথ্য ও সূত্র থাকবে, সংযুক্ত পৃষ্ঠা থাকবে না।')),[{label:S.say('Include scans','স্ক্যানসহ নামান'),action:()=>S.attachments.backup(S.envelope)},{label:S.say('Case data only','শুধু কেসের তথ্য'),action:()=>S.download(S.envelope.packet.id+'.sutro.json',{schemaVersion:1,packet:S.envelope.packet,metadata:S.envelope.metadata})}]);
  S.newCase=()=>({schemaVersion:1,storageRevision:0,packet:{schemaVersion:1,id:'case-'+crypto.randomUUID(),title:{en:'Untitled case',bn:'নতুন কেস'},synthetic:false,revision:0,asOfYear:Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Asia/Dhaka'}).format(new Date())),plot:{district:'',upazila:'',mouza:'',jl:'',dags:{}},offer:{seller:'',area:'',basisKhatian:''},docs:[]},metadata:{origin:'manual',review:{},sourceRefs:[],checklist:{}}});
  S.loadCase=async()=>{
    const key=new URLSearchParams(location.search).get('case')||sessionStorage.getItem('sutro.selected');
    if(!key)return;
    try{S.validation.id(key);S.envelope=await S.repository.get(key);if(!S.envelope){const demo=S.DEMO_PACKETS.find(p=>p.id===key);if(demo)S.envelope={schemaVersion:1,storageRevision:0,packet:S.validation.packet(demo),metadata:{origin:'demo',review:{},sourceRefs:[],checklist:{}}};}}catch(error){S.loadError=error;}
    if(S.envelope)sessionStorage.setItem('sutro.selected',S.envelope.packet.id);
  };
  window.addEventListener('beforeunload',e=>{if(S.dirty||S.saving){e.preventDefault();e.returnValue='';}});
})(window.Sutro);
