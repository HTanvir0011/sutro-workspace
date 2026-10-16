"""Bounded conversion of compressed arrays into derived, memory-mapped training input."""
import concurrent.futures,csv,hashlib,json,os,shutil,sqlite3,sys,zipfile
from pathlib import Path
import numpy as np
from prepare import OUTPUT,pixels,config,PROJECT

def unpack(file):
    digest=hashlib.file_digest(file.open('rb'),'sha256').hexdigest();root=OUTPUT/'unpacked'/digest;root.mkdir(parents=True,exist_ok=True)
    with zipfile.ZipFile(file) as z:
        if sum(i.file_size for i in z.infolist())>shutil.disk_usage(root).free-1024**3:raise ValueError('unpack disk preflight')
        for entry in z.infolist():
            if '/' in entry.filename or '\\' in entry.filename or not entry.filename.endswith('.npy'):raise ValueError('unsupported NPZ member')
            target=root/entry.filename
            if target.exists() and target.stat().st_size==entry.file_size:continue
            partial=root/(entry.filename+'.partial')
            with z.open(entry) as source,partial.open('wb') as dest:shutil.copyfileobj(source,dest,1024*1024)
            os.replace(partial,target)
    return {file.stem:np.load(file,mmap_mode='r',allow_pickle=False) for file in root.glob('*.npy')}

def digit_shards(source):
    db=sqlite3.connect('file:'+str(OUTPUT/'digits.sqlite')+'?mode=ro',uri=True);digest=hashlib.file_digest((OUTPUT/'digits.sqlite').open('rb'),'sha256').hexdigest();output=OUTPUT/'digit-shards'/digest;output.mkdir(parents=True,exist_ok=True)
    lookup=None;packed=None
    if os.environ.get('NUMTA_NPZ'):
        file=Path(os.environ['NUMTA_NPZ']).resolve(strict=True);allowed=next(s['_root'] for s in config(PROJECT/'config/sources.example.json')['sources'] if s['id']=='processed-numta')
        if not file.is_relative_to(allowed):raise ValueError('NUMTA_NPZ must belong to its registered source')
        packed=unpack(file);lookup=sqlite3.connect(output/'packed-index.sqlite');lookup.execute('CREATE TABLE IF NOT EXISTS members(hash TEXT PRIMARY KEY,array_key TEXT,position INTEGER,label INTEGER)');lookup.execute('DELETE FROM members')
        for split in ['train','val']:
            x,y=packed['x_'+split],packed['y_'+split]
            if x.shape[1:]!=(32,32) or x.dtype!=np.uint8:raise ValueError('invalid packed digit array')
            for i in range(len(x)):lookup.execute('INSERT OR IGNORE INTO members VALUES(?,?,?,?)',(hashlib.sha256(x[i].tobytes()).hexdigest(),'x_'+split,i,int(y[i])))
        lookup.commit()
    reports=[]
    for split in ['train','val','test']:
        count=db.execute('SELECT COUNT(*) FROM samples WHERE split=?',(split,)).fetchone()[0];file=output/(split+'.npy')
        if file.exists():
            array=np.load(file,mmap_mode='r',allow_pickle=False)
            if array.shape==(count,32,32):reports.append({'split':split,'samples':count,'reused':True});continue
        target=output/(split+'.partial.npy');array=np.lib.format.open_memmap(target,mode='w+',dtype=np.uint8,shape=(count,32,32))
        rows=db.execute('SELECT ordinal,path,label,hash FROM samples WHERE split=? ORDER BY ordinal',(split,))
        if lookup:
            for ordinal,path,label,digest in rows:
                match=lookup.execute('SELECT array_key,position,label FROM members WHERE hash=?',(digest,)).fetchone()
                if not match or match[2]!=label:raise ValueError('packed/raw lineage mismatch')
                array[ordinal]=packed[match[0]][match[1]]
        else:
            def read(row):
                ordinal,path,label,digest=row;data=pixels(source['_root']/path)
                if hashlib.sha256(data.tobytes()).hexdigest()!=digest:raise ValueError('digit source changed')
                return ordinal,data
            with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
                for ordinal,data in pool.map(read,rows,buffersize=64):array[ordinal]=data
        array.flush();del array;os.replace(target,file);reports.append({'split':split,'samples':count,'reused':False})
    db.close()
    if lookup:lookup.close()
    print(json.dumps({'phase':'digit-shards','splits':reports,'inputMode':'packed-parent-equivalent' if packed else 'original-images'}),flush=True)
    return output

def line_shards():
    registry=config(PROJECT/'config/sources.example.json');registered=next(s['_root'] for s in registry['sources'] if s['id']=='packed-crops');root=Path(os.environ.get('CELLS_DIR',registered)).resolve(strict=True)
    if root!=registered:raise ValueError('CELLS_DIR must match registered packed-crops root')
    db=sqlite3.connect('file:'+str(OUTPUT/'lines.sqlite')+'?mode=ro',uri=True);out={}
    for split in ['train','val','test']:
        arrays=unpack(root/('cells_'+split+'.npz'));data,widths=arrays['data'],arrays['widths'];count=db.execute('SELECT COUNT(*) FROM samples WHERE split=?',(split,)).fetchone()[0]
        if len(widths)!=count or data.shape[0]!=40 or widths.max()>1024 or widths.min()<16:raise ValueError('unsupported crop dimensions')
        offsets=np.empty(count+1,dtype=np.int64);offsets[0]=0;np.cumsum(widths,out=offsets[1:])
        if offsets[-1]!=data.shape[1]:raise ValueError('packed strip width mismatch')
        with (root/('cells_'+split+'.csv')).open(encoding='utf-8',newline='') as stream:
            for i,row in enumerate(csv.DictReader(stream)):
                expected=db.execute('SELECT label,field,page FROM samples WHERE split=? AND ordinal=?',(split,i)).fetchone()
                if expected!=(row['text'],row['field_type'],row['page_id']):raise ValueError('packed label/source order mismatch')
        out[split]=(data,widths,offsets)
    db.close();return out
