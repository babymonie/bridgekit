'use strict';
const {spawn}=require('node:child_process'),path=require('node:path'),fs=require('node:fs');
const output=path.resolve(__dirname,'..'),receipt=path.join(output,'ad-cleaner-verification.json');
const before=fs.existsSync(receipt)?fs.statSync(receipt).mtimeMs:0;
const env={...process.env,BRIDGE_VERIFICATION_OUTPUT:output};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
const child=spawn(require('electron'),[path.join(output,'demo/ad-cleaner-check.cjs')],{env,windowsHide:true,stdio:'inherit'});
const timer=setTimeout(()=>{child.kill();process.exitCode=1;},25000);
child.on('error',error=>{clearTimeout(timer);console.error(error);process.exitCode=1;});
child.on('exit',code=>{clearTimeout(timer);const fresh=fs.existsSync(receipt)&&fs.statSync(receipt).mtimeMs>before;const report=fresh?JSON.parse(fs.readFileSync(receipt,'utf8')):null;process.exitCode=code||!report?.success?1:0;});
