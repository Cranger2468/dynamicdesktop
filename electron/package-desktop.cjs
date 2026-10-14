// Usage: node electron/package-desktop.cjs <darwin|win32> <x64|arm64>
const {packager}=require('@electron/packager');
const os=require('node:os');
const path=require('node:path');
(async()=>{
 const platform=process.argv[2]==='win32'?'win32':'darwin';
 const arch=process.argv[3]==='arm64'?'arm64':'x64';
 const out=path.join(os.tmpdir(),'island-release');
 const paths=await packager({dir:path.join(__dirname,'..'),name:'Island',platform,arch,out,overwrite:true,appBundleId:'app.island.desktop',appVersion:'2.2.0',icon:path.join(__dirname,'icon'),prune:false,ignore:[/^\/(node_modules|src|public|\.git|\.lovable|\.output|\.tanstack|\.nitro|\.data|dist-web)($|\/)/,/^\/electron\/(renderer|index|vite)/],extendInfo:{NSAppleEventsUsageDescription:'Island controls playback in Spotify or Music and changes volume when you ask.',LSUIElement:true,LSMinimumSystemVersion:'12.0'}});
 console.log('Packaged app:',paths[0]);
})().catch(error=>{console.error(error);process.exitCode=1;});
