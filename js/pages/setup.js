(function(S){
  'use strict';const {el,message}=S.dom;
  S.pages.setup=async main=>{
    const existing=!!S.envelope,e=S.envelope||S.newCase(),p=e.packet;
    let survey=p.plot.selectedSurvey||Object.keys(p.plot.dags||{}).filter(k=>p.plot.dags[k]).at(-1)||'',dag=p.plot.dags[survey]||'';
    main.append(S.heading(S.say('Start with the land','জমি দিয়ে শুরু করুন'),S.say(existing?'Confirm the land and proposed sale':'What land are you considering?',existing?'জমি ও প্রস্তাবিত বিক্রি মিলিয়ে নিন':'কোন জমি কেনার কথা ভাবছেন?'),S.say('One case covers one plot and one proposed sale. You can add documents next and return to these details later.','একটি কেসে একটি জমি ও একটি প্রস্তাবিত বিক্রি থাকবে। পরের ধাপে কাগজ যোগ করুন; এই তথ্য পরে বদলাতে পারবেন।')));
    if(!existing)main.append(el('aside',{class:'preparation-panel'},el('h2',{},S.say('Have these nearby','সঙ্গে রাখুন')),el('p',{},S.say('The seller’s name, the offered area, and a khatian or deed identifying the mouza and dag. Photos and PDFs can be added in the next step.','বিক্রেতার নাম, প্রস্তাবিত জমির পরিমাণ এবং মৌজা ও দাগ চেনার খতিয়ান বা দলিল। ছবি ও PDF পরের ধাপে যোগ করা যাবে।')),S.link(S.say('See a worked example first →','আগে সম্পূর্ণ উদাহরণ দেখুন →'),'audit.html?case=demo-b')));
    const changed=(target,key,value)=>{target[key]=value;if(existing)S.markChanged();};
    const error=el('p',{role:'alert',class:'field-error',hidden:true});
    const form=el('form',{class:'setup-form'});
    const dagField=S.field(S.say('Selected dag number','নির্বাচিত দাগ নম্বর'),dag,value=>{dag=value;if(survey){p.plot.dags[survey]=value;if(existing)S.markChanged();}},{required:true,max:128,help:S.say('Enter one dag. Add older survey numbers with the documents.','একটি দাগ লিখুন। পুরোনো জরিপের দাগ কাগজপত্রের সঙ্গে যোগ করুন।')});
    form.append(el('section',{class:'card'},el('p',{class:'eyebrow'},S.say('01 / Identify the plot','০১ / জমি চিহ্নিত করুন')),el('h2',{},S.say('Where is the land?','জমিটি কোথায়?')),el('div',{class:'form-grid'},
      S.field(S.say('District (optional)','জেলা (ঐচ্ছিক)'),p.plot.district,v=>changed(p.plot,'district',v),{max:128}),
      S.field(S.say('Upazila (optional)','উপজেলা (ঐচ্ছিক)'),p.plot.upazila,v=>changed(p.plot,'upazila',v),{max:128}),
      S.field(S.say('Mouza','মৌজা'),p.plot.mouza,v=>changed(p.plot,'mouza',v),{required:true,max:256,help:S.say('Copy the mouza name from the document.','কাগজে লেখা মৌজার নাম লিখুন।')}),
      S.field(S.say('JL number (optional)','জে এল নম্বর (ঐচ্ছিক)'),p.plot.jl,v=>changed(p.plot,'jl',v),{max:128}),
      S.field(S.say('Survey on your document','কাগজে উল্লিখিত জরিপ'),survey,v=>{survey=v;p.plot.selectedSurvey=v;dag=p.plot.dags[v]||'';dagField.querySelector('input').value=dag;if(existing)S.markChanged();},{values:[['',S.say('Choose a survey','জরিপ বেছে নিন')],'CS','SA','RS','BS','City']}),dagField
    )));
    const names=[...new Set(p.docs.flatMap(d=>(d.owners||[]).map(o=>o.name)).filter(Boolean))];
    form.append(el('section',{class:'card'},el('p',{class:'eyebrow'},S.say('02 / Describe the proposed sale','০২ / প্রস্তাবিত বিক্রি')),el('h2',{},S.say('Who is selling, and how much?','কে কত জমি বিক্রি করতে চান?')),el('div',{class:'form-grid'},
      S.field(S.say('Seller','বিক্রেতা'),p.offer.seller,v=>changed(p.offer,'seller',v),{required:true,max:256,suggestions:names,help:S.say('Use the same spelling as in the documents.','কাগজের সঙ্গে নামের বানান মিলিয়ে লিখুন।')}),
      S.field(S.t('areaOffered'),p.offer.area,v=>changed(p.offer,'area',v),{required:true,numeric:true,max:64,help:S.say('Use decimals (শতাংশ), for example 12.5 or 25/2.','শতাংশে লিখুন, যেমন ১২.৫ বা ২৫/২।')})
    ),el('details',{},el('summary',{},S.say('Case name & evaluation year','কেসের নাম ও হিসাবের সাল')),S.field(S.say('Case title','কেসের নাম'),p.title[S.locale],v=>{p.title.en=p.title.bn=v;if(existing)S.markChanged();},{max:256}),S.field(S.t('asOfYear'),p.asOfYear,v=>changed(p,'asOfYear',v),{numeric:true,max:4}))),error,S.button(S.say('Continue to documents →','কাগজপত্র যোগ করুন →'),()=>form.requestSubmit()));
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(form.dataset.saving)return;
      error.hidden=true;
      try{if(!p.plot.mouza.trim()||!p.offer.seller.trim()||!survey||!dag.trim())throw new Error('plot');S.validation.year(p.asOfYear);S.validation.rational(p.offer.area,'area');if(!S.Fraction.from(p.offer.area).gt(0))throw new Error('area');}
      catch{error.hidden=false;error.textContent=S.say('Enter the mouza and seller, choose a survey and dag, and use a valid year and offered area greater than zero.','মৌজা ও বিক্রেতা, জরিপ ও দাগ, সঠিক সাল এবং শূন্যের বেশি জমির পরিমাণ লিখুন।');error.scrollIntoView({block:'center'});return;}
      form.dataset.saving='true';
      try{
        p.plot.dags[survey]=dag.trim();
        if(!existing){if(p.title.en==='Untitled case')p.title.en=p.title.bn=(p.plot.mouza+' · '+p.offer.seller).slice(0,256);S.envelope=await S.repository.save(e,0);sessionStorage.setItem('sutro.selected',p.id);location.href='intake.html?case='+p.id;}
        else{S.markChanged();await S.flush();await S.navigateCase(new URL('intake.html?case='+p.id,location.href));}
      }catch{message(S.say('Could not save this case. Your entered details are still here; retry.','কেস সংরক্ষণ হয়নি। লেখা তথ্য এখানেই আছে; আবার চেষ্টা করুন।'),true);}finally{delete form.dataset.saving;}
    });
    main.append(form);
  };
})(window.Sutro);
