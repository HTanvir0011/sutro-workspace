"""Rehash registered sources and compare against the pre-verification content manifest."""
import hashlib,json,sqlite3,subprocess,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1];runtime=root/'docs/.runtime'
def digest():
    db=sqlite3.connect('file:'+str(runtime/'inventory.sqlite')+'?mode=ro',uri=True);sha=hashlib.sha256();n=size=0
    for row in db.execute('SELECT dataset,relative_path,sha256,bytes FROM inventory ORDER BY dataset,relative_path'):sha.update(json.dumps(row,separators=(',',':')).encode());n+=1;size+=row[3]
    db.close();return {'sha256':sha.hexdigest(),'files':n,'bytes':size}
before=digest();subprocess.run([sys.executable,str(root/'tools/data/catalog.py'),'inventory','--rehash'],cwd=root,check=True);after=digest();report={'before':before,'after':after,'unchanged':before==after,'scope':'all registered sources; excluded reference material is unchanged by implementation code'};(runtime/'source-integrity.json').write_text(json.dumps(report,indent=2));print(json.dumps(report));sys.exit(0 if report['unchanged'] else 1)
