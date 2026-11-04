'use strict';
const crypto = require('node:crypto');
function parse(bytes) {
  if (bytes.readUInt32LE(0) !== 4) throw Error('Invalid ASAR header');
  const headerSize = bytes.readUInt32LE(4), jsonSize = bytes.readUInt32LE(12);
  if (headerSize > bytes.length - 8 || jsonSize > headerSize - 8) throw Error('Invalid ASAR lengths');
  return { header: JSON.parse(bytes.subarray(16, 16 + jsonSize)), dataOffset: 8 + headerSize };
}
function member(bytes, name) {
  const { header, dataOffset } = parse(bytes);
  const parts = name.split('/');
  if (parts.some(part => !part || part === '..' || part === '.') || name.includes('\\') || name.includes(':')) throw Error('Invalid archive member path');
  let file = header;
  for (const part of parts) file = file?.files?.[part];
  if (!file || file.unpacked || file.link || !Number.isSafeInteger(file.size) || file.size < 0 || !/^\d+$/.test(String(file.offset)) || dataOffset + Number(file.offset) + file.size > bytes.length) throw Error(`Missing or invalid packed member ${name}`);
  return bytes.subarray(dataOffset + Number(file.offset), dataOffset + Number(file.offset) + file.size);
}
function entryInfo(bytes) {
  const manifest = JSON.parse(member(bytes, 'package.json'));
  let main = manifest.main === undefined ? 'index.js' : manifest.main;
  if (typeof main !== 'string') throw Error('App main entry must be a string');
  main = main.replace(/^\.\//, '').replace(/\/$/, '');
  if (!main || main.startsWith('/') || main.includes('\\') || main.includes(':') || main.split('/').some(p => !p || p === '..' || p === '.')) throw Error('App main entry must stay inside the archive');
  const candidates = /\.(?:js|cjs|mjs)$/.test(main) ? [main] : [main, main + '.js', main + '/index.js'];
  main = candidates.find(name => { try { member(bytes, name); return /\.(?:js|cjs|mjs)$/.test(name); } catch { return false; } });
  if (!main) throw Error('A packed JavaScript main entry could not be resolved');
  let type = 'commonjs';
  if (main.endsWith('.mjs')) type = 'module';
  else if (!main.endsWith('.cjs')) {
    const folders = main.split('/').slice(0, -1);
    for (let i = folders.length; i >= 0; i--) {
      const scope = [...folders.slice(0, i), 'package.json'].join('/');
      let json; try { json = member(bytes, scope); } catch { continue; }
      type = JSON.parse(json).type === 'module' ? 'module' : 'commonjs'; break;
    }
  }
  return { manifest, main, type };
}
function patchGeneric(bytes) {
  const { header, dataOffset } = parse(bytes), info = entryInfo(bytes);
  const entry = info.type === 'module' ? 'bridgekit-bootstrap.mjs' : 'bridgekit-bootstrap.cjs';
  if (header.files['bridge-bootstrap.cjs'] || header.files['bridgekit-bootstrap.cjs'] || header.files['bridgekit-bootstrap.mjs']) throw Error('An existing bootstrap was found; use its update/restore workflow');
  const error = "console.error('[BridgeKit] Initialization skipped:', error.message);";
  const bootstrap = info.type === 'module'
    ? `import {createRequire} from 'node:module';\nimport {fileURLToPath,pathToFileURL} from 'node:url';\nimport path from 'node:path';\nconst require=createRequire(import.meta.url);\nconst root=path.dirname(fileURLToPath(import.meta.url));\ntry{require(path.join(root,'..','bridgekit-runtime','bootstrap.cjs'));}catch(error){${error}}\nawait import(pathToFileURL(path.join(root,${JSON.stringify(info.main)})).href);\n`
    : `'use strict';\nconst path=require('node:path');\ntry{require(path.join(__dirname,'..','bridgekit-runtime','bootstrap.cjs'));}catch(error){${error}}\nrequire(path.join(__dirname,${JSON.stringify(info.main)}));\n`;
  const manifest = { ...info.manifest, main: entry };
  const additions = [['package.json', Buffer.from(JSON.stringify(manifest, null, 2))], [entry, Buffer.from(bootstrap)]];
  let offset = bytes.length - dataOffset;
  for (const [name, body] of additions) {
    const hash = crypto.createHash('sha256').update(body).digest('hex');
    header.files[name] = { size: body.length, offset: String(offset), integrity: { algorithm: 'SHA256', hash, blockSize: 4194304, blocks: [hash] } };
    offset += body.length;
  }
  const json = Buffer.from(JSON.stringify(header)), padding = (4 - json.length % 4) % 4, pickle = Buffer.alloc(16 + json.length + padding);
  pickle.writeUInt32LE(4, 0); pickle.writeUInt32LE(8 + json.length + padding, 4);
  pickle.writeUInt32LE(4 + json.length + padding, 8); pickle.writeUInt32LE(json.length, 12); json.copy(pickle, 16);
  return { bytes: Buffer.concat([pickle, bytes.subarray(dataOffset), ...additions.map(([, body]) => body)]), main: info.main, type: info.type, entry };
}
function patch(bytes) {
  const { header, dataOffset } = parse(bytes);
  const manifest = JSON.parse(member(bytes, 'package.json'));
  if (manifest.main !== 'main.js' || header.files['bridge-bootstrap.cjs']) throw Error('Unexpected entry point');
  manifest.main = 'bridge-bootstrap.cjs';
  const additions = [['package.json', Buffer.from(JSON.stringify(manifest, null, 2))], ['bridge-bootstrap.cjs', Buffer.from("'use strict';\nrequire(require('node:path').join(__dirname, '..', 'bridge-runtime', 'bootstrap.cjs'));\n")]];
  let offset = bytes.length - dataOffset;
  for (const [name, body] of additions) {
    const hash = crypto.createHash('sha256').update(body).digest('hex');
    header.files[name] = { size: body.length, offset: String(offset), integrity: { algorithm: 'SHA256', hash, blockSize: 4194304, blocks: [hash] } };
    offset += body.length;
  }
  const json = Buffer.from(JSON.stringify(header)), padding = (4 - json.length % 4) % 4;
  const pickle = Buffer.alloc(16 + json.length + padding);
  pickle.writeUInt32LE(4, 0); pickle.writeUInt32LE(8 + json.length + padding, 4);
  pickle.writeUInt32LE(4 + json.length + padding, 8); pickle.writeUInt32LE(json.length, 12); json.copy(pickle, 16);
  return Buffer.concat([pickle, bytes.subarray(dataOffset), ...additions.map(([, body]) => body)]);
}
module.exports = { parse, member, patch, entryInfo, patchGeneric };
