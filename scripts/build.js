'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const policy = require('../config/public-files.json');
const forbidden = /(?:^|\/)(?:docs|server|tools|training|storage|node_modules|\.git|\.runtime|private|checkpoints|notebooks)(?:\/|$)|(?:secret|credential|kaggle\.json|\.env|\.npz$|\.pt$|\.zip$|\.sqlite$)/i;
function candidates() {
  const list = [...policy.files];
  for(const name of list){
    if(name.includes('\\')||name.includes(':')||name.startsWith('/')||name.split('/').some(p=>!p||p==='.'||p==='..'))throw new Error('Invalid public path');
    if(!fs.existsSync(path.join(root,name))||!fs.realpathSync(path.join(root,name)).startsWith(root+path.sep))throw new Error('Missing or escaped public file: '+name);
    let part=root;for(const segment of name.split('/')){part=path.join(part,segment);if(fs.lstatSync(part).isSymbolicLink())throw new Error('Public file link refused: '+name);}
  }
  function walk(relative) {
    if (!fs.existsSync(path.join(root, relative))) return;
    for (const item of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const name = relative + '/' + item.name;
      if (item.isSymbolicLink()) throw new Error('Public symlink refused: ' + name);
      if (item.isDirectory()) walk(name);
      else if (policy.extensions.includes(path.extname(item.name))) list.push(name);
      else throw new Error('Unapproved public extension: ' + name);
    }
  }
  policy.directories.forEach(walk);
  return list.sort();
}
function build() {
  const contents = candidates().map(name => {
    if (forbidden.test(name)) throw new Error('Private public-build path');
    const file = path.join(root, name);
    const large=fs.statSync(file).size > policy.maximumFileBytes;
    if (large && !policy.reviewedLargeFiles?.[name]) throw new Error('Public file exceeds review limit: ' + name);
    const bytes = fs.readFileSync(file);
    if (large && crypto.createHash('sha256').update(bytes).digest('hex')!==policy.reviewedLargeFiles[name]) throw new Error('Reviewed large artifact changed: '+name);
    if (/\.(?:html|js|json|css|txt)$/.test(name) && /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|AKIA[0-9A-Z]{16}|[A-Za-z]:\\(?:Users|land)\\/i.test(bytes.toString('utf8'))) throw new Error('Private content pattern: ' + name);
    return { name, bytes, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
  });
  const dist = path.join(root, 'dist');
  if (fs.existsSync(dist) && fs.lstatSync(dist).isSymbolicLink()) throw new Error('dist must not be a symlink/junction');
  // The fixed resolved target is a derived build directory inside this workspace.
  if (path.dirname(dist) !== root) throw new Error('Invalid build root');
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist);
  for (const file of contents) {
    const target = path.join(dist, file.name);
    fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, file.bytes);
  }
  const manifest = { schemaVersion: 1, appVersion: require('../package.json').version, files: contents.map(({ name, bytes, sha256 }) => ({ name, bytes: bytes.length, sha256 })) };
  fs.writeFileSync(path.join(dist, 'build-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Public build: ${contents.length} files, ${contents.reduce((n,f) => n + f.bytes.length, 0)} bytes.`);
  return manifest;
}
if (require.main === module) build();
module.exports = { build, candidates, forbidden };
