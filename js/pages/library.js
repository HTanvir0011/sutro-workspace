(function(S){
  'use strict';const {el,message}=S.dom;
  S.pages.library=async main=>{
    let caps;
    try{caps=await S.provider.capabilities();}catch{main.append(S.heading(S.say('Reference records','উৎস রেকর্ড'),S.say('The library is unavailable','লাইব্রেরি পাওয়া যাচ্ছে না'),S.say('You can still start a case with your own documents.','আপনার কাগজ দিয়ে কেস শুরু করতে পারবেন।')),S.link(S.say('Start a case →','কেস শুরু করুন →'),'setup.html',true));return;}
    const demo=caps.profile==='static-demo';let sequence=0,detailSequence=0,controller,detailController,timer,cursor='',disposed=false;
    const filters={dataset:'',kind:'',survey:'',location:''};let q=new URLSearchParams(location.search).get('q')||'';
    main.append(S.heading(S.say(demo?'Learn with an example':'Local reference library',demo?'উদাহরণ দিয়ে বুঝুন':'স্থানীয় উৎস রেকর্ড'),S.say(demo?'See how the findings change':'Inspect a reference before adding it',demo?'ফলাফল কীভাবে বদলায় দেখুন':'যোগ করার আগে উৎস রেকর্ড দেখুন'),S.say(demo?'Three invented situations show what Sutro can explain and where evidence is missing. They are separate from your personal cases.':'Browse permitted local research records. This is not a government land search. Review the plot and source values before creating a draft.',demo?'তিনটি উদ্ভাবিত ঘটনায় সূত্রের ব্যাখ্যা ও কাগজের ঘাটতি দেখুন। এগুলো আপনার ব্যক্তিগত কেস থেকে আলাদা।':'অনুমোদিত স্থানীয় গবেষণার রেকর্ড দেখুন। এটি সরকারি ভূমি অনুসন্ধান নয়। খসড়া তৈরির আগে জমি ও উৎসের তথ্য মিলিয়ে নিন।')));
    const results=el('div',{class:'record-grid'}),detail=el('section',{class:'record-detail',tabindex:'-1','aria-label':S.say('Selected record','নির্বাচিত রেকর্ড')}),state=el('p',{role:'status',class:'library-status'}),pager=el('div',{class:'actions'});
    if(!demo){
      const panel=el('div',{class:'form-grid card'}),all=['',S.say('All','সব')];
      const available=new Set(caps.capabilities||[]);
      if((caps.datasets||[]).length>1)panel.append(S.field(S.say('Source dataset','উৎস dataset'),'',v=>{filters.dataset=v;cursor='';load();},{values:[all,...caps.datasets.map(d=>[d.id,d.id])]}));
      if(available.size>1)panel.append(S.field(S.say('Record type','রেকর্ডের ধরন'),'',v=>{filters.kind=v;cursor='';load();},{values:[all,...[['packet',S.say('Example case','উদাহরণ কেস')],['khatian',S.t('t_khatian')]].filter(([key])=>available.has(key))]}));
      if(available.has('khatian'))panel.append(S.field(S.say('Survey','জরিপ'),'',v=>{filters.survey=v;cursor='';load();},{values:[all,'CS','SA','RS','BS','City']}),S.field(S.say('Mouza or district prefix','মৌজা বা জেলার নামের শুরু'),'',v=>{filters.location=v;cursor='';clearTimeout(timer);timer=setTimeout(load,250);}));
      if(panel.childNodes.length)main.append(panel);
    }
    main.append(S.field(S.say(demo?'Find an example':'Search record identifiers',demo?'উদাহরণ খুঁজুন':'রেকর্ডের নম্বর খুঁজুন'),q,v=>{q=v;cursor='';clearTimeout(timer);timer=setTimeout(load,250);}),state,results,pager,detail);
    async function load(){
      const seq=++sequence;controller?.abort();controller=new AbortController();++detailSequence;detailController?.abort();detail.replaceChildren();state.textContent=S.say('Loading…','লোড হচ্ছে…');
      try{
        const data=await S.provider.list(demo?{q}:{...filters,q,cursor,limit:'24'},controller.signal);if(disposed||seq!==sequence)return;
        state.textContent=demo?S.say(`${data.items.length} synthetic examples`,`${data.items.length}টি কৃত্রিম উদাহরণ`):S.say('Permitted local records · Select one to inspect.','অনুমোদিত স্থানীয় রেকর্ড · দেখতে একটি নির্বাচন করুন।');
        history.replaceState(null,'','library.html'+(q?'?q='+encodeURIComponent(q):''));
        results.replaceChildren(...data.items.map(record=>{
          const packet=demo?S.DEMO_PACKETS.find(p=>p.id===record.id):null;
          return el('article',{class:'card record-card'},S.badge(S.say(demo?'Synthetic example':'Research reference',demo?'কৃত্রিম উদাহরণ':'গবেষণার উৎস')),el('h2',{},packet?.title[S.locale]||record.title||record.sourceId),el('p',{class:'muted'},packet?.blurb[S.locale]||[record.survey,record.year,record.datasetVersion].filter(Boolean).join(' · ')),demo?el('div',{class:'actions'},S.link(S.say('See findings →','ফলাফল দেখুন →'),'audit.html?case='+record.id,true),S.link(S.say('Explore the documents','কাগজপত্র দেখুন'),'intake.html?case='+record.id)):S.button(S.say('Inspect record →','রেকর্ড দেখুন →'),()=>show(record.id),true));
        }));
        if(!data.items.length)results.append(el('div',{class:'empty-state'},el('h2',{},S.say('No matching records','কোনো রেকর্ড মেলেনি')),el('p',{},S.say('Try a shorter search or clear the filters.','ছোট করে খুঁজুন বা ফিল্টার সরান।')),S.link(S.say('Start with your own documents','আপনার কাগজ দিয়ে শুরু করুন'),'setup.html')));
        pager.replaceChildren();if(cursor)pager.append(S.button(S.say('First page','প্রথম পাতা'),()=>{cursor='';load();},true));if(data.nextCursor)pager.append(S.button(S.say('Next page →','পরের পাতা →'),()=>{cursor=data.nextCursor;load();}));
      }catch(error){if(disposed||seq!==sequence||error.name==='AbortError')return;state.textContent=error.status===410?S.say('The source version changed. Restart from the first page.','উৎসের সংস্করণ বদলেছে। প্রথম পাতা থেকে শুরু করুন।'):S.say('Records are unavailable. Retry or start a manual case.','রেকর্ড পাওয়া যাচ্ছে না। আবার চেষ্টা করুন বা নিজে কেস শুরু করুন।');results.replaceChildren(S.button(S.say('Retry','আবার চেষ্টা'),()=>{cursor='';load();}),S.link(S.say('Start a case','কেস শুরু করুন'),'setup.html'));pager.replaceChildren();}
    }
    async function show(id){
      const seq=++detailSequence;detailController?.abort();detailController=new AbortController();const signal=detailController.signal;
      detail.replaceChildren(el('p',{role:'status'},S.say('Opening selected record…','নির্বাচিত রেকর্ড খোলা হচ্ছে…')));
      try{
        const r=await S.provider.detail(id,signal);if(disposed||seq!==detailSequence)return;
        const card=el('div',{class:'card'},el('div',{class:'section-title'},el('h2',{},r.title||r.sourceId||r.id),S.button(S.say('Close record','রেকর্ড বন্ধ করুন'),()=>{++detailSequence;detailController.abort();detail.replaceChildren();},true)),el('p',{class:'muted'},S.say('Reference information for review. It does not prove title or authenticate a document.','পর্যালোচনার উৎস তথ্য। এটি মালিকানা প্রমাণ বা কাগজের সত্যতা নিশ্চিত করে না।')),el('dl',{class:'summary-facts'},Object.entries({[S.say('Source version','উৎসের সংস্করণ')]:r.datasetVersion,[S.say('Survey','জরিপ')]:r.survey,[S.say('Year','সাল')]:r.year,[S.say('License','লাইসেন্স')]:r.license}).filter(([,v])=>v!=null).flatMap(([k,v])=>[el('dt',{},k),el('dd',{},String(v))])));
        if(r.previewAssetId&&r.dimensions)card.append(S.viewer({src:'/api/v1/assets/'+encodeURIComponent(r.previewAssetId)+'/preview',width:r.dimensions.width,height:r.dimensions.height,fields:r.fields||[]}));
        if(r.kind==='packet')card.append(S.button(S.say('Create a draft from this example','এই উদাহরণ থেকে খসড়া তৈরি করুন'),async()=>{const raw=await S.provider.packet(id);const e=S.validation.importJSON(JSON.stringify(raw));e.packet.id='source-'+crypto.randomUUID();e.metadata={origin:'dataset',review:{},sourceRefs:[{recordId:id,datasetVersion:r.datasetVersion}],checklist:{}};await S.repository.save(e,0);location.href='setup.html?case='+e.packet.id;}));
        else if(S.mappingUI)card.append(await S.mappingUI(r));
        const related=await S.provider.relationships(id,signal);if(disposed||seq!==detailSequence)return;
        if(related.items.length)card.append(el('section',{},el('h3',{},S.say('Other versions linked by the source','উৎসে সংযুক্ত অন্যান্য সংস্করণ')),related.items.filter(v=>v.id!==id).map(v=>S.button([v.survey,v.year,v.sourceId].filter(Boolean).join(' · '),()=>show(v.id),true))));
        detail.replaceChildren(card);detail.focus();detail.scrollIntoView({block:'start'});
      }catch(error){if(disposed||seq!==detailSequence||error.name==='AbortError')return;detail.replaceChildren(el('p',{role:'alert'},S.say('This record could not be opened. Select it to retry.','রেকর্ড খোলা যায়নি। আবার দেখতে নির্বাচন করুন।')));}
    }
    await load();return ()=>{disposed=true;++sequence;++detailSequence;controller?.abort();detailController?.abort();clearTimeout(timer);};
  };
})(window.Sutro);
