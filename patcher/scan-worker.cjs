'use strict';
const {parentPort,workerData}=require('node:worker_threads');
require('../tools/app-scanner.cjs').scanApps(workerData,update=>parentPort.postMessage({type:'progress',update})).then(result=>parentPort.postMessage({type:'done',result}),error=>parentPort.postMessage({type:'error',message:error.message}));
