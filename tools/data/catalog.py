"""Read-only registered-source inventory and transactional derived catalog builder."""
import argparse, concurrent.futures, csv, fnmatch, hashlib, json, os, shutil, sqlite3, sys, time, unicodedata
from fractions import Fraction
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[2]
DOCS = PROJECT / 'docs'
RUNTIME = DOCS / '.runtime'
SCHEMA = 1

def uid(dataset, value):
    return hashlib.sha256((dataset + '\0' + value).encode()).hexdigest()[:32]

def dump(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))

def norm(value):
    return ' '.join(unicodedata.normalize('NFC', str(value)).lower().split())

def resolve_source(relative):
    rel = Path(relative)
    if rel.is_absolute() or '..' in rel.parts or ':' in relative or '\\' in relative:
        raise ValueError('invalid registered root')
    result = (DOCS / rel).resolve(strict=True)
    if not result.is_relative_to(DOCS.resolve()):
        raise ValueError('source outside docs')
    current = DOCS
    for part in rel.parts:
        current = current / part
        if current.is_symlink() or current.is_junction():
            raise ValueError('source links are unsupported')
    return result

def config(filename):
    data = json.loads(Path(filename).read_text(encoding='utf-8'))
    if data['schemaVersion'] != 1:
        raise ValueError('unsupported registry')
    seen = set()
    for source in data['sources']:
        if source['id'] in seen or source['access'] not in ['public-approved', 'local-review-only', 'restricted']:
            raise ValueError('invalid source policy')
        seen.add(source['id'])
        source['_root'] = resolve_source(source['root'])
    return data

def files(source):
    root = source['_root']
    for folder, dirs, names in os.walk(root):
        dirs.sort(); names.sort()
        dirs[:] = [d for d in dirs if not (Path(folder)/d).is_symlink() and not (Path(folder)/d).is_junction()]
        if Path(folder) == root and source.get('include'):
            dirs[:] = [d for d in dirs if any(fnmatch.fnmatchcase(d, pattern) for pattern in source['include'])]
            names = [n for n in names if any(fnmatch.fnmatchcase(n, pattern) for pattern in source['include'])]
        for name in names:
            file = Path(folder)/name
            if file.is_symlink():
                raise ValueError('source file link')
            yield file

def hash_file(item):
    source, file = item
    stat = file.stat(); digest = hashlib.sha256()
    with file.open('rb') as stream:
        for block in iter(lambda: stream.read(1024*1024), b''):
            digest.update(block)
    after = file.stat()
    if (stat.st_size, stat.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
        raise ValueError('source changed during inventory')
    relative = file.relative_to(source['_root']).as_posix()
    split = relative.split('/')[0] if '/' in relative else ''
    return (source['id'], relative, digest.hexdigest(), stat.st_size, stat.st_mtime_ns, file.suffix.lower(), split)

def inventory(registry, rehash=False):
    RUNTIME.mkdir(exist_ok=True)
    db = sqlite3.connect(RUNTIME/'inventory.sqlite')
    db.execute('CREATE TABLE IF NOT EXISTS inventory(dataset TEXT,relative_path TEXT,sha256 TEXT,bytes INTEGER,mtime_ns INTEGER,kind TEXT,split TEXT,seen INTEGER,PRIMARY KEY(dataset,relative_path))')
    db.execute('CREATE INDEX IF NOT EXISTS inventory_hash ON inventory(sha256)')
    stamp = time.time_ns(); count = size = 0; start = last = time.monotonic()
    for source in registry['sources']:
        def pending():
            nonlocal count, size
            for file in files(source):
                relative = file.relative_to(source['_root']).as_posix(); stat = file.stat()
                old = db.execute('SELECT bytes,mtime_ns FROM inventory WHERE dataset=? AND relative_path=?',(source['id'],relative)).fetchone()
                if old and not rehash and old == (stat.st_size,stat.st_mtime_ns):
                    db.execute('UPDATE inventory SET seen=? WHERE dataset=? AND relative_path=?',(stamp,source['id'],relative)); count += 1; size += stat.st_size
                else:
                    yield source, file
        with concurrent.futures.ThreadPoolExecutor(max_workers=24) as pool:
            for row in pool.map(hash_file, pending(), buffersize=96):
                db.execute('INSERT OR REPLACE INTO inventory VALUES(?,?,?,?,?,?,?,?)',row+(stamp,));count+=1;size+=row[3]
                if count % 500 == 0: db.commit()
                now=time.monotonic()
                if now-last >= 10:
                    print(dump({'phase':'inventory','files':count,'bytes':size,'seconds':round(now-start)}),flush=True);last=now
    db.execute('DELETE FROM inventory WHERE seen!=?',(stamp,));db.commit()
    totals={'files':count,'bytes':size,'seconds':round(time.monotonic()-start),'full15GBGate':'not-accepted','sources':len(registry['sources'])}
    (RUNTIME/'inventory-summary.json').write_text(dump(totals),encoding='utf-8');db.close();print(dump(totals),flush=True)

SCHEMA_SQL = '''
PRAGMA foreign_keys=ON;
CREATE TABLE datasets(id TEXT PRIMARY KEY,version TEXT NOT NULL,domain TEXT,license TEXT,access TEXT NOT NULL,manifest_hash TEXT,tasks TEXT,UNIQUE(id,version));
CREATE TABLE assets(id TEXT PRIMARY KEY,dataset TEXT REFERENCES datasets(id),relative_path TEXT,sha256 TEXT,bytes INTEGER,kind TEXT,split TEXT,access TEXT,parent_asset_id TEXT REFERENCES assets(id),width INTEGER,height INTEGER,preview_path TEXT,UNIQUE(dataset,relative_path));
CREATE INDEX asset_list ON assets(dataset,kind,split,id); CREATE INDEX asset_hash ON assets(sha256); CREATE INDEX asset_parent ON assets(parent_asset_id);
CREATE TABLE lands(id TEXT PRIMARY KEY,dataset TEXT REFERENCES datasets(id),source_id TEXT,split TEXT,division TEXT,district TEXT,upazila TEXT,mouza TEXT,jl TEXT,UNIQUE(dataset,source_id));
CREATE INDEX land_location ON lands(dataset,district,mouza,jl,id);
CREATE TABLE khatians(id TEXT PRIMARY KEY,dataset TEXT REFERENCES datasets(id),source_id TEXT,land_id TEXT REFERENCES lands(id),survey TEXT,year INTEGER,khatian_no TEXT,area TEXT,image_id TEXT REFERENCES assets(id),split TEXT,UNIQUE(dataset,source_id));
CREATE INDEX khatian_versions ON khatians(land_id,survey,year,id); CREATE INDEX khatian_number ON khatians(dataset,khatian_no,id);
CREATE TABLE owners(id TEXT PRIMARY KEY,khatian_id TEXT REFERENCES khatians(id),source_row TEXT,name TEXT,search_text TEXT,share TEXT,printed_share TEXT,UNIQUE(khatian_id,source_row)); CREATE INDEX owner_rows ON owners(khatian_id,id);
CREATE TABLE dag_rows(id TEXT PRIMARY KEY,khatian_id TEXT REFERENCES khatians(id),row_index INTEGER,dag TEXT,land_class TEXT,total_acre TEXT,total_dec TEXT,share_in_dag TEXT,area_acre TEXT,area_dec TEXT,UNIQUE(khatian_id,row_index)); CREATE INDEX dag_rows_list ON dag_rows(khatian_id,dag,id);
CREATE TABLE title_edges(id TEXT PRIMARY KEY,land_id TEXT REFERENCES lands(id),from_id TEXT REFERENCES khatians(id),to_id TEXT REFERENCES khatians(id),transition TEXT); CREATE INDEX edge_from ON title_edges(from_id,id); CREATE INDEX edge_to ON title_edges(to_id,id);
CREATE TABLE packets(id TEXT PRIMARY KEY,dataset TEXT REFERENCES datasets(id),source_id TEXT,split TEXT,payload TEXT,UNIQUE(dataset,source_id)); CREATE INDEX packet_list ON packets(dataset,split,id);
CREATE TABLE field_annotations(id TEXT PRIMARY KEY,asset_id TEXT REFERENCES assets(id),field_type TEXT,row_index TEXT,text TEXT,polygon TEXT); CREATE INDEX field_rows ON field_annotations(asset_id,field_type,row_index,id);
CREATE TABLE records(id TEXT PRIMARY KEY,dataset TEXT REFERENCES datasets(id),kind TEXT,source_id TEXT,title TEXT,search_text TEXT,survey TEXT,year INTEGER,split TEXT,access TEXT,asset_id TEXT REFERENCES assets(id),land_id TEXT REFERENCES lands(id));
CREATE INDEX records_list ON records(access,id); CREATE INDEX records_dataset ON records(dataset,access,id); CREATE INDEX records_search ON records(access,search_text,id); CREATE INDEX records_kind ON records(kind,access,id); CREATE INDEX records_survey ON records(survey,access,id); CREATE INDEX records_land ON records(land_id,id);
CREATE TABLE record_tokens(token TEXT,record_id TEXT REFERENCES records(id),PRIMARY KEY(token,record_id));
CREATE TABLE catalog_runs(revision TEXT PRIMARY KEY,schema_version INTEGER,input_hash TEXT,report TEXT);
CREATE TABLE quarantine(dataset TEXT,relative_path TEXT,reason TEXT);
'''

def rows(root, name, required):
    with (root/name).open(encoding='utf-8-sig',newline='') as stream:
        reader=csv.DictReader(stream)
        if not set(required).issubset(reader.fieldnames or []): raise ValueError('required CSV columns missing: '+name)
        for row in reader:
            if any(v is None or len(v)>10000 for v in row.values()): raise ValueError('invalid CSV row')
            yield row

def exact(value, upper=None):
    if len(value)>64: raise ValueError('fraction limit')
    result=Fraction(value)
    if result<0 or upper is not None and result>upper: raise ValueError('invalid exact value')
    return value

def record(db, source, key, kind, title, split='', survey='', year=None, asset=None, land=None, search=None):
    id=uid(source['id'],key)
    db.execute('INSERT INTO records VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',(id,source['id'],kind,key,title,norm(search or title),survey,year,split,source['access'],asset,land))
    for token in set(norm(search or title).split()):db.execute('INSERT OR IGNORE INTO record_tokens VALUES(?,?)',(token,id))
    return id

def form5462(db, source):
    dataset=source['id'];root=source['_root']
    for r in rows(root,'lands.csv',['land_id','split','division','district','mouza','jl_no']):
        db.execute('INSERT INTO lands VALUES(?,?,?,?,?,?,?,?,?)',(uid(dataset,r['land_id']),dataset,r['land_id'],r['split'],r['division'],r['district'],r['upazila'],r['mouza'],r['jl_no']))
    for r in rows(root,'khatians.csv',['khatian_id','land_id','survey','year','image_file','total_land_dec']):
        key=r['khatian_id'];asset=uid(dataset,'asset:pages/'+r['image_file']);land=uid(dataset,r['land_id']);year=int(r['year'])
        if not 1600<=year<=2200:raise ValueError('year outside supported range')
        parent=db.execute('SELECT split,mouza,district FROM lands WHERE id=?',(land,)).fetchone()
        if not parent or parent[0]!=r['split']:raise ValueError('land split mismatch')
        db.execute('INSERT INTO khatians VALUES(?,?,?,?,?,?,?,?,?,?)',(uid(dataset,key),dataset,key,land,r['survey'],year,r['khatian_no'],exact(r['total_land_dec']),asset,r['split']))
        record(db,source,key,'khatian',r['survey']+' '+r['khatian_no']+' · '+key,r['split'],r['survey'],year,asset,land,key+' '+r['khatian_no']+' '+parent[1]+' '+parent[2])
    for r in rows(root,'owners.csv',['khatian_id','owner_idx','name_bn','share_exact','share_printed_3dp']):
        db.execute('INSERT INTO owners VALUES(?,?,?,?,?,?,?)',(uid(dataset,'owner:'+r['khatian_id']+':'+r['owner_idx']),uid(dataset,r['khatian_id']),r['owner_idx'],r['name_bn'],norm(r['name_bn']),exact(r['share_exact'],1),r['share_printed_3dp']))
    for r in rows(root,'dag_rows.csv',['khatian_id','row_idx','dag_no','share_in_dag','total_dec','area_dec']):
        db.execute('INSERT INTO dag_rows VALUES(?,?,?,?,?,?,?,?,?,?)',(uid(dataset,'dag:'+r['khatian_id']+':'+r['row_idx']),uid(dataset,r['khatian_id']),int(r['row_idx']),r['dag_no'],r['land_class_bn'],exact(r['total_acre']),exact(r['total_dec']),exact(r['share_in_dag'],1),exact(r['area_acre']),exact(r['area_dec'])))
    for r in rows(root,'title_line.csv',['land_id','from_khatian_id','to_khatian_id','transition']):
        a=uid(dataset,r['from_khatian_id']);b=uid(dataset,r['to_khatian_id']);land=uid(dataset,r['land_id'])
        endpoints=db.execute('SELECT land_id,year FROM khatians WHERE id IN (?,?) ORDER BY year',(a,b)).fetchall()
        if len(endpoints)!=2 or any(v[0]!=land for v in endpoints) or endpoints[0][1]>=endpoints[1][1]:raise ValueError('invalid title edge')
        db.execute('INSERT INTO title_edges VALUES(?,?,?,?,?)',(uid(dataset,a+b),land,a,b,r['transition']))
    with (root/'annotations.jsonl').open(encoding='utf-8') as stream:
        for line in stream:
            if len(line)>2*1024*1024:raise ValueError('annotation limit')
            p=json.loads(line);asset=uid(dataset,'asset:pages/'+p['file']);width,height=p['width'],p['height']
            if not 0<width<=10000 or not 0<height<=10000 or width*height>25000000:raise ValueError('image dimensions')
            if db.execute('UPDATE assets SET width=?,height=? WHERE id=?',(width,height,asset)).rowcount!=1:raise ValueError('missing page asset')
            for i,f in enumerate(p['fields']):
                poly=f['poly']
                if len(poly)!=4 or any(len(pt)!=2 or not all(isinstance(x,(int,float)) for x in pt) or not (0<=pt[0]<=width and 0<=pt[1]<=height) for pt in poly):raise ValueError('invalid polygon')
                db.execute('INSERT INTO field_annotations VALUES(?,?,?,?,?,?)',(uid(dataset,asset+':'+str(i)),asset,f['field'],str(f['row']),f['text'],dump(poly)))
    for r in rows(root,'ocr_cells/labels.csv',['file','text','field_type','page_id','split']):
        parent=uid(dataset,r['page_id']);page=db.execute('SELECT split,image_id FROM khatians WHERE id=?',(parent,)).fetchone()
        if not page or page[0]!=r['split']:raise ValueError('crop split mismatch')
        if db.execute('UPDATE assets SET parent_asset_id=? WHERE id=?',(page[1],uid(dataset,'asset:ocr_cells/'+r['file']))).rowcount!=1:raise ValueError('missing crop')
    for kid,total in db.execute('SELECT khatian_id,COUNT(*) FROM owners GROUP BY khatian_id'):
        if sum((Fraction(s[0]) for s in db.execute('SELECT share FROM owners WHERE khatian_id=?',(kid,))),Fraction())!=1:raise ValueError('owner shares do not sum to one')

def packet_projection(p):
    if len(p.get('docs',[]))>500 or not isinstance(p.get('docs'),list):raise ValueError('invalid packet')
    # Domain evidence is isolated from evaluator labels, injected fault descriptions and generator titles.
    out={k:p[k] for k in ['id','synthetic','asOfYear','plot','offer','docs']}
    out['title']={'en':'Synthetic case '+p['id'],'bn':'Synthetic case '+p['id']};out['revision']=0
    if len(dump(out).encode())>100*1024:raise ValueError('packet projection too large')
    ids=[d['id'] for d in out['docs']]
    if len(ids)!=len(set(ids)):raise ValueError('duplicate document IDs')
    if any(d['type'] not in ['khatian','deed','mutation','heirCert','search'] for d in out['docs']):raise ValueError('unsupported packet document')
    return out

def packets(db,source):
    for file in sorted(source['_root'].glob('*.jsonl')):
        with file.open(encoding='utf-8') as stream:
            for line in stream:
                if len(line)>2097152:raise ValueError('packet line limit')
                p=json.loads(line);out=packet_projection(p);id=uid(source['id'],p['id'])
                db.execute('INSERT INTO packets VALUES(?,?,?,?,?)',(id,source['id'],p['id'],p.get('split',''),dump(out)))
                record(db,source,p['id'],'packet','Synthetic case '+p['id'],p.get('split',''))

def build(registry, activate_revision=True):
    inv=sqlite3.connect(RUNTIME/'inventory.sqlite');manifest=hashlib.sha256()
    for row in inv.execute('SELECT dataset,relative_path,sha256 FROM inventory ORDER BY dataset,relative_path'):manifest.update(dump(row).encode())
    config_public={k:v for k,v in registry.items() if k!='sources'};config_public['sources']=[{k:v for k,v in s.items() if k!='_root'} for s in registry['sources']]
    manifest.update(dump(config_public).encode());manifest.update(Path(__file__).read_bytes());revision=manifest.hexdigest()[:20];target=RUNTIME/('catalog-'+revision+'.sqlite')
    if target.exists():
        print(dump({'phase':'index','revision':revision,'status':'already-built'}),flush=True)
        check=sqlite3.connect('file:'+str(target)+'?mode=ro',uri=True)
        if check.execute('PRAGMA integrity_check').fetchone()[0]!='ok' or check.execute('PRAGMA foreign_key_check').fetchone():raise ValueError('existing revision is invalid')
        check.close()
        if activate_revision:activate(revision)
        return
    if shutil.disk_usage(RUNTIME).free<2*1024**3:raise ValueError('catalog disk preflight')
    temp=RUNTIME/('catalog-'+revision+'.building.sqlite')
    if temp.exists():temp.unlink() # Only this derived incomplete revision is replaced.
    db=sqlite3.connect(temp);db.executescript(SCHEMA_SQL)
    try:
        for s in registry['sources']:
            db.execute('INSERT INTO datasets VALUES(?,?,?,?,?,?,?)',(s['id'],s['version'],s['domain'],s['license'],s['access'],manifest.hexdigest(),dump(s['tasks'])))
            for r in inv.execute('SELECT relative_path,sha256,bytes,kind,split FROM inventory WHERE dataset=? ORDER BY relative_path',(s['id'],)):
                name,sha,size,kind,split=r
                db.execute('INSERT INTO assets VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',(uid(s['id'],'asset:'+name),s['id'],name,sha,size,kind,split,s['access'],None,None,None,None))
            print(dump({'phase':'index','source':s['id']}),flush=True)
            if s['adapter']=='form5462':form5462(db,s)
            elif s['adapter']=='packets':packets(db,s)
            elif s['adapter'] not in ['numta','inventory-only']:raise ValueError('unknown adapter')
            db.commit()
        if db.execute('PRAGMA foreign_key_check').fetchone():raise ValueError('foreign key violation')
        if db.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise ValueError('catalog integrity')
        counts={table:db.execute('SELECT COUNT(*) FROM '+table).fetchone()[0] for table in ['datasets','assets','lands','khatians','owners','dag_rows','title_edges','packets','field_annotations','records']}
        duplicate_groups=inv.execute('SELECT COUNT(*) FROM (SELECT sha256 FROM inventory GROUP BY sha256 HAVING COUNT(*)>1)').fetchone()[0]
        report={'revision':revision,'schemaVersion':SCHEMA,'counts':counts,'exactDuplicateGroups':duplicate_groups,'full15GBGate':'unavailable','numtaWriterIndependence':'unknown','numtaCorrectedAugmentedTest':'not an independent training/evaluation split; preserve original roles','models':'not accepted by catalog generation'}
        db.execute('INSERT INTO catalog_runs VALUES(?,?,?,?)',(revision,SCHEMA,manifest.hexdigest(),dump(report)));db.commit();db.execute('ANALYZE');db.close();os.replace(temp,target)
        (RUNTIME/'catalog-report.json').write_text(dump(report),encoding='utf-8')
        if activate_revision:activate(revision)
        print(dump(report),flush=True)
    except BaseException:
        db.close();raise
    finally:inv.close()

def activate(revision):
    temporary=RUNTIME/'active.next.json';temporary.write_text(dump({'schemaVersion':SCHEMA,'revision':revision,'file':'catalog-'+revision+'.sqlite'}),encoding='utf-8');os.replace(temporary,RUNTIME/'active.json')

def main():
    parser=argparse.ArgumentParser();parser.add_argument('command',choices=['inventory','validate','index']);parser.add_argument('--registry',default=str(PROJECT/'config/sources.local.json' if (PROJECT/'config/sources.local.json').exists() else PROJECT/'config/sources.example.json'));parser.add_argument('--rehash',action='store_true');args=parser.parse_args()
    registry=config(args.registry)
    if args.command=='inventory':inventory(registry,args.rehash)
    else:build(registry,activate_revision=args.command=='index')

if __name__=='__main__':
    try:main()
    except KeyboardInterrupt:print('Cancelled; active catalog unchanged. Inventory checkpoints retained.',file=sys.stderr);sys.exit(130)
    except Exception as error:print('Catalog operation failed: '+str(error),file=sys.stderr);sys.exit(1)
