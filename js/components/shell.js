(function(S){
  'use strict';
  const {el,message,dialog,download}=S.dom;
  S.say=(en,bn)=>S.locale==='bn'?bn:en;
  S.t=(key,params)=>S.i18n.t(S.locale,key,params);
  S.number=value=>S.i18n.digits(String(value),S.locale);
  S.button=(text,action,ghost=false)=>el('button',{class:'btn'+(ghost?' ghost':''),type:'button',onclick:async event=>{const button=event.currentTarget;if(button.disabled)return;button.disabled=true;try{await action(event);}catch(error){message(S.say('Could not complete this action. Retry or back up your draft.','কাজটি শেষ হয়নি। আবার চেষ্টা করুন বা খসড়ার ব্যাকআপ নিন।'),true);}finally{button.disabled=false;}}},text);
  S.link=(text,href,primary=false)=>el('a',{class:primary?'btn':'',href},text);
  S.heading=(eyebrow,title,description)=>el('div',{class:'page-heading'},el('p',{class:'eyebrow'},eyebrow),el('h1',{},title),description?el('p',{class:'lede'},description):null);
  S.badge=(text,tone='neutral')=>el('span',{class:'badge '+tone},text);
  S.field=(label,value,change,options={})=>{const id='field-'+crypto.randomUUID();const control=options.values?el('select',{id,onchange:e=>change(e.target.value,e.target)},options.values.map(v=>el('option',{value:typeof v==='string'?v:v[0]},typeof v==='string'?v:v[1]))):el('input',{id,value:value??'',type:options.type||'text',inputmode:options.numeric?'decimal':null,maxlength:options.max||2000,required:options.required,oninput:e=>change(e.target.value,e.target)});control.value=value??'';control.setAttribute('aria-labelledby',id+'-label');if(options.help)control.setAttribute('aria-describedby',id+'-help');let list;if(options.suggestions?.length){control.setAttribute('list',id+'-list');list=el('datalist',{id:id+'-list'},options.suggestions.map(value=>el('option',{value})));}return el('label',{class:'field',for:id},el('span',{id:id+'-label'},label),control,list,options.help?el('small',{id:id+'-help'},options.help):null);};
  S.shell=function(){
    const page=document.body.dataset.page,workspace=['workspace','cases','setup','intake','review','timeline','audit','report'].includes(page);
    const nav=el('nav',{id:'primary-nav','aria-label':S.say('Main navigation','প্রধান নেভিগেশন')});
    const items=workspace?[[S.say('My cases','আমার কেস'),'workspace.html','workspace'],[S.say('Help & scope','সহায়তা ও পরিধি'),'about.html','about']]:[[S.say('Home','প্রচ্ছদ'),'index.html','home'],[S.say('Examples','উদাহরণ'),'library.html','library'],[S.say('How it works','যেভাবে কাজ করে'),'about.html','about'],[S.say('My cases','আমার কেস'),'workspace.html','workspace']];
    for(const [label,href,key]of items)nav.append(el('a',{href,'aria-current':key===page?'page':null},label));
    nav.append(S.button(S.locale==='bn'?'English':'বাংলা',async()=>{await S.flush?.();S.exitWorkspace(()=>{localStorage.setItem('sutro.lang',S.locale==='bn'?'en':'bn');location.reload();});},true));
    const toggle=el('button',{class:'menu-toggle',type:'button','aria-expanded':'false','aria-controls':'primary-nav',onclick:()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));nav.classList.toggle('open',open);}},S.say('Menu','মেনু'));
    nav.addEventListener('keydown',event=>{if(event.key==='Escape'){toggle.setAttribute('aria-expanded','false');nav.classList.remove('open');toggle.focus();}});
    document.body.prepend(el('header',{class:'site-header'},el('a',{href:'#main',class:'skip'},S.say('Skip to content','মূল বিষয়ে যান')),el('div',{class:'masthead'},el('a',{class:'brand',href:'index.html'},el('span',{class:'brand-mark','aria-hidden':'true'},'সূ'),el('span',{},el('strong',{},S.say('Sutro','সূত্র')),el('small',{},S.say('Land evidence, made clear','জমির তথ্য, স্পষ্টভাবে')))),toggle,nav)));
    document.body.append(el('footer',{class:'footer'},el('div',{},el('strong',{},S.say('Sutro','সূত্র')),el('p',{},S.say('Understand the evidence you hold. Decide with qualified advice.','আপনার কাগজপত্র বুঝুন। যোগ্য পরামর্শ নিয়ে সিদ্ধান্ত নিন।'))),el('div',{},S.link(S.say('Method & limitations','পদ্ধতি ও সীমাবদ্ধতা'),'about.html'),el('p',{},S.say('Device-local cases · No government connection','নিজের ডিভাইসে কেস · সরকারি সংযোগ নেই')))));
    S.renderCaseContext();
    document.addEventListener('click',async e=>{const a=e.target.closest('a[href]');if(!a||a.target||a.download||e.ctrlKey||e.metaKey||e.shiftKey||e.altKey||e.button>0||a.origin!==location.origin)return;if(a.hash&&!a.hash.startsWith('#doc-')&&a.pathname===location.pathname&&a.search===location.search)return;const url=new URL(a.href),page=url.pathname.split('/').pop()?.replace('.html','');if(S.envelope&&S.casePages.includes(page)&&url.searchParams.get('case')===S.envelope.packet.id){e.preventDefault();try{await S.flush();await S.navigateCase(url);}catch{message(S.say('Save failed. Back up your draft or retry before leaving.','সংরক্ষণ হয়নি। বের হওয়ার আগে ব্যাকআপ নিন বা আবার চেষ্টা করুন।'),true);}return;}if(a.hash&&a.pathname===location.pathname)return;if(S.hasSessionSources()){e.preventDefault();try{await S.flush();S.exitWorkspace(()=>{location.href=a.href;});}catch{}return;}if(S.dirty||S.saving){e.preventDefault();try{await S.flush();location.href=a.href;}catch{message(S.say('Save failed. Back up your draft or retry before leaving.','সংরক্ষণ হয়নি। বের হওয়ার আগে ব্যাকআপ নিন বা আবার চেষ্টা করুন।'),true);}}});
  };
  S.casePages=['setup','intake','review','timeline','audit','report'];
  S.renderCaseContext=()=>{
    document.querySelector('.case-context')?.remove();
    const page=document.body.dataset.page;if(!S.envelope||!S.casePages.includes(page))return;
    const p=S.envelope.packet,w=S.workflow.inspect(S.envelope),main=document.getElementById('main');
    const steps=[['setup','Land & sale','জমি ও বিক্রি'],['intake','Documents','কাগজপত্র'],['review','Review','পর্যালোচনা'],['audit','Findings','ফলাফল'],['report','Report','প্রতিবেদন']];
    main.before(el('div',{class:'case-context'},el('div',{class:'case-context-inner'},el('div',{},el('a',{href:'workspace.html',class:'backlink'},S.say('← My cases','← আমার কেস')),el('strong',{},p.title[S.locale]||p.title.en),el('p',{class:'case-subtitle'},[p.plot.mouza,p.offer.seller,Object.values(p.plot.dags||{}).filter(Boolean).join(' / ')].filter(Boolean).join(' · ')),el('span',{id:'case-readiness'},S.badge(S.workflow.label(w.state),w.reviewed?'neutral':'warning')),p.synthetic?S.badge(S.say('Synthetic example','কৃত্রিম উদাহরণ')):null),el('div',{class:'save-tools'},el('span',{id:'save-status',role:'status'},S.dirty?S.say('Unsaved changes','পরিবর্তন সংরক্ষিত হয়নি'):S.say('Saved on this device','এই ডিভাইসে সংরক্ষিত')),S.button(S.say('Export case','কেস এক্সপোর্ট'),()=>S.exportCase(),true))),el('nav',{'aria-label':S.say('Case steps','কেসের ধাপ'),class:'steps'},steps.map(([key,en,bn],index)=>el('a',{href:key+'.html?case='+encodeURIComponent(p.id),'aria-current':page===key||page==='timeline'&&key==='audit'?'step':null},el('span',{},String(index+1)),S.say(en,bn))))));
  };
  let routeSequence=0;
  S.navigateCase=async(url,push=true)=>{
    const seq=++routeSequence;
    S.pageCleanup?.();S.pageCleanup=null;S.ocrClient?.cancel();
    const page=url.pathname.split('/').pop().replace('.html','');document.body.dataset.page=page;
    if(push)history.pushState(null,'',url.pathname+url.search+url.hash);
    const main=el('main',{id:'main',class:'page',tabindex:'-1'});document.getElementById('main').replaceWith(main);S.renderCaseContext();
    const cleanup=await S.pages[page](main);if(seq!==routeSequence){cleanup?.();return;}S.pageCleanup=cleanup;document.title='Sutro · '+main.querySelector('h1')?.textContent;
    const heading=main.querySelector('h1');heading?.setAttribute('tabindex','-1');heading?.focus();window.scrollTo(0,0);
  };
  window.addEventListener('popstate',()=>{const url=new URL(location.href),page=url.pathname.split('/').pop().replace('.html','');if(S.envelope&&S.casePages.includes(page)&&url.searchParams.get('case')===S.envelope.packet.id)S.flush().then(()=>S.navigateCase(url,false)).catch(()=>location.reload());else location.reload();});
  S.confirm=(title,description,action)=>dialog(title,el('p',{},description),[{label:S.say('Confirm','নিশ্চিত করুন'),action}]);
  S.download=download;
})(window.Sutro);
