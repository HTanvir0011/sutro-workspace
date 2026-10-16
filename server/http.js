'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream');
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.ttf':'font/ttf', '.woff2':'font/woff2', '.txt':'text/plain; charset=utf-8' };
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; font-src 'self'; connect-src 'self'; worker-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'";
let activeStreams=0;
types['.mjs']='text/javascript; charset=utf-8';types['.wasm']='application/wasm';types['.onnx']='application/octet-stream';
function headers(res) {
  res.setHeader('Content-Security-Policy', CSP); res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()'); res.setHeader('Cache-Control', 'no-store');
}
function error(res, status, code) {
  if (res.destroyed || res.headersSent) return;
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: { code, message: code }, requestId: res.requestId }));
}
function safePath(root, relative) {
  if (!relative || relative.includes('\\') || relative.includes(':') || relative.includes('\0') || relative.startsWith('/') || relative.split('/').some(p => !p || p === '.' || p === '..' || /[. ]$/.test(p))) return null;
  const full = path.resolve(root, relative), canonicalRoot = fs.realpathSync(root);
  if (!full.startsWith(path.resolve(root) + path.sep)) return null;
  try {
    const canonical = fs.realpathSync(full);
    if (!canonical.startsWith(canonicalRoot + path.sep) || !fs.statSync(canonical).isFile()) return null;
    let part = root;
    for (const segment of relative.split('/')) { part = path.join(part, segment); if (fs.lstatSync(part).isSymbolicLink()) return null; }
    return canonical;
  } catch { return null; }
}
function stream(req, res, file, mediaType) {
  if(activeStreams>=32)return error(res,429,'stream-limit');
  res.writeHead(200, { 'Content-Type': mediaType, 'Content-Length': fs.statSync(file).size });
  if (req.method === 'HEAD') return res.end();
  activeStreams++;
  const source = fs.createReadStream(file);
  source.once('close',()=>{activeStreams--;});
  req.once('aborted', () => source.destroy()); res.once('close', () => source.destroy()); pipeline(source, res, () => {});
}
function staticFile(req, res, root, urlPath) {
  const file = safePath(root, urlPath === '/' ? 'index.html' : urlPath.slice(1));
  if (!file || !types[path.extname(file)]) return error(res, 404, 'not-found');
  if (urlPath === '/js/workers/ocr.mjs') res.setHeader('Content-Security-Policy',CSP.replace("script-src 'self'","script-src 'self' 'wasm-unsafe-eval'"));
  stream(req, res, file, types[path.extname(file)]);
}
module.exports = { headers, error, safePath, stream, staticFile, CSP };
