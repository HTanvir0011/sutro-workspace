'use strict';
const fs=require('node:fs'),path=require('node:path'),readline=require('node:readline'),crypto=require('node:crypto');
const {analyze,ENGINE_VERSION}=require('../js/engine');
(async()=>{
  const root=path.resolve(__dirname,'..'),registry=JSON.parse(fs.readFileSync(path.join(root,'config/sources.example.json'),'utf8')),source=registry.sources.find(s=>s.id==='reasoning'),docs=fs.realpathSync(path.join(root,'docs')),input=fs.realpathSync(path.join(docs,source.root));if(!input.startsWith(docs+path.sep))throw new Error('Invalid source');
  const report={engineVersion:ENGINE_VERSION,scope:'same-author generator/engine consistency; not independent legal or OCR accuracy',total:0,matched:0,mismatched:0,errors:0,sources:[],examples:[]};
  for(const name of fs.readdirSync(input).filter(n=>n.endsWith('.jsonl')).sort()){
    const hash=crypto.createHash('sha256'),stream=fs.createReadStream(path.join(input,name));stream.on('data',data=>hash.update(data));const lines=readline.createInterface({input:stream,crlfDelay:Infinity});
    for await(const line of lines){if(!line.trim())continue;if(Buffer.byteLength(line)>2097152)throw new Error('Over-limit packet');const packet=JSON.parse(line),labels=packet.labels||{},actual=analyze(packet),codes=new Set(actual.findings.map(f=>f.code)),expected=new Set(labels.expect_includes||[]),allowed=new Set([...expected,...labels.allowed_side_effects||[]]);const missing=[...expected].filter(c=>!codes.has(c)),unexpected=[...codes].filter(c=>!allowed.has(c)),offerMismatch=labels.offer_chain_status&&labels.offer_chain_status!='any'&&actual.offer?.chain.status!==labels.offer_chain_status;report.total++;if(!missing.length&&!unexpected.length&&!offerMismatch&&!actual.inputErrors.length)report.matched++;else{report.mismatched++;if(actual.inputErrors.length)report.errors++;if(report.examples.length<20)report.examples.push({id:packet.id,missing,unexpected,offerMismatch:!!offerMismatch,inputErrors:actual.inputErrors.length});}}
    report.sources.push({name,sha256:hash.digest('hex')});
  }
  fs.writeFileSync(path.join(root,'docs/.runtime/packet-evaluation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(report.mismatched)process.exitCode=1;
})().catch(error=>{console.error(error.message);process.exitCode=1;});
