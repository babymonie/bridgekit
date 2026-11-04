'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { status } = require('./faceit.cjs');
const state = status(process.argv[2]);
if (!state.installed) throw Error('Install the verified FACEIT adapter first.');
const output = path.resolve(__dirname, '..'), receipt = path.join(output, 'verification.json');
const before = fs.existsSync(receipt) ? fs.statSync(receipt).mtimeMs : 0;
const env = { ...process.env, BRIDGE_VERIFICATION_OUTPUT: output };
delete env.ELECTRON_RUN_AS_NODE; delete env.NODE_OPTIONS;
const child = spawn(path.resolve(state.resources, '../FACEIT.exe'), ['--bridge-verify'], { env, windowsHide: true, stdio: 'inherit' });
const timer = setTimeout(() => { child.kill(); console.error('Diagnostic process timed out'); process.exitCode = 1; }, 45000);
child.on('error', error => { clearTimeout(timer); console.error(error); process.exitCode = 1; });
child.on('exit', code => {
  clearTimeout(timer);
  const report = fs.existsSync(receipt) && fs.statSync(receipt).mtimeMs > before ? JSON.parse(fs.readFileSync(receipt)) : null;
  if (code || !report?.success || !report.adapterTest) { console.error('FACEIT diagnostic did not produce a passing fresh receipt'); process.exitCode = 1; }
});
