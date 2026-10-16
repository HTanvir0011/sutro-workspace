(function(root){
  'use strict';
  const S=root.Sutro;
  function inspect(envelope){
    const p=envelope.packet,issues=[];
    const add=(key,en,bn,docId)=>issues.push({key,en,bn,docId});
    if(!p.plot.mouza?.trim())add('mouza','Add the mouza name.','মৌজার নাম লিখুন।');
    if(!Object.values(p.plot.dags||{}).some(v=>String(v).trim()))add('dag','Identify the selected dag and its survey.','নির্বাচিত দাগ ও জরিপ লিখুন।');
    if(!p.offer.seller?.trim())add('seller','Name the proposed seller.','প্রস্তাবিত বিক্রেতার নাম লিখুন।');
    try{S.validation.rational(p.offer.area,'area');if(!S.Fraction.from(p.offer.area).gt(0))throw new Error();}catch{add('area','Enter the offered area in decimals, greater than zero.','প্রস্তাবিত জমির পরিমাণ শূন্যের বেশি শতাংশে লিখুন।');}
    if(!p.docs.length)add('documents','Add at least one document you actually hold.','আপনার হাতে থাকা অন্তত একটি কাগজ যোগ করুন।');
    if(!p.docs.some(d=>d.type==='khatian'))add('root','Add an opening khatian so the account has a starting point.','হিসাব শুরু করতে একটি প্রাথমিক খতিয়ান যোগ করুন।');
    const required={khatian:['khatianNo','year','dag','area'],deed:['deedNo','year','dag'],mutation:['caseNo','year','deedNo'],heirCert:['decedent','deathYear'],search:['fromYear','toYear']};
    for(const doc of p.docs){
      const missing=(required[doc.type]||[]).filter(key=>!String(doc[key]??'').trim());
      const groups=doc.type==='khatian'?['owners']:doc.type==='deed'?['sellers','buyers']:doc.type==='heirCert'?['heirs']:[];
      if(missing.length||groups.some(key=>!doc[key]?.length||doc[key].some(row=>!row.name?.trim()||('share'in row&&!String(row.share).trim())||('area'in row&&!String(row.area).trim()))))add('required:'+doc.id,'Complete the required document values, names and amounts.','কাগজের প্রয়োজনীয় তথ্য, নাম ও পরিমাণ পূরণ করুন।',doc.id);
    }
    const analysis=S.analyze(p);
    for(const error of analysis.inputErrors)add('input:'+error.docId+':'+error.field,'Correct an invalid date, amount or share in this document.','এই কাগজের ভুল সাল, পরিমাণ বা অংশ সংশোধন করুন।',error.docId);
    const unreviewed=p.docs.filter(d=>envelope.metadata.review?.[d.id+'.document']?.status!=='user-reviewed');
    const ready=!issues.length,reviewed=ready&&!unreviewed.length;
    const analyzed=reviewed&&Number.isSafeInteger(envelope.metadata.analysisRevision)&&envelope.metadata.analysisRevision===(p.revision||0);
    const state=analyzed?'findings':reviewed?'ready':p.docs.length||p.offer.seller?'needs-information':'draft';
    return {issues,unreviewed,ready,reviewed,analyzed,state,analysis};
  }
  const labels={draft:['Draft','খসড়া'],'needs-information':['Needs review','পর্যালোচনা প্রয়োজন'],ready:['Ready for analysis','বিশ্লেষণের জন্য প্রস্তুত'],findings:['Findings available','ফলাফল পাওয়া যাচ্ছে']};
  function label(state){return S.say(...(labels[state]||labels.draft));}
  function invalidateDocument(id){
    const review=S.envelope.metadata.review||={};
    if(review[id+'.document'])review[id+'.document'].status='unreviewed';
    const box=document.querySelector('[data-review-document="'+id+'"]');if(box)box.checked=false;
  }
  S.workflow={inspect,label,invalidateDocument};
  if(typeof module!=='undefined'&&module.exports)module.exports={inspect};
})(typeof window==='undefined'?globalThis:window);
