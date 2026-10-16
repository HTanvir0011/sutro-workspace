#!/usr/bin/env node
/* Loopback-only public-build server. Never serves the repository root. */
'use strict';
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { headers, error, staticFile } = require('../server/http');
function createServer({ port = 5173, root = path.resolve(__dirname, '../dist'), api = null } = {}) {
  if (!fs.existsSync(path.join(root, 'build-manifest.json'))) throw new Error('Run npm run build first.');
  const session = crypto.randomBytes(32).toString('hex');
  let rate = { start: Date.now(), count: 0 };
  const server = http.createServer({ maxHeaderSize: 8192, requestTimeout: 15000, headersTimeout: 10000 }, async (req, res) => {
    headers(res); res.requestId = crypto.randomUUID();
    const host = req.headers.host, origin = req.headers.origin;
    if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(host) || (origin && origin !== `http://${host}`) || req.headers['sec-fetch-site'] === 'cross-site') return error(res, 403, 'origin-denied');
    if (!['GET','HEAD'].includes(req.method)) { res.setHeader('Allow','GET, HEAD'); return error(res,405,'method-denied'); }
    if(req.headers['transfer-encoding']||Number(req.headers['content-length']||0)>0)return error(res,413,'request-body-denied');
    if (req.url.length > 4096) return error(res,413,'query-too-large');
    let url, pathname;
    try { pathname = decodeURIComponent(req.url.split('?')[0]); url = new URL(req.url,`http://${host}`); } catch { return error(res,400,'malformed-url'); }
    if (pathname.includes('\\') || pathname.includes('\0') || pathname.includes(':') || pathname.split('/').some(p => p === '.' || p === '..')) return error(res,404,'not-found');
    if (Date.now() - rate.start > 60000) rate = { start:Date.now(), count:0 };
    if (pathname.startsWith('/api/') && ++rate.count > 600) return error(res,429,'rate-limited');
    const authorized = (req.headers.cookie || '').split(';').some(c => c.trim() === `sutro_launch=${session}`);
    if (pathname.startsWith('/api/')) {
      if (!authorized) return error(res,401,'launch-session-required');
      if (!api) return error(res,503,'catalog-unavailable');
      try { return await api(req,res,url,pathname); } catch { return error(res,503,'catalog-unavailable'); }
    }
    if (pathname === '/health/live' || pathname === '/health/ready') {
      const ready = pathname.endsWith('live') || !api || api.ready();
      res.writeHead(ready ? 200 : 503, {'Content-Type':'application/json'});
      return res.end(JSON.stringify({shell:true,profile:api ? 'local-full':'static-demo',catalog:api ? api.ready():false,models:false}));
    }
    if (!authorized && req.headers['sec-fetch-mode'] === 'navigate' && ['none','same-origin'].includes(req.headers['sec-fetch-site']) && (pathname === '/' || pathname.endsWith('.html'))) res.setHeader('Set-Cookie',`sutro_launch=${session}; HttpOnly; SameSite=Strict; Path=/`);
    try{staticFile(req,res,root,pathname);}catch{return error(res,503,'public-build-unavailable');}
  });
  server.keepAliveTimeout = 5000; server.maxRequestsPerSocket = 100;
  return server;
}
if (require.main === module) {
  const port = Number(process.argv[2] || process.env.PORT || 5173);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local port');
  if (process.argv.includes('--build')) require('./build').build();
  createServer({port}).listen(port,'127.0.0.1',() => console.log(`Sutro static-demo: http://127.0.0.1:${port}`));
}
module.exports = {createServer};
