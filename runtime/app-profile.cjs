'use strict';
const path = require('node:path');
const {fileURLToPath} = require('node:url');
function pageOrigin(url){return ['http:','https:'].includes(url.protocol)?url.origin:`${url.protocol}//${url.host}`;}
function pagePolicy(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.origins) || !Array.isArray(value.localPages)) throw Error('Explicit pageAccess.origins and localPages arrays are required');
  const origins = [...new Set(value.origins.map(origin => {
    if (typeof origin !== 'string' || origin.includes('*')) throw Error('Use exact app origins, not wildcards');
    const url = new URL(origin);
    if (['file:','data:','javascript:','chrome-extension:','chrome:','devtools:','about:'].includes(url.protocol) || !url.hostname || url.username || url.password || pageOrigin(url) !== origin) throw Error('Use an exact origin such as https://app.example.com or app://desktop');
    return origin;
  }))];
  const localPages = [...new Set(value.localPages.map(page => {
    if (typeof page !== 'string' || !page.endsWith('.html') || page.includes('\\') || page.includes(':') || page.startsWith('/') || page.split('/').some(p => !p || p === '.' || p === '..')) throw Error('Local pages must be contained HTML paths');
    return page;
  }))];
  if (!origins.length && !localPages.length) throw Error('Choose at least one app origin or local HTML page');
  return {origins, localPages};
}
function validateProfile(input, base = process.cwd()) {
  if (!input || input.schemaVersion !== 1 || !/^[a-z][a-z0-9-]{1,47}$/.test(input.appId) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(input.appId) || typeof input.name !== 'string' || !input.name.trim() || input.name.length > 120) throw Error('Invalid app profile identity/schema');
  if (!/^[a-f0-9]{64}$/.test(input.sha256) || !/^[a-f0-9]{64}$/.test(input.executableSha256)) throw Error('Profile must pin archive and executable SHA-256 hashes');
  if (typeof input.archive !== 'string' || !input.archive.endsWith('.asar') || typeof input.executable !== 'string' || !input.executable) throw Error('Profile requires archive and executable paths');
  if (input.nativeExtensions !== undefined && typeof input.nativeExtensions !== 'boolean') throw Error('nativeExtensions must be boolean');
  return {schemaVersion:1, appId:input.appId, name:input.name.trim(), archive:path.resolve(base,input.archive), executable:path.resolve(base,input.executable), sha256:input.sha256, executableSha256:input.executableSha256, pageAccess:pagePolicy(input.pageAccess), nativeExtensions:input.nativeExtensions === true};
}
function isPageAllowed(profile, value) {
  try {
    const url = new URL(value);
    if (profile.pageAccess.origins.includes(pageOrigin(url))) return true;
    if (url.protocol !== 'file:') return false;
    const file = fileURLToPath(url);
    return profile.pageAccess.localPages.some(page => path.normalize(file) === path.join(profile.archive,...page.split('/')));
  } catch { return false; }
}
module.exports = {pagePolicy,validateProfile,isPageAllowed};
