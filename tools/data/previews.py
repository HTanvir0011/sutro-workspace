"""Private offline thumbnails. Never renders restricted real sources."""
import concurrent.futures, hashlib, json, sqlite3, time
from pathlib import Path
from PIL import Image
from catalog import RUNTIME, config, PROJECT, resolve_source
Image.MAX_IMAGE_PIXELS=25000000

def main():
    registry=config(PROJECT/'config/sources.example.json')
    roots={s['id']:s['_root'] for s in registry['sources']}
    active=json.loads((RUNTIME/'active.json').read_text());db=sqlite3.connect('file:'+str(RUNTIME/active['file'])+'?mode=ro',uri=True)
    output=RUNTIME/'previews';output.mkdir(exist_ok=True)
    rows=db.execute("SELECT a.dataset,a.relative_path,a.sha256,a.access,a.width,a.height FROM assets a JOIN records r ON r.asset_id=a.id WHERE r.kind='khatian' AND a.access IN ('public-approved','local-review-only') ORDER BY a.id")
    def make(row):
        dataset,relative,digest,access,width,height=row;source=(roots[dataset]/relative).resolve(strict=True)
        if not source.is_relative_to(roots[dataset]):raise ValueError('preview source escaped root')
        target=output/(digest+'-'+access+'-thumbnail-v1.jpg')
        if target.exists():return 0
        with Image.open(source) as image:
            if image.width*image.height>25000000 or max(image.size)>10000:raise ValueError('preview pixels')
            if (width,height)!=image.size:raise ValueError('source dimensions disagree with annotations')
            image.load();image=image.convert('RGB');image.thumbnail((640,640));image.save(target,format='JPEG',quality=82,exif=b'')
        return 1
    start=last=time.monotonic();count=created=0
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        for new in pool.map(make,rows,buffersize=32):
            count+=1;created+=new
            if time.monotonic()-last>=10:print(json.dumps({'phase':'previews','validated':count,'created':created}),flush=True);last=time.monotonic()
    report={'validated':count,'created':created,'seconds':round(time.monotonic()-start),'restrictedRendered':0,'version':active['revision']}
    (RUNTIME/'previews-report.json').write_text(json.dumps(report));print(json.dumps(report));db.close()

if __name__=='__main__':main()
