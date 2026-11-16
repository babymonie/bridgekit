'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const AdmZip = require('../vendor/adm-zip');
const { preparePackage } = require('../runtime/package-import.cjs');
const catalog = require('../site/catalog.json');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'work', 'site-dist');
const downloads = path.join(out, 'downloads');
const source = 'https://github.com/babymonie/bridgekit/tree/main';
const appNames = { faceit: 'FACEIT', wand: 'Wand', general: 'General' };
const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char]);

function buildPlugin({ id, description }, staging) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw Error(`Invalid catalog ID: ${id}`);
  if (typeof description !== 'string' || !description.trim()) throw Error(`Description missing: ${id}`);

  const directory = `plugins/${id}`;
  const tracked = execFileSync('git', ['ls-files', '-z', '--', directory], { cwd: root, encoding: 'utf8' })
    .split('\0').filter(Boolean);
  const zip = new AdmZip();
  for (const file of tracked) {
    if (!fs.lstatSync(path.join(root, file)).isFile()) throw Error(`Expected a regular file: ${file}`);
    const relative = file.slice(directory.length + 1);
    const entry = zip.addFile(relative, fs.readFileSync(path.join(root, file)));
    entry.header.time = new Date(2000, 0, 1);
  }

  const archive = path.join(staging, `${id}.zip`);
  fs.writeFileSync(archive, zip.toBuffer());
  const prepared = preparePackage(archive, staging);
  try {
    const { id: packageId, name, version, permissions, kind, apps } = prepared.info;
    if (packageId !== id) throw Error(`Catalog ID does not match package ID: ${id}`);

    const targets = apps?.length ? apps : ['general'];
    if (targets.some(app => !Object.hasOwn(appNames, app))) throw Error(`Unknown app target: ${id}`);
    if (!/^\d+(?:\.\d+)*(?:-[a-z\d.-]+)?$/i.test(version)) throw Error(`Invalid download version: ${id}`);
    const filename = `${id}-${version}.zip`;
    const sha256 = createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
    fs.copyFileSync(archive, path.join(downloads, filename));
    const appLabel = targets.map(app => appNames[app]).join(', ');
    const format = kind === 'sdk' ? 'Bridge SDK' : 'Chrome MV3';

    return {
      metadata: { id, name, description, version, kind, apps: targets, permissions, sha256, download: `downloads/${filename}`, source: `${source}/${directory}` },
      html: `<article class="plugin" id="${id}" data-apps="${targets.join(' ')}">
        <div class="row"><span class="tile ${targets[0]}" aria-hidden="true">${escape(name[0])}</span>
          <div><h3>${escape(name)}</h3><span class="tag">${escape(appLabel)} · ${format} · v${escape(version)}</span></div></div>
        <p>${escape(description)}</p>
        <details><summary>Permissions and checksum</summary>
          <p>${escape(permissions.join(', ') || 'None')}</p><p>SHA-256 <code>${sha256}</code></p></details>
        <div class="actions"><a class="button" href="downloads/${escape(filename)}" download aria-label="Download ${escape(name)} ZIP">Download ZIP ↓</a>
          <a href="${source}/${directory}" aria-label="View ${escape(name)} source">Source ↗</a></div>
      </article>`
    };
  } finally {
    prepared.cleanup();
  }
}

if (new Set(catalog.map(entry => entry.id)).size !== catalog.length) throw Error('Duplicate catalog ID');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(downloads, { recursive: true });
const staging = fs.mkdtempSync(path.join(os.tmpdir(), 'bridgekit-catalog-'));
try {
  const entries = catalog.map(entry => buildPlugin(entry, staging));
  const template = fs.readFileSync(path.join(root, 'site/index.html'), 'utf8');
  const marker = '<!-- PLUGIN_CARDS -->';
  if (template.split(marker).length !== 2) throw Error('Expected exactly one plugin catalog marker');
  fs.writeFileSync(path.join(out, 'index.html'), template.replace(marker, () => entries.map(entry => entry.html).join('\n')));
  fs.writeFileSync(path.join(out, 'catalog.json'), JSON.stringify(entries.map(entry => entry.metadata), null, 2) + '\n');
  for (const file of ['site.css', 'site.js']) fs.copyFileSync(path.join(root, 'site', file), path.join(out, file));
  fs.copyFileSync(path.join(root, 'runtime/bridge-icon.png'), path.join(out, 'bridge-icon.png'));
  console.log(`Built BridgeKit site with ${entries.length} installable plugins in ${out}`);
} finally {
  fs.rmSync(staging, { recursive: true, force: true });
}
