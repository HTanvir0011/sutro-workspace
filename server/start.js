'use strict';
const {createServer}=require('../scripts/serve'),{createAPI}=require('./api');
const port=Number(process.argv[2]||5174);if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid port');
const api=createAPI(),server=createServer({port,api});
server.listen(port,'127.0.0.1',()=>console.log(`Sutro local-full: http://127.0.0.1:${port} (registered available sources; 15 GB gate unaccepted)`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>api.close()));
