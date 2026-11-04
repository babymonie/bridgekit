'use strict';
// The desktop patcher must inspect ASAR bytes, not Electron's virtual directory.
try{module.exports=require('original-fs');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;module.exports=require('node:fs');}
