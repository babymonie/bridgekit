'use strict';
const crypto = require('node:crypto');
function parse(bytes) {
  if (bytes.readUInt32LE(0) !== 4) throw Error('Invalid ASAR header');
  const headerSize = bytes.readUInt32LE(4), jsonSize = bytes.readUInt32LE(12);
  if (headerSize > bytes.length - 8 || jsonSize > headerSize - 8) throw Error('Invalid ASAR lengths');
  return { header: JSON.parse(bytes.subarray(16, 16 + jsonSize)), dataOffset: 8 + headerSize };
}
function member(bytes, name) {
  const { header, dataOffset } = parse(bytes), file = header.files[name];
  if (!file || file.unpacked) throw Error(`Missing packed member ${name}`);
  return bytes.subarray(dataOffset + Number(file.offset), dataOffset + Number(file.offset) + file.size);
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
module.exports = { parse, member, patch };
