'use strict';
const path = require('node:path');
const { spawn } = require('node:child_process');
// A stock Electron development runtime. Packaged app executables ignore app-path arguments.
const binary = process.env.BRIDGE_ELECTRON || require('electron');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(binary, [path.resolve(__dirname, '../demo/manager.cjs'), ...process.argv.slice(2)], { env, windowsHide: true, stdio: 'inherit' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code || 0; });
