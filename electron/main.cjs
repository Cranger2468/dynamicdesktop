const {app, BrowserWindow, Tray, Menu, screen, nativeImage, ipcMain, powerMonitor, shell, clipboard} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const {execFile} = require('node:child_process');
let control, island, tray, quitting=false, settings={enabled:true,login:false,offset:8,display:'primary',events:{}}, shared={active:'Media',expanded:false,playing:false}, poll, statsPoll, hitTest, player=null, lastCpu=os.cpus(), winVolume=50, wasPlaying=false, lastSeek=0, wasCharging=null, dockVisible=false;
let clips=[], lastClip='';
const UPDATE_URL='https://dynamicdesktop.lovable.app/version.json';
const run=(cmd,args)=>new Promise((res,rej)=>execFile(cmd,args,{timeout:180000},e=>e?rej(e):res()));
function findIn(dir,name,depth=3){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name); if(e.name===name) return p; if(e.isDirectory()&&depth>0&&!e.name.endsWith('.app')){const f=findIn(p,name,depth-1); if(f) return f;}} return null;}
// Unpack the downloaded zip, then a detached helper swaps the installed app after Island quits and reopens it.
async function installUpdate(zip){
 const work=fs.mkdtempSync(path.join(os.tmpdir(),'island-update-')); const pid=process.pid;
 if(process.platform==='darwin'){
  const current=path.resolve(process.execPath,'..','..','..'); if(!current.endsWith('.app')||current.includes('AppTranslocation')) throw new Error('not installable');
  fs.accessSync(path.dirname(current),fs.constants.W_OK);
  await run('/usr/bin/ditto',['-x','-k',zip,work]); const fresh=findIn(work,'Island.app'); if(!fresh) throw new Error('bad zip');
  const script=path.join(work,'install.sh');
  fs.writeFileSync(script,`#!/bin/sh\nwhile kill -0 ${pid} 2>/dev/null; do sleep 0.5; done\nrm -rf "${current}"\n/usr/bin/ditto "${fresh}" "${current}"\n/usr/bin/xattr -cr "${current}"\n/usr/bin/open "${current}"\n`,{mode:0o755});
  require('node:child_process').spawn('/bin/sh',[script],{detached:true,stdio:'ignore'}).unref();
 } else if(process.platform==='win32'){
  const current=path.dirname(process.execPath); fs.accessSync(current,fs.constants.W_OK);
  await run('powershell.exe',['-NoProfile','-Command',`Expand-Archive -LiteralPath '${zip}' -DestinationPath '${work}' -Force`]);
  const exe=findIn(work,'Island.exe'); if(!exe) throw new Error('bad zip'); const fresh=path.dirname(exe);
  const script=path.join(work,'install.ps1');
  fs.writeFileSync(script,`while (Get-Process -Id ${pid} -ErrorAction SilentlyContinue) { Start-Sleep -Milliseconds 500 }\nrobocopy "${fresh}" "${current}" /MIR /NFL /NDL /NJH /NJS | Out-Null\nStart-Process -FilePath "${path.join(current,'Island.exe')}"\n`);
  require('node:child_process').spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-WindowStyle','Hidden','-File',script],{detached:true,stdio:'ignore'}).unref();
 } else throw new Error('unsupported');
 setTimeout(()=>{app.isQuitting=true; app.quit();},800);
}
const devUrl=process.env.ISLAND_DEV_URL;
const mac=process.platform==='darwin', win=process.platform==='win32';
const run = (command,args) => new Promise((resolve,reject) => execFile(command,args,{timeout:8000,maxBuffer:65536,windowsHide:true},(error,stdout) => error ? reject(error) : resolve(String(stdout).trim())));
const ps = script => run('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command',script]);
// Windows: send virtual media/volume keys so any player (Spotify, browser, Groove) responds.
const winKey = (code,times=1) => ps(`$k=Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern void keybd_event(byte b,byte s,int f,int e);' -Name K -Namespace W -PassThru; for($i=0;$i -lt ${times};$i++){$k::keybd_event(${code},0,0,0);$k::keybd_event(${code},0,2,0)}`);
// Windows Core Audio: exact master volume get/set (no key-press stepping, so sliders stay smooth).
const WIN_AUDIO=`if(-not ('IslandAudio' -as [type])){Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IAudioEndpointVolume{int f();int g();int h();int i();int SetMasterVolumeLevelScalar(float l,System.Guid c);int j();int GetMasterVolumeLevelScalar(out float l);}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IMMDevice{int Activate(ref System.Guid id,int ctx,int p,out IAudioEndpointVolume v);}
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface IMMDeviceEnumerator{int f();int GetDefaultAudioEndpoint(int flow,int role,out IMMDevice d);}
[ComImport,Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDE{}
public class IslandAudio{static IAudioEndpointVolume V(){var e=new MMDE() as IMMDeviceEnumerator;IMMDevice d;Marshal.ThrowExceptionForHR(e.GetDefaultAudioEndpoint(0,1,out d));IAudioEndpointVolume v;var id=typeof(IAudioEndpointVolume).GUID;Marshal.ThrowExceptionForHR(d.Activate(ref id,23,0,out v));return v;}
public static float Get(){float l;Marshal.ThrowExceptionForHR(V().GetMasterVolumeLevelScalar(out l));return l;} public static void Set(float l){Marshal.ThrowExceptionForHR(V().SetMasterVolumeLevelScalar(l,System.Guid.Empty));}}
'@};`;
// Windows media session (any player that shows in the Windows media flyout: Spotify, browsers, Media Player).
const WIN_MEDIA=`Add-Type -AssemblyName System.Runtime.WindowsRuntime;$at=([System.WindowsRuntimeSystemExtensions].GetMethods()|?{$_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1'})[0];function Aw($o,$t){$k=$at.MakeGenericMethod($t).Invoke($null,@($o));$k.Wait(-1)|Out-Null;$k.Result};[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager,Windows.Media.Control,ContentType=WindowsRuntime]|Out-Null;$mgr=Aw ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]);$s=$mgr.GetCurrentSession();`;
function trusted(event) { return [control?.webContents.id,island?.webContents.id].includes(event.sender.id); }
function broadcast(channel,data,except) {for(const w of [control,island]) if(w && !w.isDestroyed() && w.webContents.id!==except) w.webContents.send(channel,data);}
function selectedDisplay() {return screen.getAllDisplays().find(d=>String(d.id)===settings.display) || screen.getPrimaryDisplay();}
function position() {if(!island) return; const display=selectedDisplay(); island.setBounds({x:Math.round(display.bounds.x+(display.bounds.width-410)/2),y:display.bounds.y,width:410,height:260});}
function persist() {fs.writeFileSync(path.join(app.getPath('userData'),'preferences.json'),JSON.stringify(settings));}
function configure(value) {
 if(!value || typeof value!=='object') throw new Error('Invalid settings');
 settings={...settings,...value,enabled:value.enabled!==false,login:value.login===true,offset:Math.min(60,Math.max(0,Number(value.offset)||0)),display:String(value.display||'primary')};
 if(mac || win) app.setLoginItemSettings({openAtLogin:settings.login,openAsHidden:true});
 persist(); position(); if(settings.enabled) island?.showInactive(); else island?.hide(); updateTray();
}
function secureWindow(w) {
 w.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 w.webContents.on('will-navigate',(e,url)=> {if(!devUrl && !url.startsWith('file://')) e.preventDefault(); if(devUrl && !url.startsWith(devUrl)) e.preventDefault();});
}
function load(w) {if(devUrl) return w.loadURL(devUrl); return w.loadFile(path.join(__dirname,'..','dist','index.html'));}
function showControl() {if(!control || control.isDestroyed()) makeControl(); else {control.show();control.focus();void readSystem();readStats();}}
function makeControl() {
 control=new BrowserWindow({width:1220,height:970,minWidth:780,minHeight:620,title:'Island',icon:path.join(__dirname,'icon.png'),backgroundColor:'#fafbfc',show:false,autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true}});
 secureWindow(control); load(control); control.once('ready-to-show',()=>control.show());
 control.webContents.on('did-finish-load',()=>{control.webContents.send('island:state',{...shared,settings}); void readSystem(); readStats();});
 control.on('close',e=>{if(!quitting){e.preventDefault();control.hide();}});
}
function makeIsland() {
 island=new BrowserWindow({width:410,height:260,frame:false,transparent:true,resizable:false,movable:false,hasShadow:false,alwaysOnTop:true,skipTaskbar:true,show:false,focusable:true,acceptFirstMouse:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,additionalArguments:['--island-overlay']}});
 island.setAlwaysOnTop(true,mac?'status':'screen-saver'); if(mac) island.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true}); secureWindow(island); position(); load(island);
 island.webContents.on('did-finish-load',()=>{island.webContents.send('island:state',{...shared,settings}); if(settings.enabled) island.showInactive();});
 island.on('blur',()=>{if(shared.expanded){shared.expanded=false; broadcast('island:state',{expanded:false});}});
 // A transparent rectangular window must pass pointer events outside the pill.
 hitTest=setInterval(()=>{if(!island || island.isDestroyed() || !settings.enabled || !island.isVisible()) return;const cursor=screen.getCursorScreenPoint(),bounds=island.getBounds();const width=shared.expanded?370:184;const height=shared.expanded?(shared.active==='Media'?190:shared.active==='Timer'?142:shared.active==='Assistant'?220:118):38;const x=cursor.x-bounds.x,y=cursor.y-bounds.y,top=settings.offset;const inside=x>=(410-width)/2&&x<=(410+width)/2&&y>=top&&y<=top+height;island.setIgnoreMouseEvents(!inside,{forward:true});},120);
}
function updateTray() {
 if(!tray) return;
 tray.setContextMenu(Menu.buildFromTemplate([{label:'Island',enabled:false},{type:'separator'},{label:'Open dashboard',click:showControl},{label:'Enable Island',type:'checkbox',checked:settings.enabled,click:item=>{configure({...settings,enabled:item.checked});broadcast('island:state',{settings});}},{label:'Expand island',click:()=>{shared.expanded=true;broadcast('island:state',{expanded:true});}},{label:'Collapse island',click:()=>{shared.expanded=false;broadcast('island:state',{expanded:false});}},{type:'separator'},{label:'Quit Island',accelerator:'CommandOrControl+Q',click:()=>{quitting=true;app.quit();}}]));
}
function controlAwake() {return control && !control.isDestroyed() && control.isVisible();}
function readStats() {
 const now=os.cpus(); let idle=0,total=0;
 now.forEach((c,i)=>{const p=lastCpu[i]?.times||{user:0,nice:0,sys:0,idle:0,irq:0};const t=c.times;const d=(t.user-p.user)+(t.nice-p.nice)+(t.sys-p.sys)+(t.irq-p.irq)+(t.idle-p.idle);total+=d;idle+=t.idle-p.idle;});
 lastCpu=now;
 if(!controlAwake()) return; // skip the payload work while the dashboard is hidden
 broadcast('island:system',{stats:{cpu:total>0?Math.round(100*(1-idle/total)):0,memUsed:os.totalmem()-os.freemem(),memTotal:os.totalmem(),uptime:os.uptime(),host:os.hostname(),os:`${mac?'macOS':win?'Windows':os.type()} ${os.release()}`,cpuModel:now[0]?.model?.trim()||'CPU',cores:now.length,arch:process.arch}});
}
const macScript = appName => `tell application "${appName}"\nif player state is not stopped then\nreturn (name of current track) & "||" & (artist of current track) & "||" & (player state as string) & "||" & (player position as string) & "||" & ((duration of current track) as string) & "||" & ${appName==='Spotify'?'(artwork url of current track)':'""'}\nend if\nend tell`;
const num = v => {const n=Number(String(v||'').replace(',','.')); return Number.isFinite(n)?n:0;};
async function macPlayer() {
 // Query only already-running players; never launch them.
 for(const appName of ['Spotify','Music']) {
  try {await run('/usr/bin/pgrep',['-x',appName]); const info=await run('/usr/bin/osascript',['-e',macScript(appName)]); if(info){const [title,artist,state,pos,dur,art]=info.split('||'); const length=appName==='Spotify'?num(dur)/1000:num(dur); return {app:appName,title,artist,playing:state==='playing',position:Math.round(num(pos)),length:Math.round(length),artwork:/^https:\/\//.test(art||'')?art.trim():''};}} catch {}
 }
 return null;
}
async function winPlayer() {
 const data=await ps(WIN_MEDIA+'if($s){$p=Aw ($s.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties]);$t=$s.GetTimelineProperties();$b=$s.GetPlaybackInfo();"$($p.Title)||$($p.Artist)||$($b.PlaybackStatus)||$([int]$t.Position.TotalSeconds)||$([int]$t.EndTime.TotalSeconds)||$($s.SourceAppUserModelId)"}');
 if(!data) return null; const [title,artist,state,pos,dur,source]=data.split('||'); if(!title) return null;
 return {app:(source||'Windows').split('!')[0].replace(/\.exe$/i,''),title,artist,playing:state==='Playing',position:num(pos),length:num(dur)};
}
let hadPlayer=false;
function sendPlayer() {if(!player){if(hadPlayer){hadPlayer=false;wasPlaying=false;broadcast('island:system',{cleared:true});} return;} hadPlayer=true; broadcast('island:system',{title:player.title,artist:player.artist,artwork:player.artwork||'',playing:player.playing,source:player.app,position:Date.now()-lastSeek<3000?undefined:player.position,length:player.length}); if(player.playing&&!wasPlaying) broadcast('island:state',{active:'Media',expanded:true}); wasPlaying=player.playing;}
async function readSystem() {
 if(!controlAwake() && !(island && !island.isDestroyed() && island.isVisible())) return; // nothing is showing; stay idle
 if(mac) {
   try {const data=await run('/usr/bin/pmset',['-g','batt']);const pct=data.match(/(\d+)%;/);const charging=data.includes('AC Power');const left=data.match(/(\d+:\d+) remaining/);if(pct) broadcast('island:system',{battery:Number(pct[1]),charging,batteryTime:left?`${left[1]} ${charging?'until full':'left'}`:''});if(wasCharging!==null&&charging!==wasCharging) broadcast('island:state',{active:'Battery',expanded:true});wasCharging=charging;} catch(error){console.warn('Battery unavailable:',error.message);}
   try {const volume=await run('/usr/bin/osascript',['-e','output volume of (get volume settings)']);broadcast('island:system',{volume:Number(volume)});}catch{}
   player=await macPlayer(); sendPlayer();
  } else if(win) {
   try {const data=await ps('$b=Get-CimInstance Win32_Battery | Select-Object -First 1; if($b){"$($b.EstimatedChargeRemaining)|$($b.BatteryStatus)"}');if(data){const [pct,status]=data.split('|');const charging=status!=='1';broadcast('island:system',{battery:Number(pct),charging});if(wasCharging!==null&&charging!==wasCharging) broadcast('island:state',{active:'Battery',expanded:true});wasCharging=charging;}}catch{}
   try {const v=await ps(WIN_AUDIO+'[math]::Round([IslandAudio]::Get()*100)'); if(v!=='') {winVolume=Number(v); broadcast('island:system',{volume:winVolume});}}catch{}
   try {const b=await ps('(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness -ErrorAction Stop | Select-Object -First 1).CurrentBrightness'); if(b!=='') broadcast('island:system',{brightness:Number(b)});}catch{}
   try {player=await winPlayer(); sendPlayer();}catch{}
  }
}
async function action(name,value) {
 if(name==='volume') {
  const n=Math.max(0,Math.min(100,Math.round(Number(value)))); if(!Number.isFinite(n)) throw new Error('Invalid volume');
  if(mac) await run('/usr/bin/osascript',['-e',`set volume output volume ${n}`]);
  else if(win) {await ps(WIN_AUDIO+`[IslandAudio]::Set(${(n/100).toFixed(2)})`); winVolume=n;}
  else throw new Error('Volume control needs macOS or Windows.');
  return;
 }
 if(['playPause','next','previous'].includes(name)) {
  if(win) {await winKey({playPause:0xB3,next:0xB0,previous:0xB1}[name]); lastSeek=0; return;}
  if(!mac) throw new Error('Media control needs macOS or Windows.');
  if(!player) player=await macPlayer();
  if(!player) throw new Error('Start a song in Spotify or Music first.');
  const command={playPause:'playpause',next:'next track',previous:'previous track'}[name];
  await run('/usr/bin/osascript',['-e',`tell application "${player.app}" to ${command}`]);
  return;
 }
 if(name==='seek') {
  const n=Math.max(0,Math.round(Number(value))); if(!Number.isFinite(n)) throw new Error('Invalid position'); lastSeek=Date.now();
  if(mac) {if(!player) player=await macPlayer(); if(!player) throw new Error('Start a song in Spotify or Music first.'); await run('/usr/bin/osascript',['-e',`tell application "${player.app}" to set player position to ${n}`]); return;}
  if(win) {await ps(WIN_MEDIA+`if($s){Aw ($s.TryChangePlaybackPositionAsync([long]${n}*10000000)) ([bool])|Out-Null}`); return;}
  throw new Error('Seeking needs macOS or Windows.');
 }
 if(name==='brightness') {
  const n=Math.max(0,Math.min(100,Math.round(Number(value)))); if(!Number.isFinite(n)) throw new Error('Invalid brightness');
  if(win) {try {await ps(`(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods -ErrorAction Stop | Select-Object -First 1) | Invoke-CimMethod -MethodName WmiSetBrightness -Arguments @{Timeout=1;Brightness=${n}} | Out-Null`); return;} catch {throw new Error('This display does not allow brightness changes from apps (external monitors usually do not).');}}
  if(mac) {
   // Step the built-in display with the brightness keys: 16 steps from 0 to 100%.
   const steps=Math.round(n/100*16);
   try {await run('/usr/bin/osascript',['-e',`tell application "System Events"\nrepeat 16 times\nkey code 145\nend repeat\nrepeat ${steps} times\nkey code 144\nend repeat\nend tell`]); return;}
   catch {throw new Error('Allow Island under System Settings → Privacy & Security → Accessibility to change brightness.');}
  }
  throw new Error('Brightness control needs macOS or Windows.');
 }
 throw new Error('Unknown action.');
}
if(!app.requestSingleInstanceLock()) app.quit();
else {
 app.on('second-instance',showControl);
 app.whenReady().then(()=>{
  try {settings={...settings,...JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'preferences.json'),'utf8'))};}catch{}
  app.dock?.hide(); makeIsland(); // dashboard window is created lazily on first open to keep idle memory low
  const icon=path.join(__dirname,'tray.png');
  const image=fs.existsSync(icon)?nativeImage.createFromPath(icon):nativeImage.createEmpty(); if(mac) image.setTemplateImage(true);
  tray=new Tray(image); tray.setToolTip('Island'); tray.on('click',showControl);updateTray();
  ipcMain.handle('island:configure',(event,value)=>{if(!trusted(event)) throw new Error('Untrusted caller');configure(value);});
  ipcMain.handle('island:displays',event=>{if(!trusted(event)) throw new Error('Untrusted caller');return [{id:'primary',name:'Primary display'},...screen.getAllDisplays().map((d,i)=>({id:String(d.id),name:d.label||`Display ${i+1} · ${d.size.width} × ${d.size.height}`}))];});
  ipcMain.on('island:state',(event,value)=>{if(!trusted(event)||!value||typeof value!=='object')return;const changed=JSON.stringify(value)!==JSON.stringify(shared);if(!changed)return;shared={...shared,...value};broadcast('island:state',value,event.sender.id);});
  ipcMain.handle('island:action',async(event,name,value)=>{
   if(!trusted(event))return {ok:false,error:'Untrusted caller'};
   try {await action(String(name),value); setTimeout(()=>void readSystem(),400); return {ok:true};}
   catch(error){return {ok:false,error:mac?`${error.message} If asked, allow Island in System Settings → Privacy & Security → Automation.`:error.message};}
   });
   ipcMain.handle('island:dock',event=>{if(!trusted(event)) throw new Error('Untrusted caller'); if(!app.dock) return {supported:false,visible:true}; dockVisible=!dockVisible; if(dockVisible) app.dock.show(); else app.dock.hide(); return {supported:true,visible:dockVisible};});
   ipcMain.handle('island:requestAutomation',async event=>{
    if(!trusted(event)) return {ok:false,error:'Untrusted caller'};
    if(!mac) return {ok:true,message:'Automation permissions are only needed on macOS.'};
    try {await run('/usr/bin/osascript',['-e','tell application "System Events" to return name of first process']); return {ok:true,message:'Automation access granted.'};}
    catch {return {ok:false,error:'Permission was not granted. Enable Island in System Settings → Privacy & Security → Automation.'};}
   });
   ipcMain.on('island:focus',event=>{if(!trusted(event)||!island||event.sender.id!==island.webContents.id) return; if(mac) app.focus({steal:true}); island.setIgnoreMouseEvents(false); island.focus();});
   ipcMain.handle('island:update',async event=>{
    if(!trusted(event)) return {ok:false,error:'Untrusted caller'};
    try {
     const res=await fetch(UPDATE_URL,{signal:AbortSignal.timeout(8000)});
     if(!res.ok) throw new Error(`Update check failed (${res.status})`);
     const data=await res.json(); const latest=String(data.version||''); const current=app.getVersion();
     const url=win?data.windows:process.arch==='arm64'?data.macArm:data.macIntel;
     const newer=(a,b)=>{const x=a.split('.').map(Number),y=b.split('.').map(Number);for(let i=0;i<3;i++){if((x[i]||0)>(y[i]||0))return true;if((x[i]||0)<(y[i]||0))return false;}return false;};
     const roadmap=Array.isArray(data.roadmap)?data.roadmap.filter(r=>r&&typeof r.version==='string').slice(0,5).map(r=>({version:r.version,title:String(r.title||''),eta:String(r.eta||'')})):[];
     return {ok:true,current,latest,updateAvailable:Boolean(latest)&&newer(latest,current),url:typeof url==='string'?new URL(url,UPDATE_URL).href:'',notes:Array.isArray(data.notes)?data.notes.map(String).slice(0,6):[],roadmap};
    } catch {return {ok:false,error:'Could not check for updates while offline.'};}
   });
   ipcMain.handle('island:downloadUpdate',async(event,url)=>{
    if(!trusted(event)) return {ok:false,error:'Untrusted caller'};
    const target=String(url||''); if(!target.startsWith('https://')) return {ok:false,error:'Invalid download address.'};
    try {
     const res=await fetch(target,{signal:AbortSignal.timeout(120000)});
     if(!res.ok||!res.body) throw new Error(`Download failed (${res.status})`);
     const total=Number(res.headers.get('content-length'))||0;
     const file=path.join(app.getPath('downloads'),target.split('/').pop()||'Island-update.zip');
     const out=fs.createWriteStream(file); const reader=res.body.getReader(); let received=0,lastSent=0;
     for(;;){const {done,value}=await reader.read(); if(done) break; received+=value.length; out.write(Buffer.from(value)); const pct=total?Math.round(100*received/total):0; if(pct!==lastSent){lastSent=pct; broadcast('island:update-progress',{pct});}}
     await new Promise(r=>out.end(r)); broadcast('island:update-progress',{pct:100,done:true});
     try { await installUpdate(file); return {ok:true,installing:true}; }
     catch { shell.showItemInFolder(file); return {ok:true,path:file}; }
    } catch(error){return {ok:false,error:'The download failed. Check your connection and try again.'};}
   });
  ipcMain.handle('island:clipboard',event=>{if(!trusted(event)) throw new Error('Untrusted caller'); return clips;});
  ipcMain.handle('island:copy',(event,text)=>{if(!trusted(event)) throw new Error('Untrusted caller'); const t=String(text||'').slice(0,20000); lastClip=t; clipboard.writeText(t); clips=[t,...clips.filter(c=>c!==t)].slice(0,5); broadcast('island:clipboard',clips);});
  setInterval(()=>{const t=clipboard.readText(); if(!t||t===lastClip||t.length>20000) return; lastClip=t; clips=[t,...clips.filter(c=>c!==t)].slice(0,5); broadcast('island:clipboard',clips);},1500);
  screen.on('display-added',position);screen.on('display-removed',position);screen.on('display-metrics-changed',position);
  powerMonitor.on('on-ac',()=>void readSystem());powerMonitor.on('on-battery',()=>void readSystem());
  void readSystem();const tick=()=>{poll=setTimeout(async()=>{await readSystem().catch(()=>{});tick();},player?.playing?1500:player?3000:8000);};tick();statsPoll=setInterval(readStats,5000);
 });
}
app.on('window-all-closed',()=>{});
app.on('activate',showControl);
app.on('before-quit',()=>{quitting=true;clearTimeout(poll);clearInterval(statsPoll);clearInterval(hitTest);});
