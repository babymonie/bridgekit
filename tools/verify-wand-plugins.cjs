'use strict';
const {spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const output=path.resolve(__dirname,'..'),receipt=path.join(output,'wand-plugins-verification.json'),before=fs.existsSync(receipt)?fs.statSync(receipt).mtimeMs:0;
const env={...process.env,BRIDGE_VERIFICATION_OUTPUT:output};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
const child=spawn(require('electron'),[path.resolve(__dirname,'../demo/wand-plugins-check.cjs')],{env,stdio:'inherit',windowsHide:false});
const timer=setTimeout(()=>{child.kill();process.exitCode=1;},45000);
child.on('error',error=>{clearTimeout(timer);console.error(error);process.exitCode=1;});
child.on('exit',code=>{clearTimeout(timer);const report=fs.existsSync(receipt)&&fs.statSync(receipt).mtimeMs>before?JSON.parse(fs.readFileSync(receipt,'utf8')):null;process.exitCode=code||!report?.success?1:0;if(report)console.log(`${report.checks.filter(c=>c.passed).length} Wand plugin checks passed${report.success?'':'; verification failed'}`);});
