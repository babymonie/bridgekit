'use strict';
// Pure lifecycle coordinator; adapters implement Electron operations separately.
class PluginController {
  constructor({registry,runtime}){this.registry=registry;this.runtime=runtime;this.status=new Map();this.queue=Promise.resolve();}
  list(){return this.registry.list().map(entry=>({...entry,...this.status.get(entry.id),status:this.status.get(entry.id)?.status||(entry.enabled?'stopped':'disabled')}));}
  serial(action){const result=this.queue.then(action);this.queue=result.catch(()=>{});return result;}
  async start(id){const entry=this.registry.get(id);if(!entry.enabled)return;const state=this.status.get(id);if(state?.status==='running')return;this.status.set(id,{...state,status:'loading',error:null});try{const result=await this.runtime.activate(entry,this.registry.package(id));this.status.set(id,{...this.status.get(id),status:'running',error:null,reloadRequired:!!result?.reloadRequired});}catch(error){await this.runtime.deactivate(entry).catch(()=>{});this.status.set(id,{status:'error',error:error.message});throw error;}}
  initialize(){return this.serial(async()=>{this.registry.discover();for(const entry of this.registry.list())if(entry.enabled)await this.start(entry.id).catch(()=>{});return this.list();});}
  setEnabled(id,enabled){return this.serial(async()=>{
    const entry=this.registry.get(id);
    if(enabled){this.registry.setEnabled(id,true);try{await this.start(id);}catch(error){this.registry.setEnabled(id,false);throw error;}}
    else{this.registry.setEnabled(id,false);try{const result=await this.runtime.deactivate(entry);this.status.set(id,{status:'disabled',error:null,reloadRequired:!!result?.reloadRequired});}catch(error){this.status.set(id,{status:'error',error:error.message,reloadRequired:true});throw error;}}
    return this.list();
  });}
  uninstall(id){return this.serial(async()=>{const entry=this.registry.get(id);this.registry.setEnabled(id,false);const result=await this.runtime.deactivate(entry);this.registry.uninstall(id);this.status.delete(id);return{plugins:this.list(),reloadRequired:!!result?.reloadRequired};});}
  open(id,parent){return this.serial(async()=>{const entry=this.registry.get(id);if(!entry.enabled)throw Error('Enable this plugin before opening settings');await this.start(id);return this.runtime.open(entry,parent);});}
  discover(){return this.serial(async()=>{this.registry.discover();for(const problem of this.registry.discoveryErrors){if(!problem.id)continue;const entry=this.registry.get(problem.id);this.registry.setEnabled(entry.id,false);await this.runtime.deactivate(entry).catch(()=>{});this.status.set(entry.id,{status:'error',error:problem.error,reloadRequired:true});}for(const entry of this.registry.list())if(entry.enabled)await this.start(entry.id).catch(()=>{});return this.list();});}
}
module.exports={PluginController};
