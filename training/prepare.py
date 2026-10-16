"""Prepare disk-backed sample manifests; source files are immutable and never mixed as extra examples."""
import argparse, concurrent.futures, csv, hashlib, json, os, sqlite3, sys, time
from pathlib import Path
import numpy as np
from PIL import Image
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools/data'))
from catalog import PROJECT,RUNTIME,config,dump
Image.MAX_IMAGE_PIXELS=25000000
OUTPUT=RUNTIME/'training'

def pixels(path):
    with Image.open(path) as image:
        if image.width*image.height>25000000:raise ValueError('image pixel limit')
        return 255-np.asarray(image.convert('L').resize((32,32),Image.Resampling.BILINEAR),dtype=np.uint8)

def prepare_digit(source):
    OUTPUT.mkdir(exist_ok=True);target=OUTPUT/'digits.sqlite';temp=OUTPUT/'digits.building.sqlite'
    if temp.exists():temp.unlink()
    db=sqlite3.connect(temp);db.executescript('CREATE TABLE heldout(hash TEXT PRIMARY KEY);CREATE TABLE candidates(path TEXT PRIMARY KEY,label INTEGER,hash TEXT,raw_hash TEXT,role TEXT);CREATE INDEX family ON candidates(hash);CREATE TABLE samples(split TEXT,ordinal INTEGER,path TEXT,label INTEGER,field TEXT,hash TEXT,PRIMARY KEY(split,ordinal));')
    inv=sqlite3.connect('file:'+str(RUNTIME/'inventory.sqlite')+'?mode=ro',uri=True)
    tests=inv.execute("SELECT relative_path,sha256 FROM inventory WHERE dataset=? AND split LIKE 'testing-%' AND kind IN ('.png','.jpg') GROUP BY sha256",(source['id'],))
    count=0;start=time.monotonic()
    def test_hash(row):return hashlib.sha256(pixels(source['_root']/row[0]).tobytes()).hexdigest()
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
        for digest in pool.map(test_hash,tests,buffersize=64):db.execute('INSERT OR IGNORE INTO heldout VALUES(?)',(digest,));count+=1
    print(dump({'phase':'digit-test-family-audit','uniqueOriginalImages':count,'seconds':round(time.monotonic()-start)}),flush=True)
    def candidates():
        for file in sorted(source['_root'].glob('training-*.csv')):
            folder=file.stem
            with file.open(encoding='utf-8-sig',newline='') as stream:
                for row in csv.DictReader(stream):
                    label=int(row['digit']);relative=folder+'/'+row['filename']
                    if label not in range(10) or '/' in row['filename'] or '\\' in row['filename']:raise ValueError('invalid digit label')
                    raw=inv.execute('SELECT sha256 FROM inventory WHERE dataset=? AND relative_path=?',(source['id'],relative)).fetchone()
                    if not raw:raise ValueError('missing labelled original digit')
                    yield relative,label,raw[0]
    def transform(row):
        relative,label,raw=row
        return relative,label,hashlib.sha256(pixels(source['_root']/relative).tobytes()).hexdigest(),raw,'original-training'
    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as pool:
        for row in pool.map(transform,candidates(),buffersize=64):db.execute('INSERT INTO candidates VALUES(?,?,?,?,?)',row)
    conflicts=db.execute('SELECT COUNT(*) FROM (SELECT hash FROM candidates GROUP BY hash HAVING COUNT(DISTINCT label)>1)').fetchone()[0]
    db.execute('CREATE TABLE quarantine AS SELECT hash FROM candidates GROUP BY hash HAVING COUNT(DISTINCT label)>1')
    ambiguous_rows=db.execute('SELECT COUNT(*) FROM candidates WHERE hash IN (SELECT hash FROM quarantine)').fetchone()[0]
    excluded=db.execute('SELECT COUNT(*) FROM candidates WHERE hash IN (SELECT hash FROM heldout)').fetchone()[0]
    indices={'train':0,'val':0,'test':0};deduplicated=0
    # Image families go to one split; original testing roles are never used as labelled training.
    for relative,label,digest in db.execute('SELECT MIN(path),MIN(label),hash FROM candidates WHERE hash NOT IN (SELECT hash FROM heldout) AND hash NOT IN (SELECT hash FROM quarantine) GROUP BY hash ORDER BY hash'):
        role=int(hashlib.sha256(('20261016:'+digest).encode()).hexdigest()[:8],16)%100
        split='test' if role<10 else 'val' if role<20 else 'train'
        db.execute('INSERT INTO samples VALUES(?,?,?,?,?,?)',(split,indices[split],relative,label,'digit',digest));indices[split]+=1
    original_rows=db.execute('SELECT COUNT(*) FROM candidates').fetchone()[0]
    report={'scope':'original-training Numta image families; original testing excluded; writer IDs not assured','originalLabelledRows':original_rows,'splitCounts':indices,'excludedOriginalTestEquivalentRows':excluded,'quarantinedAmbiguousGroups':conflicts,'quarantinedAmbiguousRows':ambiguous_rows,'duplicateOrExcludedRows':original_rows-sum(indices.values()),'processedNumtaMixed':False,'seconds':round(time.monotonic()-start),'source':source['id']+'@'+source['version']}
    db.commit();db.close();inv.close();os.replace(temp,target);(OUTPUT/'digit-manifest.json').write_text(dump(report),encoding='utf-8');print(dump(report),flush=True)

def prepare_line(source):
    OUTPUT.mkdir(exist_ok=True);target=OUTPUT/'lines.sqlite';temp=OUTPUT/'lines.building.sqlite'
    if temp.exists():temp.unlink()
    db=sqlite3.connect(temp);db.execute('CREATE TABLE samples(split TEXT,ordinal INTEGER,path TEXT,label TEXT,field TEXT,page TEXT,hash TEXT,PRIMARY KEY(split,ordinal))');db.execute('CREATE INDEX families ON samples(page,split)')
    inv=sqlite3.connect('file:'+str(RUNTIME/'inventory.sqlite')+'?mode=ro',uri=True);indices={'train':0,'val':0,'test':0};chars=set();families={}
    with (source['_root']/'ocr_cells/labels.csv').open(encoding='utf-8',newline='') as stream:
        for row in csv.DictReader(stream):
            split=row['split'];land=row['page_id'].split('-v')[0]
            if split not in indices or land in families and families[land]!=split:raise ValueError('land split leakage')
            families[land]=split;relative='ocr_cells/'+row['file'];raw=inv.execute('SELECT sha256 FROM inventory WHERE dataset=? AND relative_path=?',(source['id'],relative)).fetchone()
            if not raw:raise ValueError('missing line crop')
            if split=='train':chars.update(row['text'])
            db.execute('INSERT INTO samples VALUES(?,?,?,?,?,?,?)',(split,indices[split],relative,row['text'],row['field_type'],row['page_id'],raw[0]));indices[split]+=1
    report={'source':source['id']+'@'+source['version'],'splitCounts':indices,'landGroups':len(families),'lineage':'raw crops only; packed derivative is not mixed','chars':sorted(chars),'oov':{}}
    for split in ['val','test']:
        report['oov'][split]=sum(any(c not in chars for c in label) for label, in db.execute('SELECT label FROM samples WHERE split=?',(split,)))
    db.commit();db.close();inv.close();os.replace(temp,target);(OUTPUT/'line-manifest.json').write_text(dump(report),encoding='utf-8');print(dump({k:v for k,v in report.items() if k!='chars'}),flush=True)

def main():
    p=argparse.ArgumentParser();p.add_argument('task',choices=['digit','line']);args=p.parse_args();registry=config(PROJECT/'config/sources.example.json');source=next(s for s in registry['sources'] if s['id']==('numta' if args.task=='digit' else 'form5462'))
    (prepare_digit if args.task=='digit' else prepare_line)(source)

if __name__=='__main__':main()
