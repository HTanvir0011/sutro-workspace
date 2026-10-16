(function(root){
  'use strict';const isNode=typeof module!=='undefined'&&module.exports;
  const Fraction=isNode?require('../fraction').Fraction:root.Sutro.Fraction;
  function printedArea(acres,hundredths){const normalize=v=>String(v).replace(/[০-৯]/g,c=>String('০১২৩৪৫৬৭৮৯'.indexOf(c)));const a=normalize(acres||'0'),h=normalize(hundredths);if(!/^\d+$/.test(a)||!/^\d{4}$/.test(h))throw new Error('invalid-printed-area');return Fraction.from(a).mul(100).add(Fraction.from(h).div(100)).toString();}
  function map(record,rowId){
    if(record.kind!=='khatian'||!record.datasetVersion?.startsWith('form5462@'))return {status:'unsupported',reason:'unsupported-source'};
    const row=record.dagRows?.find(r=>r.id===rowId);if(!row)return {status:'incomplete',reason:'select-one-dag'};
    if(record.dagRows.filter(r=>r.dag===row.dag).length!==1)return {status:'incomplete',reason:'ambiguous-dag-rows'};
    const share=Fraction.tryFrom(row.shareInDag),area=Fraction.tryFrom(row.totalDecimals);
    if(!share?.eq(1))return {status:'incomplete',reason:'partial-interest'};
    if(!area?.gt(0))return {status:'incomplete',reason:'missing-plot-area'};
    const owners=(record.owners||[]).map(o=>({name:o.name,share:o.share}));
    if(!owners.length||owners.some(o=>!Fraction.tryFrom(o.share)||Fraction.from(o.share).isNegative())||!owners.reduce((n,o)=>n.add(o.share),Fraction.ZERO).eq(1))return {status:'incomplete',reason:'incomplete-owners'};
    return {status:'ready',doc:{id:'source-'+record.id,type:'khatian',survey:record.survey,khatianNo:record.khatianNo,year:record.year,dag:row.dag,area:row.totalDecimals,owners,provenance:'seller_copy'},source:{recordId:record.id,datasetVersion:record.datasetVersion,dagRowId:row.id,unitRule:'CSV totalDecimals is the whole plot area in decimals; acre column is redundant floor(totalDecimals/100). Printed 4-digit decimal cells are hundredths. Footer is not selected-plot area.',printedShares:record.owners.map(o=>({name:o.name,printed:o.printedShare,exact:o.share})),status:'user-reviewed-source-mapping'}};
  }
  if(isNode)module.exports={map,printedArea};else root.Sutro.mapping={map,printedArea};
})(typeof globalThis!=='undefined'?globalThis:this);
