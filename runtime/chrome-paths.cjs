'use strict';
// Chrome trims leading slashes from manifest content-script resource paths.
// This applies only to extension resources, never arbitrary filesystem paths.
function contentResourcePath(value){return typeof value==='string'?value.replace(/^\/+/, ''):value;}
module.exports={contentResourcePath};
