'use strict';
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {build}=require('./build');
const root=path.resolve(__dirname,'..');
const manifest=build();
const staged=execFileSync('git',['diff','--cached','--name-only','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean);
const reviewed=require('../config/public-files.json').reviewedLargeFiles||{};
const privatePath=/^(?:docs\/(?:datasets\/full|dataset_[12]_|\.runtime)|storage\/private|training\/runs|artifacts\/runs|\.venv)|(?:\.npz|\.pt|\.sqlite|\.zip|\.pyc)$|(?:^|\/)(?:kaggle\.json|\.env|sources\.local\.json)$/i;
const denied=staged.filter(name=>privatePath.test(name)||(name.endsWith('.onnx')&&!reviewed[name])||(fs.existsSync(path.join(root,name))&&fs.statSync(path.join(root,name)).size>5*1024*1024&&!reviewed[name]));
if(denied.length){console.error('Publication gate failed. Private/large/unapproved staged paths require owner review:',denied);process.exitCode=1;}
else console.log(`Public artifact boundary passed (${manifest.files.length} files). ${staged.length} staged paths inspected. Nothing staged or published by this command.`);
