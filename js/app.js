/* Static-first bootstrap. Controllers own presentation; domain rules stay in engine.js. */
(async function(S){
  'use strict';
  const main=document.getElementById('main');
  try { await S.repository.migrate(); } catch(error) { S.migrationError=error; }
  const page=document.body.dataset.page;
  if(['intake','review','timeline','audit','report'].includes(page)||page==='setup'&&new URLSearchParams(location.search).has('case'))await S.loadCase();
  S.shell();
  if(S.casePages.includes(page)&&page!=='setup'&&!S.envelope){main.append(S.heading(S.say('Your workspace','আপনার কর্মক্ষেত্র'),S.say('Choose a case to continue','এগিয়ে যেতে একটি কেস বেছে নিন'),S.say(S.loadError?'The saved case could not be opened. Retry without replacing it, or return to your cases.':'Open a saved case or start by identifying the land and proposed sale.',S.loadError?'সংরক্ষিত কেস খোলা যায়নি। তথ্য না বদলে আবার চেষ্টা করুন বা আমার কেসে ফিরুন।':'সংরক্ষিত কেস খুলুন বা জমি ও প্রস্তাবিত বিক্রি দিয়ে শুরু করুন।')),S.link(S.say('My cases','আমার কেস'),'workspace.html',true),S.link(S.say('Start a new case','নতুন কেস শুরু করুন'),'setup.html'));return;}
  if(S.loadError){S.setSaveStatus(S.say('Save failed — retry or export','সংরক্ষণ হয়নি — আবার চেষ্টা বা এক্সপোর্ট'));main.append(S.dom.el('p',{class:'status-message error',role:'alert'},S.say('Storage is unavailable. This draft is unsaved; export before leaving.','সংরক্ষণ পাওয়া যাচ্ছে না। খসড়াটি সংরক্ষিত নয়; বের হওয়ার আগে এক্সপোর্ট করুন।')));}
  if(S.migrationError)main.append(S.dom.el('p',{class:'status-message error',role:'alert'},S.say('Legacy migration failed. Originals are retained; recover before clearing storage.','পুরোনো তথ্য স্থানান্তর হয়নি। মূল তথ্য রাখা আছে; সংরক্ষণ মোছার আগে উদ্ধার করুন।')));
  try { S.pageCleanup=await (S.pages[page]||S.pages.home)(main); }
  catch(error) { main.append(S.dom.el('div',{class:'empty-state',role:'alert'},S.dom.el('h2',{},S.say('This view could not be opened.','পাতাটি খোলা যায়নি।')),S.dom.el('p',{},S.say('Retry or return to My cases.','আবার চেষ্টা করুন বা আমার কেসে ফিরুন।')),S.link(S.say('My cases','আমার কেস'),'workspace.html'))); console.error(error.message); }
})(window.Sutro);
