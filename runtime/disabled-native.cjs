'use strict';
const unavailable = async () => { throw Error('Native Chrome compatibility is disabled for this app profile; SDK plugins remain available'); };
module.exports = {createDisabledNative:()=>({ensure(){},observe(){},activate:unavailable,open:unavailable,async deactivate(){return{reloadRequired:false};}})};
