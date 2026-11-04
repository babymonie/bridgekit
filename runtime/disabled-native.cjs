'use strict';
function createDisabledNative(reason){
 const unavailable=async()=>{throw Error(reason?`Native Chrome compatibility could not initialize: ${reason}; SDK plugins remain available`:'Native Chrome compatibility is disabled for this app profile; SDK plugins remain available');};
 return{ensure(){},observe(){},activate:unavailable,open:unavailable,async deactivate(){return{reloadRequired:false};}};
}
module.exports={createDisabledNative};
