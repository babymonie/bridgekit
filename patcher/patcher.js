'use strict';
const api=window.bridgekit,$=id=>document.getElementById(id);
let apps=[],selected=null,scanning=false,working=false,request=0;
const labels={candidate:'Candidate',installed:'BridgeKit installed',blocked:'Blocked'};
function text(tag,value,className){const element=document.createElement(tag);element.textContent=value;if(className)element.className=className;return element;}
function notice(message,error=false){$('notice').textContent=message;$('notice').classList.toggle('error',error);}
function integrityOnly(){return selected?.integration.kind==='generic'&&selected.fuses?.embeddedAsarIntegrity&&selected.blockers.length===1&&selected.blockers[0].startsWith('Embedded ASAR integrity is enabled.');}
function controls(){for(const id of ['scan','add-folder','add-file','choose-exe'])$(id).disabled=scanning||working;for(const row of document.querySelectorAll('.app-row'))row.disabled=working;$('cancel').hidden=!scanning;$('progress').hidden=!scanning;for(const id of ['patch','update','restore'])$(id).disabled=scanning||working||!selected||(selected.blockers.length>0&&!(id==='patch'&&integrityOnly()));$('restore-integrity').disabled=scanning||working||!selected?.integrityBackup||selected?.installed;}
function list(){
  const query=$('search').value.trim().toLowerCase(),ready=$('ready-only').checked,visible=apps.filter(a=>(!ready||a.status!=='blocked')&&(`${a.name} ${a.archive}`).toLowerCase().includes(query));
  $('apps').replaceChildren();
  for(const app of visible){const li=document.createElement('li'),button=document.createElement('button');button.className='app-row';button.type='button';button.setAttribute('aria-pressed',String(selected?.id===app.id));button.append(text('span',String(app.name),'name'));const row=text('span','','row-info');row.append(text('span',labels[app.status]||'Candidate','badge '+app.status),text('span',app.version||'Version unknown'));button.append(row,text('span',app.archive,'path'));button.title=app.archive;button.addEventListener('click',()=>select(app.id));li.append(button);$('apps').append(li);}
  $('count').textContent=`${apps.length} app entries · ${apps.filter(a=>a.status==='candidate').length} candidates · ${apps.filter(a=>a.installed).length} installed`;
  $('empty').hidden=!!visible.length;$('empty').textContent=apps.length?'No apps match this filter.':'Scan installed apps or add a portable app’s folder.';
  controls();
}
function config(){return{appId:$('app-id').value.trim(),pageAccess:{origins:$('origins').value.split(/[\n,]/).map(v=>v.trim()).filter(Boolean),localPages:[...$('page-options').querySelectorAll('input:checked')].map(input=>input.value)},nativeExtensions:$('native').checked};}
function detail(){
  $('no-selection').hidden=!!selected;$('selected').hidden=!selected;if(!selected){controls();return;}
  const preset=selected.integration.kind==='faceit-preset',profile=selected.profile;
  $('app-kind').textContent=preset?'TESTED FACEIT PRESET':'GENERAL ELECTRON PROFILE';$('app-name').textContent=String(selected.name);$('app-version').textContent=`${selected.version||'Version unknown'} · ${selected.moduleType||'Unknown entry type'}`;$('app-status').textContent=labels[selected.status]||'Candidate';$('app-status').className='badge '+selected.status;
  $('app-path').textContent=selected.archive;$('app-entry').textContent=selected.main||'Not resolved';$('app-exe').textContent=selected.executable||'Choose the app’s actual executable';$('choose-exe').hidden=preset||!selected.archive.endsWith('.asar');
  $('blockers').replaceChildren(...selected.blockers.map(reason=>text('li',reason)));$('preset-note').hidden=!preset;$('configuration').hidden=preset;
  let slug=String(selected.name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,47);if(!/^[a-z][a-z0-9-]{1,47}$/.test(slug))slug=('app-'+slug).slice(0,47);$('app-id').value=profile?.appId||slug;$('app-id').readOnly=!!profile;
  $('origins').value=(profile?.pageAccess.origins||[]).join('\n');$('native').checked=profile?.nativeExtensions||false;
  const pages=[...new Set([...(selected.htmlPages||[]),...(profile?.pageAccess.localPages||[])])];$('page-options').replaceChildren();for(const page of pages){const label=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.value=page;box.checked=!!profile?.pageAccess.localPages.includes(page);label.append(box,document.createTextNode(page));$('page-options').append(label);}$('no-pages').hidden=!!pages.length;
  $('integrity-note').hidden=!integrityOnly();$('patch').textContent=integrityOnly()?'Review integrity change�':'Review patch�';$('restore-integrity').hidden=!selected.integrityBackup;
  $('patch').hidden=selected.installed;$('update').hidden=!selected.installed;$('restore').hidden=!selected.installed;controls();
}
async function select(id){const sequence=++request;working=true;controls();try{const app=await api.details(id);if(sequence!==request)return;selected=app;apps=apps.map(a=>a.id===app.id?app:a);detail();list();}catch(error){notice(error.message,true);}finally{if(sequence===request){working=false;controls();}}}
async function action(fn,message){working=true;controls();try{const result=await fn();if(result.apps)apps=result.apps;if(result.app)selected=result.app;else if(selected)selected=apps.find(a=>a.id===selected.id)||null;detail();list();notice(result.canceled?'Cancelled.':result.prepared?'ASAR integrity disabled. Review app access, then choose Review patch.':message);return result;}catch(error){notice(error.message,true);}finally{working=false;controls();}}
$('configuration').addEventListener('submit',event=>event.preventDefault());
$('search').addEventListener('input',list);$('ready-only').addEventListener('change',list);
$('scan').addEventListener('click',async()=>{scanning=true;controls();notice('Finding installed apps. Inspection does not launch or modify them.');try{const result=await api.scan();apps=result.apps;selected=selected?apps.find(a=>a.id===selected.id)||null:null;$('coverage').textContent=result.coverage+(result.limited?' Scan limit reached; add specific app folders to finish coverage.':'');$('issues').replaceChildren(...result.issues.map(issue=>text('li',issue)));detail();list();notice(`Scan complete. ${apps.length} app entries found${result.limited?' (partial scan)':''}. Select one to review.`);}catch(error){notice(error.message,true);}finally{scanning=false;controls();}});
$('cancel').addEventListener('click',()=>api.cancel().catch(error=>notice(error.message,true)));
$('add-folder').addEventListener('click',()=>action(()=>api.addFolder(),'App folder checked. Select a result to review.'));
$('add-file').addEventListener('click',()=>action(()=>api.addFile(),'App file checked. Select a result to review.'));
$('choose-exe').addEventListener('click',()=>selected&&action(()=>api.chooseExecutable(selected.id),'Executable checked.'));
$('restore-integrity').addEventListener('click',()=>selected&&action(()=>api.restoreIntegrity(selected.id),'Original executable restored.'));
for(const operation of ['patch','update','restore'])$(operation).addEventListener('click',()=>selected&&action(()=>api.operate(selected.id,operation,config()),operation==='restore'?'Original app restored. Saved plugin settings were preserved.':operation==='update'?'BridgeKit updated. Reopen the app normally.':'BridgeKit installed. Reopen the app and press Ctrl+Shift+B.'));
api.onProgress(update=>{if(update.phase==='app'){const at=apps.findIndex(a=>a.id===update.app.id);if(at<0)apps.push(update.app);else apps[at]=update.app;list();}else notice(update.phase==='checking'?`Checking Electron builds… ${update.checked||0} of ${update.found} inspected`:`Searching install locations… ${update.visited||0} entries checked, ${update.found||0} archives found`);});
api.list().then(result=>{apps=result.apps;list();if(!apps.length)$('scan').click();}).catch(error=>notice(error.message,true));
