(function(S){
  'use strict';const {el,message}=S.dom;
  S.importFile=async file=>{
    if(!file)return;const {envelope:e,scans,count}=await S.attachments.parse(file);
    const restore=async include=>{
      e.packet.id='import-'+crypto.randomUUID();e.packet.revision=0;
      if(include){e.metadata.attachments={};for(const id of Object.keys(scans))e.metadata.attachments[id]={retained:true};}
      await S.repository.save(e,0,include?scans:{});location.href='intake.html?case='+e.packet.id;
    };
    S.dom.dialog(S.say('Import one case','একটি কেস ইম্পোর্ট'),el('div',{},el('p',{},e.packet.title[S.locale]||e.packet.title.en),el('p',{},S.say(`${e.packet.docs.length} documents. Source claims remain unverified.`,`${e.packet.docs.length}টি কাগজ। উৎসের দাবি যাচাইকৃত নয়।`)),count?el('p',{},S.say(`${count} source files are included. Restoring them keeps the scans on this device. Review approvals will be reset.`,`${count}টি উৎস ফাইল আছে। স্ক্যানসহ পুনরুদ্ধার করলে এই ডিভাইসে সংরক্ষিত থাকবে। পর্যালোচনার অনুমোদন নতুন করে দিতে হবে।`)):el('p',{},S.say('This file contains case data only; it has no source scans.','এই ফাইলে শুধু কেসের তথ্য আছে; উৎস স্ক্যান নেই।'))),count?[{label:S.say('Restore case and scans','কেস ও স্ক্যান পুনরুদ্ধার'),action:()=>restore(true)},{label:S.say('Import data only','শুধু তথ্য ইম্পোর্ট'),action:()=>restore(false)}]:[{label:S.say('Add case','কেস যোগ করুন'),action:()=>restore(false)}]);
  };
  S.pages.workspace=S.pages.cases=async main=>{
    if(new URLSearchParams(location.search).has('new')){await S.pages.setup(main);return;}
    main.append(S.heading(S.say('Your workspace','আপনার কর্মক্ষেত্র'),S.say('My cases','আমার কেস'),S.say('Pick up where you left off. Each case follows one plot and one proposed sale.','যেখান থেকে থেমেছেন সেখান থেকে শুরু করুন। প্রতি কেসে একটি জমি ও একটি প্রস্তাবিত বিক্রি থাকবে।')));
    const upload=el('input',{type:'file',accept:'.json,application/json',id:'import-case',onchange:event=>S.importFile(event.target.files[0]).catch(error=>message(S.attachments.errorText(error),true))});
    main.append(el('div',{class:'actions'},S.link(S.say('+ New case','+ নতুন কেস'),'setup.html',true),el('label',{class:'btn ghost',for:'import-case'},S.say('Restore a backup','ব্যাকআপ পুনরুদ্ধার')),el('span',{class:'visually-hidden'},upload)));
    const rows=(await S.repository.list()).sort((a,b)=>String(b.savedAt).localeCompare(String(a.savedAt))),list=el('div',{class:'case-grid'});
    const render=query=>{
      const shown=rows.filter(row=>[row.title.en,row.title.bn,row.mouza,row.seller].filter(Boolean).join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase()));list.replaceChildren();
      if(!shown.length){list.append(el('div',{class:'empty-state'},el('h2',{},S.say(rows.length?'No matching cases':'Start with the land you are considering',rows.length?'মিলে এমন কেস নেই':'যে জমির কথা ভাবছেন তা দিয়ে শুরু করুন')),el('p',{},S.say(rows.length?'Try the mouza, seller or case name.':'You will identify the plot and sale first, then add your documents. No draft is created until you continue.',rows.length?'মৌজা, বিক্রেতা বা কেসের নাম দিয়ে খুঁজুন।':'আগে জমি ও বিক্রি চিহ্নিত করে তারপর কাগজ যোগ করবেন। এগোনোর আগে খসড়া তৈরি হবে না।')),S.link(S.say('Start a case →','কেস শুরু করুন →'),'setup.html',true),S.link(S.say('See a worked example','সম্পূর্ণ উদাহরণ দেখুন'),'library.html')));return;}
      for(const row of shown){
        const next=!row.docCount?'intake':row.analysisCurrent?'audit':'review',status=!row.docCount?S.say('Add documents','কাগজ যোগ করুন'):row.analysisCurrent?S.say('Findings available','ফলাফল পাওয়া যাচ্ছে'):S.say('Review pending','পর্যালোচনা বাকি');
        const options=el('details',{class:'case-options'},el('summary',{},S.say('Case options','কেসের বিকল্প')),
          S.button(S.say('Back up including scans','স্ক্যানসহ ব্যাকআপ নিন'),async()=>S.attachments.backup(await S.repository.get(row.id)),true),
          S.button(S.say('Export case data only','শুধু কেসের তথ্য এক্সপোর্ট'),async()=>{const e=await S.repository.get(row.id);S.download(row.id+'.sutro.json',{schemaVersion:1,packet:e.packet,metadata:e.metadata});},true),
          S.button(S.say('Duplicate case data','কেসের তথ্য অনুলিপি'),async()=>{const e=await S.repository.get(row.id);e.packet.id='copy-'+crypto.randomUUID();e.storageRevision=0;e.packet.revision=0;e.metadata={origin:'copy',sourceRefs:e.metadata.sourceRefs||[],review:{},attachments:{},checklist:{}};await S.repository.save(e,0);location.href='setup.html?case='+e.packet.id;},true),
          S.button(S.say('Delete','মুছুন'),()=>S.confirm(S.say('Delete this case?','কেসটি মুছবেন?'),S.say('This removes the draft and its stored scans from this device. Download a backup first if you need a copy.','এই ডিভাইস থেকে খসড়া ও সংরক্ষিত স্ক্যান মুছে যাবে। কপি প্রয়োজন হলে আগে ব্যাকআপ নিন।'),async()=>{await S.repository.remove(row.id);location.reload();}),true));
        list.append(el('article',{class:'card case-card'},el('div',{class:'case-card-status'},S.badge(status,row.analysisCurrent?'neutral':'warning'),row.synthetic?S.badge(S.say('Synthetic example','কৃত্রিম উদাহরণ')):null),el('h2',{},S.link(row.title[S.locale]||row.title.en,next+'.html?case='+row.id)),el('p',{},[row.mouza,row.seller].filter(Boolean).join(' · ')),el('p',{class:'small muted'},S.say(`${row.docCount} documents · Last saved `,`${row.docCount}টি কাগজ · সংরক্ষিত `)+new Intl.DateTimeFormat(S.locale==='bn'?'bn-BD':'en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Dhaka'}).format(new Date(row.savedAt))),S.link(S.say('Resume →','চালিয়ে যান →'),next+'.html?case='+row.id,true),options));
      }
    };
    if(rows.length)main.append(S.field(S.say('Find a case','কেস খুঁজুন'),'',render));main.append(list);render('');
    main.append(el('p',{class:'workspace-help'},S.say('Learning how it works? ','কাজের ধারা জানতে চান? '),S.link(S.say('Open the example gallery →','উদাহরণগুলো দেখুন →'),'library.html')));
    main.append(el('details',{class:'storage-options'},el('summary',{},S.say('Storage & recovery','সংরক্ষণ ও পুনরুদ্ধার')),el('p',{},S.say('Browser data may be evicted and is not encrypted. Keep a separate backup including scans. Retained legacy originals remain until you deliberately clear local data.','ব্রাউজারের তথ্য মুছে যেতে পারে এবং এনক্রিপ্ট করা নয়। স্ক্যানসহ আলাদা ব্যাকআপ রাখুন। নিজে স্থানীয় তথ্য না মোছা পর্যন্ত পুরোনো মূল তথ্য থাকবে।')),S.button(S.say('Clear all local case data','সব স্থানীয় কেস মুছুন'),()=>S.confirm(S.say('Clear local data?','স্থানীয় তথ্য মুছবেন?'),S.say('Deletes all saved drafts, scans and retained legacy cases in this browser. Download backups first.','এই ব্রাউজারের সব খসড়া, স্ক্যান ও পুরোনো কেস মুছে যাবে। আগে ব্যাকআপ নিন।'),async()=>{await S.repository.clear();sessionStorage.removeItem('sutro.selected');location.reload();}),true)));
  };
})(window.Sutro);
