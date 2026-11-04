'use strict';
const {spawn}=require('node:child_process'),path=require('node:path'),fs=require('node:fs');
const root=path.resolve(__dirname,'..'),file=path.join(root,'patcher-ui-verification.json'),before=fs.existsSync(file)?fs.statSync(file).mtimeMs:0;
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
const run=spawn(require('electron'),[path.join(root,'demo/patcher-ui-check.cjs')],{env,windowsHide:false,stdio:'inherit'}),timer=setTimeout(()=>{run.kill();process.exitCode=1;},50000);
run.on('error',error=>{clearTimeout(timer);console.error(error);process.exitCode=1;});run.on('exit',code=>{clearTimeout(timer);const report=fs.existsSync(file)&&fs.statSync(file).mtimeMs>before?JSON.parse(fs.readFileSync(file,'utf8')):null;process.exitCode=code||!report?.success?1:0;});
