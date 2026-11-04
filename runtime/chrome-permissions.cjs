'use strict';
const isOrigin=value=>value==='<all_urls>'||value.includes('://');
function approvedPermissions(entry){
  const declared=new Set([...entry.permissions,...entry.optionalPermissions||[]]);
  const grants=entry.enabled?entry.grants.filter(value=>declared.has(value)):[];
  return{permissions:grants.filter(value=>!isOrigin(value)),origins:grants.filter(isOrigin)};
}
function bindPermissions(manager,registry,active){
  const api=manager.api?.permissions;if(!api)return;
  const original=api.processExtension.bind(api);
  api.processExtension=extension=>{
    const item=[...active.values()].find(item=>item.entry.nativeIdentity===extension.id||item.info.directory===extension.path);
    if(!item)return original(extension);
    api.permissionMap.set(extension.id,approvedPermissions(registry.get(item.entry.id)));
  };
}
module.exports={approvedPermissions,bindPermissions};
