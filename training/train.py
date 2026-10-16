"""Offline supervised training, validation-only selection, one frozen test evaluation and ONNX export."""
import os
os.environ.setdefault('CUBLAS_WORKSPACE_CONFIG',':4096:8')
import argparse,collections,hashlib,json,random,shutil,sqlite3,time
from pathlib import Path
import numpy as np
import torch
from torch import nn
from prepare import OUTPUT,PROJECT,config,dump
from shards import digit_shards,line_shards
from models import digit,LineReader

def edit_distance(a,b):
    row=list(range(len(b)+1))
    for i,x in enumerate(a,1):
        new=[i]
        for j,y in enumerate(b,1):new.append(min(new[-1]+1,row[j]+1,row[j-1]+(x!=y)))
        row=new
    return row[-1]

class Samples(torch.utils.data.Dataset):
    def __init__(self,task,split,arrays,chars):
        self.task,self.split,self.arrays,self.chars=task,split,arrays,chars;self.db=sqlite3.connect('file:'+str(OUTPUT/('digits.sqlite' if task=='digit' else 'lines.sqlite'))+'?mode=ro',uri=True);self.count=self.db.execute('SELECT COUNT(*) FROM samples WHERE split=?',(split,)).fetchone()[0]
    def __len__(self):return self.count
    def __getitem__(self,index):
        row=self.db.execute('SELECT label,field,path FROM samples WHERE split=? AND ordinal=?',(self.split,index)).fetchone();label,field,path=row
        if self.task=='digit':x=torch.from_numpy(np.asarray(self.arrays[index]).astype(np.float32)/255).unsqueeze(0);target=torch.tensor(int(label),dtype=torch.long)
        else:
            data,widths,offsets=self.arrays;x=torch.from_numpy(np.asarray(data[:,offsets[index]:offsets[index+1]]).astype(np.float32)/255);x=(x-.5)/.5;target=torch.tensor([self.chars.get(c,0) for c in label],dtype=torch.long)
        return x,target,str(label),field,path

def collate_line(batch):
    width=max(x.shape[1] for x,*_ in batch);width+=(4-width%4)%4
    X=torch.ones(len(batch),1,40,width)
    for i,(x,*_) in enumerate(batch):X[i,0,:,:x.shape[1]]=x
    lengths=torch.tensor([x.shape[1]//4 for x,*_ in batch]);targets=torch.cat([y for _,y,*_ in batch]);target_lengths=torch.tensor([len(y) for _,y,*_ in batch])
    if any(l<t for l,t in zip(lengths,target_lengths)):raise ValueError('CTC sample too short; no silent zero-loss drop')
    return X,targets,lengths,target_lengths,[row[2] for row in batch],[row[3] for row in batch]

def decode(output,chars):
    indices=output.argmax(2).transpose(0,1).tolist();texts=[]
    for row in indices:
        previous=0;text=''
        for index in row:
            if index!=previous and index:text+=chars[index-1]
            previous=index
        texts.append(text)
    return texts

@torch.inference_mode()
def evaluate(model,loader,task,device,chars):
    model.eval();n=correct=0;confusion=np.zeros((10,10),dtype=np.int64);fields=collections.defaultdict(lambda:{'n':0,'exact':0,'edits':0,'chars':0});start=time.monotonic()
    for batch in loader:
        if task=='digit':
            x,y,*_=batch;pred=model(x.to(device)).argmax(1).cpu().numpy();actual=y.numpy()
            for a,b in zip(actual,pred):confusion[a,b]+=1
            n+=len(y);correct+=int((pred==actual).sum())
        else:
            x,_,lengths,_,truth,kinds=batch;output=model(x.to(device)).cpu()
            for i,(text,kind) in enumerate(zip(truth,kinds)):
                pred=decode(output[:lengths[i],i:i+1],chars)[0];f=fields[kind];f['n']+=1;f['exact']+=int(pred==text);f['edits']+=edit_distance(pred,text);f['chars']+=len(text);n+=1
    if task=='digit':
        scores=[]
        for c in range(10):tp=int(confusion[c,c]);den=int(confusion[c].sum()+confusion[:,c].sum());scores.append(2*tp/den if den else 0)
        return {'n':n,'accuracy':correct/n,'macroF1':sum(scores)/10,'confusion':confusion.tolist(),'seconds':time.monotonic()-start}
    edits=sum(f['edits'] for f in fields.values());characters=sum(f['chars'] for f in fields.values());exact=sum(f['exact'] for f in fields.values());critical=[f for k,f in fields.items() if k in ['dag_no','area_dec','total_dec','share_in_dag','owner_share']];numeric_n=sum(f['n'] for f in critical)
    return {'n':n,'cer':edits/max(1,characters),'exact':exact/n,'criticalNumericExact':sum(f['exact'] for f in critical)/max(1,numeric_n),'perField':dict(fields),'seconds':time.monotonic()-start}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('task',choices=['digit','line']);parser.add_argument('--epochs',type=int);parser.add_argument('--batch',type=int);parser.add_argument('--device',choices=['cuda','cpu'],default='cuda');args=parser.parse_args();task=args.task;epochs=args.epochs or (20 if task=='digit' else 30);batch=args.batch or (64 if task=='digit' else 16)
    if not 1<=epochs<=200 or not 1<=batch<=128:raise ValueError('training limits')
    thresholds=json.loads((PROJECT/'training/thresholds.json').read_text());seed=thresholds['seed'];random.seed(seed);np.random.seed(seed);torch.manual_seed(seed);torch.set_num_threads(4)
    if args.device=='cuda':
        if not torch.cuda.is_available():raise RuntimeError('CUDA runtime unavailable; use an explicit CPU run or configure a maintained compatible environment')
        torch.cuda.set_per_process_memory_fraction(.70);probe=torch.ones(8,device='cuda');probe.mul_(2);torch.cuda.synchronize()
    if shutil.disk_usage(OUTPUT).free<3*1024**3:raise RuntimeError('training disk preflight')
    registry=config(PROJECT/'config/sources.example.json');source=next(s for s in registry['sources'] if s['id']==('numta' if task=='digit' else 'form5462'));manifest=json.loads((OUTPUT/('digit-manifest.json' if task=='digit' else 'line-manifest.json')).read_text(encoding='utf-8'));chars=manifest.get('chars',[]);c2i={c:i+1 for i,c in enumerate(chars)}
    if task=='digit':root=digit_shards(source);arrays={split:np.load(root/(split+'.npy'),mmap_mode='r',allow_pickle=False) for split in ['train','val','test']}
    else:arrays=line_shards()
    loaders={split:torch.utils.data.DataLoader(Samples(task,split,arrays[split],c2i),batch_size=batch,shuffle=split=='train',num_workers=0,collate_fn=collate_line if task=='line' else None) for split in ['train','val','test']}
    run=PROJECT/'training/runs'/(task+'-'+time.strftime('%Y%m%dT%H%M%SZ',time.gmtime()));run.mkdir(parents=True,exist_ok=False);(run/'dataset-manifest.json').write_text(dump(manifest),encoding='utf-8');(run/'thresholds.json').write_text(dump(thresholds),encoding='utf-8')
    model=(digit() if task=='digit' else LineReader(len(chars)+1)).to(args.device);lr=.002 if task=='digit' else .0005;optimizer=torch.optim.AdamW(model.parameters(),lr=lr,weight_decay=.01);scheduler=torch.optim.lr_scheduler.OneCycleLR(optimizer,max_lr=lr,epochs=epochs,steps_per_epoch=len(loaders['train']),pct_start=.15);criterion=nn.CrossEntropyLoss() if task=='digit' else nn.CTCLoss(blank=0,zero_infinity=False)
    info={'task':task,'seed':seed,'epochs':epochs,'batch':batch,'device':args.device,'gpu':torch.cuda.get_device_name(0) if args.device=='cuda' else None,'torch':torch.__version__,'thresholdHash':hashlib.sha256((PROJECT/'training/thresholds.json').read_bytes()).hexdigest(),'source':source['id']+'@'+source['version'],'sourceArrays':'memory-mapped derived files; not eager NPZ','rawRootsModified':False,'scope':thresholds[task]['scope']};(run/'config.json').write_text(dump(info),encoding='utf-8');best=-float('inf');history=[]
    for epoch in range(epochs):
        model.train();loss_sum=steps=0;start=time.monotonic()
        for batch_data in loaders['train']:
            optimizer.zero_grad(set_to_none=True)
            if task=='digit':x,y,*_=batch_data;loss=criterion(model(x.to(args.device)),y.to(args.device))
            else:x,y,lengths,target_lengths,*_=batch_data;loss=criterion(model(x.to(args.device)),y.to(args.device),lengths,target_lengths)
            if not torch.isfinite(loss):raise RuntimeError('non-finite loss; no sample silently dropped')
            loss.backward();nn.utils.clip_grad_norm_(model.parameters(),5);optimizer.step();scheduler.step();loss_sum+=float(loss.detach());steps+=1
        validation=evaluate(model,loaders['val'],task,args.device,chars);score=validation['accuracy'] if task=='digit' else -validation['cer'];entry={'epoch':epoch+1,'trainLoss':loss_sum/steps,'validation':validation,'seconds':time.monotonic()-start};history.append(entry)
        if score>best:best=score;torch.save(model.state_dict(),run/'best.pt')
        (run/'history.json').write_text(dump(history),encoding='utf-8');print(dump({'run':run.name,**entry}),flush=True)
    model.load_state_dict(torch.load(run/'best.pt',map_location=args.device,weights_only=True));test=evaluate(model,loaders['test'],task,args.device,chars);test['denominatorNote']='All retained held-out rows included; exclusions/quarantines in dataset-manifest.json. Not real-form/legal accuracy.'
    model.eval().cpu();dummy=torch.zeros(1,1,32,32) if task=='digit' else torch.zeros(1,1,40,128);name='logits' if task=='digit' else 'logprobs';target=run/'model.onnx';dynamic={'image':{0:'b'},name:{0:'b'}} if task=='digit' else {'image':{0:'b',3:'w'},name:{0:'t',1:'b'}}
    torch.onnx.export(model,dummy,str(target),input_names=['image'],output_names=[name],dynamic_axes=dynamic,opset_version=17,dynamo=False)
    import onnx,onnxruntime as ort
    onnx.checker.check_model(str(target));session=ort.InferenceSession(str(target),providers=['CPUExecutionProvider']);parity=[]
    for width in ([32] if task=='digit' else [64,128,320]):
        sample=torch.zeros(1,1,32 if task=='digit' else 40,width);a=model(sample).detach().numpy();b=session.run(None,{'image':sample.numpy()})[0];difference=float(np.max(np.abs(a-b)));parity.append({'width':width,'maxAbsDiff':difference})
    passed=(test['accuracy']>=thresholds['digit']['accuracyMin'] and test['macroF1']>=thresholds['digit']['macroF1Min']) if task=='digit' else (test['cer']<=thresholds['line']['cerMax'] and test['exact']>=thresholds['line']['exactMin'] and test['criticalNumericExact']>=thresholds['line']['criticalNumericExactMin'])
    result={'test':test,'thresholdsPassed':passed,'onnxParity':parity,'modelSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'browserParity':'required before promotion','realFormsAccepted':False,'promotion':'experimental until browser/latency/memory and task gates pass'};(run/'metrics.json').write_text(dump(result),encoding='utf-8');(run/'preprocessing.json').write_text(dump({'height':32 if task=='digit' else 40,'input':'float32 NCHW','normalization':'ink-bright [0,1]' if task=='digit' else '(gray/255-.5)/.5','chars':chars,'classes':list('০১২৩৪৫৬৭৮৯'),'ctcBlank':0}),encoding='utf-8');print(dump({'run':run.name,**result}),flush=True)

if __name__=='__main__':main()
