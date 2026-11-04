'use strict';
const {app,BrowserWindow,session}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createHost}=require('../runtime/host.cjs');
const {inspectPackage}=require('../runtime/registry.cjs');
const output=process.env.BRIDGE_VERIFICATION_OUTPUT||path.resolve(__dirname,'..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'bridge-ad-cleaner-check-'));
app.setPath('userData',path.join(temp,'profile'));
const report={plugin:'faceit-ad-cleaner',version:'1.0.0',runtime:process.versions,checks:[],success:false};
function check(name,ok){report.checks.push({name,passed:!!ok});if(!ok)throw Error(name);}
async function waitFor(wc,expression){for(let i=0;i<100;i++){if(await wc.executeJavaScript(expression))return true;await new Promise(resolve=>setTimeout(resolve,20));}return false;}
let host;
const timer=setTimeout(()=>{report.error='Timed out';finish(1);},20000);
async function finish(code){clearTimeout(timer);try{await host?.dispose();}catch{}for(const win of BrowserWindow.getAllWindows())win.destroy();fs.writeFileSync(path.join(output,'ad-cleaner-verification.json'),JSON.stringify(report,null,2));app.exit(code);}
app.whenReady().then(async()=>{
 try{
  const html=`<!doctype html><title>Offline FACEIT ad fixture</title><style>body{margin:0}#match{height:60px}.fipFRp{height:150px}.slot{height:90px}</style>
  <main id="match">Match score: 13-11 <button id="queue">Queue</button></main>
  <a id="legitimate-premium" href="/subscriptions/cs2/premium">Go premium</a>
  <div id="provided-ad" class="Overview__AdPlacementWrapper-sc-cba72dce-0 fipFRp"><div class="_8a5i0G_stack"><div class="Js284q_holder"><span>Go premium</span><span>Get an ad-free experience</span><span>Advertisement</span></div><div class="_8a5i0G_wrapper _8a5i0G_wrapperFilled"><div style="height:90px"><div id="F_Client_PostMatch_SD_728x90" data-fuse="F_Client_PostMatch_SD_728x90"><div class="fuse-slot"><iframe id="google_ads_iframe_fixture" title="3rd party ad content" width="728" height="90"></iframe></div></div></div><span>Advertisement</span><a href="/subscriptions/cs2/premium?cp=ad_placement_display">Remove Ads</a></div></div></div>
  <div id="standalone-slot" data-fuse="F_Client_Home_300x250" class="slot">Advertisement</div>
  <iframe id="match-video" title="Match video" width="300" height="150"></iframe>`;
  await session.defaultSession.protocol.handle('https',()=>new Response(html,{headers:{'content-type':'text/html'}}));
  const parent=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
  const wc=parent.webContents,url='https://www.faceit.com/bridge-ad-cleaner-fixture';await parent.loadURL(url);
  check('Baseline fixture has a visible 150px ad wrapper',await wc.executeJavaScript("document.getElementById('provided-ad').getBoundingClientRect().height===150"));
  const info=inspectPackage(path.resolve(__dirname,'../plugins/faceit-ad-cleaner'));
  check('Plugin requests only panel and style permissions',JSON.stringify(info.permissions)===JSON.stringify(['panel','page.styles']));
  host=createHost({adapterId:'ad-cleaner-test',storageDirectory:path.join(temp,'settings'),pluginDirectory:info.directory,grantedPermissions:info.permissions,isPageAllowed:value=>value===url,standalone:false,showOnAttach:false,worldId:10471});
  const panel=host.attach(parent);
  check('Plugin settings page loads successfully',await waitFor(panel.webContents,"document.title==='FACEIT Ad Cleaner'&&document.readyState==='complete'"));
  check('Provided ad wrapper collapses completely',await waitFor(wc,"document.getElementById('provided-ad').getBoundingClientRect().height===0"));
  check('Premium placeholder and labels are inside collapsed wrapper',await wc.executeJavaScript("document.getElementById('provided-ad').innerText.includes('Go premium')&&getComputedStyle(document.getElementById('provided-ad')).display==='none'"));
  check('Standalone Fuse slot is hidden',await wc.executeJavaScript("getComputedStyle(document.getElementById('standalone-slot')).display==='none'"));
  check('Normal match content is visible',await wc.executeJavaScript("document.getElementById('match').getBoundingClientRect().height===60&&document.getElementById('queue').getBoundingClientRect().height>0"));
  check('Unrelated Premium link is visible',await wc.executeJavaScript("getComputedStyle(document.getElementById('legitimate-premium')).display!=='none'"));
  check('Normal match video is visible',await wc.executeJavaScript("document.getElementById('match-video').getBoundingClientRect().height>0"));
  await wc.executeJavaScript("const dynamic=document.createElement('div');dynamic.id='dynamic-ad';dynamic.className='AnotherPage__AdPlacementWrapper-sc-new newHash';dynamic.textContent='Later ad';document.body.append(dynamic)");
  check('New ad inserted during SPA navigation is hidden automatically',await wc.executeJavaScript("getComputedStyle(document.getElementById('dynamic-ad')).display==='none'"));
  await wc.executeJavaScript("document.getElementById('provided-ad').className='Overview__AdPlacementWrapper-sc-updated changedHash'");
  check('Changing generated style hashes keeps ad hidden',await wc.executeJavaScript("getComputedStyle(document.getElementById('provided-ad')).display==='none'"));
  check('No matching ad nodes are destroyed',await wc.executeJavaScript("!!document.getElementById('provided-ad')&&!!document.getElementById('dynamic-ad')"));
  await parent.loadURL(url);
  check('Filtering reapplies after a full page navigation',await waitFor(wc,"document.getElementById('provided-ad').getBoundingClientRect().height===0"));
  await host.dispose();host=null;
  check('Disabling restores the original ad wrapper height',await wc.executeJavaScript("document.getElementById('provided-ad').getBoundingClientRect().height===150"));
  check('Disabling restores standalone slots',await wc.executeJavaScript("getComputedStyle(document.getElementById('standalone-slot')).display!=='none'"));
  check('Disabling leaves match content intact',await wc.executeJavaScript("document.getElementById('match').textContent.includes('13-11')"));
  check('Plugin settings renderer is disposed',panel.isDestroyed());
  report.success=true;
 }catch(error){report.error=error.stack;console.error(error);}
 await finish(report.success?0:1);
});
