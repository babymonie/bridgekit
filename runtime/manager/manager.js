'use strict';
const api=window.bridgeManager;
const list=document.getElementById('plugins'),notice=document.getElementById('notice'),search=document.getElementById('search');
let data={plugins:[],discoveryErrors:[],reloadRequired:false},busy=false;
function node(tag,text,className){const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(className)element.className=className;return element;}
function showMessage(message,error=false){notice.textContent=message;notice.classList.toggle('error',error);}
async function action(callback,message){if(busy)return;busy=true;render();try{const result=await callback();if(result?.plugins)data=result;showMessage(result?.canceled?'No changes made.':message);}catch(error){showMessage(error.message||'The operation failed.',true);try{data=await api.list();}catch{}}finally{busy=false;render();}}
function button(label,id,operation,callback,className){const element=node('button',label,className);element.type='button';element.dataset.plugin=id;element.dataset.action=operation;element.disabled=busy;element.addEventListener('click',callback);return element;}
function render(){
  const active=document.activeElement,focus=active?.dataset?.plugin?{id:active.dataset.plugin,action:active.dataset.action}:null;
  const filtered=data.plugins.filter(plugin=>(plugin.name+' '+plugin.id+' '+plugin.kind).toLowerCase().includes(search.value.toLowerCase()));
  list.replaceChildren();
  for(const plugin of filtered){
    const item=node('li',undefined,'plugin'+(plugin.enabled?' enabled':''));item.dataset.id=plugin.id;
    const top=node('div',undefined,'plugin-top'),description=node('div');description.append(node('h2',plugin.name),node('div',`${plugin.version} · ${plugin.kind==='sdk'?'Bridge SDK':'Chrome compatible'} · ${plugin.bundled?'Bundled':'Installed'}`,'meta'));
    const label=node('label',undefined,'enabled-label'),toggle=document.createElement('input');toggle.type='checkbox';toggle.checked=plugin.enabled;toggle.disabled=busy;toggle.dataset.plugin=plugin.id;toggle.dataset.action='toggle';toggle.setAttribute('aria-label',`Enable ${plugin.name}`);
    toggle.addEventListener('change',()=>action(()=>api.setEnabled(plugin.id,toggle.checked),toggle.checked?'Plugin enabled.':'Plugin disabled.'));
    label.append(toggle,node('span',plugin.enabled?'Enabled':'Disabled'));top.append(description,label);item.append(top);
    if(plugin.error)item.append(node('p',plugin.error,'problem'));
    const actions=node('div',undefined,'plugin-actions');actions.append(node('span',plugin.status==='error'?'Could not load':plugin.reloadRequired&&data.reloadRequired?(plugin.enabled?'Enabled · reload to apply':'Disabled · reload to remove page changes'):plugin.status==='running'?'Running':plugin.status==='loading'?'Loading…':plugin.enabled?'Waiting to start':'Not running','state'));
    const settings=button('Settings',plugin.id,'settings',()=>action(()=>api.open(plugin.id),'Plugin settings opened.'));settings.disabled=busy||!plugin.enabled||!plugin.settingsEntry;
    actions.append(settings,button('Uninstall',plugin.id,'uninstall',()=>action(()=>api.uninstall(plugin.id),'Plugin uninstalled. Saved settings kept.'),'remove'));item.append(actions);
    const details=node('details'),summary=node('summary','Permissions and identity');details.append(summary,node('p',`ID: ${plugin.id}`),node('p',`Requested: ${plugin.permissions.length?plugin.permissions.join(', '):'None'}`),node('p',`Approved: ${plugin.grants.length?plugin.grants.join(', '):'Not yet approved'}`));if(plugin.optionalPermissions?.length)details.append(node('p',`Optional: ${plugin.optionalPermissions.join(', ')}`));item.append(details);list.append(item);
  }
  document.getElementById('empty').hidden=filtered.length>0;document.getElementById('counts').textContent=`${data.plugins.length} installed · ${data.plugins.filter(p=>p.enabled).length} enabled`;
  document.getElementById('reload-notice').hidden=!data.reloadRequired;document.getElementById('plugin-directory').textContent=data.pluginDirectory||'';
  const errors=document.getElementById('errors');errors.replaceChildren();errors.hidden=!data.discoveryErrors.length;if(data.discoveryErrors.length){errors.append(node('h2','Packages needing attention'));for(const error of data.discoveryErrors)errors.append(node('p',`${error.folder||error.id}: ${error.error}`));}
  for(const id of ['install-folder','install-zip','discover','reload'])document.getElementById(id).disabled=busy;
  if(focus){const replacement=[...list.querySelectorAll('[data-plugin]')].find(el=>el.dataset.plugin===focus.id&&el.dataset.action===focus.action);replacement?.focus();}
}
document.getElementById('install-folder').addEventListener('click',()=>action(()=>api.installFolder(),'Plugin installed disabled. Enable it when ready.'));
document.getElementById('install-zip').addEventListener('click',()=>action(()=>api.installZip(),'Plugin installed disabled. Enable it when ready.'));
document.getElementById('discover').addEventListener('click',()=>action(()=>api.discover(),'Plugin folders scanned.'));
document.getElementById('reload').addEventListener('click',()=>action(()=>api.reload(),'Reload requested.'));
search.addEventListener('input',render);
api.onChanged(async()=>{if(busy)return;try{data=await api.list();render();}catch(error){showMessage(error.message,true);}});
api.list().then(result=>{data=result;render();showMessage('Ready. Enable only the plugins you want to run.');}).catch(error=>showMessage(error.message,true));
