#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path');
const {discover,inspect}=require('./app-inspection.cjs');
const engine=require('./patch-engine.cjs');
const {validateProfile}=require('../runtime/app-profile.cjs');
const faceitPreset=require('../profiles/faceit.json');
function argumentsOf(argv){
  const positional=[],flags={origin:[], 'local-page':[]};
  for(let i=0;i<argv.length;i++){
    const arg=argv[i];if(!arg.startsWith('--')){positional.push(arg);continue;}
    const name=arg.slice(2);if(['yes','json','native'].includes(name)){flags[name]=true;continue;}
    if(!['origin','local-page','exe','id','output','preset','version'].includes(name)||!argv[i+1]||argv[i+1].startsWith('--'))throw Error(`Unknown or incomplete option ${arg}`);
    const value=argv[++i];if(Array.isArray(flags[name]))flags[name].push(value);else flags[name]=value;
  }
  return{command:positional[0],input:positional[1],flags};
}
const HELP=`BridgeKit — add controlled plugins to Electron apps

  npm run bridgekit                         Guided setup
  npm run bridgekit -- inspect <app-path>    Inspect folder, executable or app.asar
  npm run bridgekit -- setup <app-path> --id my-app --origin https://app.example.com
  npm run bridgekit -- plan <profile.json>   Review files, hashes and page access
  npm run bridgekit -- patch <profile.json>  Confirm and install
  npm run bridgekit -- status <profile.json>
  npm run bridgekit -- update <profile.json>
  npm run bridgekit -- restore <profile.json>
  npm run bridgekit -- presets
  npm run bridgekit -- patch --preset faceit [FACEIT-root]

  Options: --exe <executable>, --local-page <relative.html> (repeatable),
           --origin <exact-origin> (repeatable), --output <profile.json>,
           --native (opt in to partial Chrome compatibility), --json, --yes.

  New profiles default to SDK plugins only. Profiles pin the exact archive and
  executable hashes; unknown changes, running apps and ASAR integrity are refused.
  Windows/Linux ASAR layouts are candidates; macOS patching is not implemented.
`;
async function main(argv=process.argv.slice(2)){
  const {command:initial,input:initialInput,flags}=argumentsOf(argv);let command=initial,input=initialInput,rl;
  const interactive=!!process.stdin.isTTY;
  async function ask(question){if(!interactive)throw Error('Provide command options in non-interactive mode; see help');rl||=require('node:readline/promises').createInterface({input:process.stdin,output:process.stdout});return(await rl.question(question)).trim();}
  async function confirm(question){if(flags.yes)return true;return /^(y|yes)$/i.test(await ask(question+' [y/N] '));}
  function print(value){if(flags.json)console.log(JSON.stringify(value,null,2));else if(value.blockers){console.log(`${value.profile?.name||value.name||'App'} · ${value.details?.moduleType||value.moduleType||'unknown entry'}`);console.log(`Archive: ${value.profile?.archive||value.archive}`);if(value.changes){console.log(`Backup: ${value.changes.backup}\nRuntime: ${value.changes.runtime}\nAllowed pages: ${JSON.stringify(value.changes.pageAccess)}\nNative Chrome compatibility: ${value.changes.nativeExtensions?'enabled (partial)':'off'}`);}for(const line of value.blockers)console.log('Blocked: '+line);console.log(value.blockers.length?'No changes can be applied.':'Structural checks passed; app-specific runtime verification is still required.');}else console.log(JSON.stringify(value,null,2));}
  try{
    if(!command){if(!interactive){console.log(HELP);return;}console.log('BridgeKit setup\nCreate a reviewed profile for an Electron app. The app must be closed before patching.');command='setup';}
    if(command==='help'){console.log(HELP);return;}
    if(command==='presets'){print([{id:faceitPreset.id,name:faceitPreset.name,builds:Object.keys(faceitPreset.builds),integration:'Existing FACEIT install/update/restore workflow'}]);return;}
    if(flags.preset){
      if(flags.preset!=='faceit')throw Error('Unknown preset; use presets to list supported names');
      const api=require('./faceit.cjs'),operation={inspect:'status',status:'status',plan:'status',patch:'install',update:'update',restore:'uninstall'}[command];
      if(!operation)throw Error('Preset supports inspect, status, plan, patch, update and restore');
      const state=api.status(input,flags.version);
      if(['inspect','status','plan'].includes(command)){print(state);return;}
      console.log(`FACEIT preset: ${state.version}\nArchive: ${state.archive}\nOriginal backup: ${state.backup}\nThe existing data directory and installation format are preserved.`);
      if(!await confirm(`${command} FACEIT?`)){console.log('Cancelled.');return;}
      print(api[operation](input,flags.version));return;
    }
    if(['inspect','setup'].includes(command)){
      input||=await ask('App folder, executable or app.asar path: ');
      const archives=discover(input);if(!archives.length)throw Error('No app.asar found. Select its resources folder, or use supported source integration.');
      let archive=archives[0];if(archives.length>1){if(!interactive)throw Error('Multiple archives found; select an exact app.asar:\n'+archives.join('\n'));console.log(archives.map((v,i)=>`${i+1}. ${v}`).join('\n'));const choice=Number(await ask('Archive number: '));if(!archives[choice-1])throw Error('Invalid archive choice');archive=archives[choice-1];}
      let executable=flags.exe;if(!executable&&fs.statSync(input).isFile()&&!input.endsWith('.asar'))executable=path.resolve(input);
      let details=await inspect(archive,executable);print(details);
      if(command==='inspect')return;
      if(!details.executable&&interactive){executable=await ask('Exact app executable path: ');details=await inspect(archive,executable);}
      if(!details.candidate||details.patched)throw Error(details.patched?'An existing bootstrap was found. Manage its existing installation/profile.':details.blockers.join('\n'));
      const suggested=String(details.name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,47);
      const appId=flags.id||(interactive?await ask(`Stable app ID [${suggested}]: `)||suggested:suggested);
      if(!flags.origin.length&&!flags['local-page'].length){const origins=await ask('Allowed web origins, comma separated (or empty): '),pages=await ask('Local HTML paths inside app.asar, comma separated (or empty): ');flags.origin=origins?origins.split(',').map(v=>v.trim()):[];flags['local-page']=pages?pages.split(',').map(v=>v.trim()):[];}
      const profile=validateProfile({schemaVersion:1,appId,name:details.name,archive:details.archive,executable:details.executable,sha256:details.sha256,executableSha256:details.executableSha256,pageAccess:{origins:flags.origin,localPages:flags['local-page']},nativeExtensions:!!flags.native});
      const output=path.resolve(flags.output||path.join('.bridgekit','profiles',appId+'.json'));fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(profile,null,2)+'\n',{flag:'wx'});
      console.log(`Saved app profile: ${output}`);const review=await engine.plan(profile);print(review);
      if(interactive&&review.canApply&&await confirm('Patch this app now?'))print(await engine.apply(profile));
      else console.log(`Next: npm run bridgekit -- patch "${output}"`);
      return;
    }
    if(!['plan','patch','status','update','restore'].includes(command)||!input)throw Error(HELP);
    const profile=engine.loadProfile(input);
    if(command==='status'){print(await engine.status(profile));return;}
    const operation=command==='plan'?'patch':command,review=await engine.plan(profile,operation);print(review);
    if(command==='plan')return;
    if(!review.canApply)throw Error('Resolve the blockers above before proceeding');
    if(await confirm(`${command} ${profile.name}?`))print(await engine.apply(profile,operation));else console.log('Cancelled.');
  }finally{rl?.close();}
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={main,argumentsOf,HELP};
