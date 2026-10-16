'use strict';
const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({testDir:'tests/browser',fullyParallel:false,workers:1,timeout:30000,use:{channel:'chrome',baseURL:'http://127.0.0.1:18648',viewport:{width:1280,height:900},reducedMotion:'reduce'},webServer:{command:'node scripts/serve.js 18648 --build',url:'http://127.0.0.1:18648/health/live',reuseExistingServer:false},reporter:[['list']],outputDir:'test-results'});
