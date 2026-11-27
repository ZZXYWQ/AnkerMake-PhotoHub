/* AnkerMake PhotoHub 0.8.7 Public Beta; production payload only. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),stage=process.env.PH_STAGE_ROOT?path.resolve(process.env.PH_STAGE_ROOT):path.join(root,'dist/release-payload-0.8.7');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
if(manifest.version!=='0.8.7'||manifest.releaseChannel!=='public-beta'||manifest.supportedHostVersion!=='5.1.3'||manifest.hostEditorVersion!=='1.25.04'||manifest.nativeInkAbiVerified!==true)throw Error('Release profile/native ABI verification is incomplete; refusing production payload staging');
fs.mkdirSync(stage,{recursive:true});
for(const file of fs.readdirSync(path.join(root,'payload'))){if(file.endsWith('.js'))fs.copyFileSync(path.join(root,'payload',file),path.join(stage,file));}
fs.copyFileSync(process.env.PH_BRIDGE_EXE?path.resolve(process.env.PH_BRIDGE_EXE):path.join(root,'dist/EufyPhotoCraftBridge.exe'),path.join(stage,'bridge.exe'));
fs.mkdirSync(path.join(stage,'native'),{recursive:true});
for(const [source,dest]of [['native/bin/PhotoHubInk.dll','native/PhotoHubInk.dll'],['native/vendor/minhook-1.3.4/LICENSE.txt','native/MinHook-LICENSE.txt'],['native/PROVENANCE.txt','native/PROVENANCE.txt'],['native/使用说明.txt','使用说明.txt'],['THIRD-PARTY-NOTICES.txt','THIRD-PARTY-NOTICES.txt'],['LICENSE','LICENSE']])fs.copyFileSync(source==='native/bin/PhotoHubInk.dll'&&process.env.PH_NATIVE_DLL?path.resolve(process.env.PH_NATIVE_DLL):path.join(root,source),path.join(stage,dest));
fs.cpSync(path.join(root,'licenses'),path.join(stage,'licenses'),{recursive:true});
const crypto=require('node:crypto'),modelRoot=process.env.PH_DEPTH_MODEL_ROOT;
if(!modelRoot)throw Error('Set PH_DEPTH_MODEL_ROOT to the verified exported model directory; AI is bundled, never downloaded at runtime');
const model=path.join(modelRoot,'depth-anything-v2-small.onnx');
if(crypto.createHash('sha256').update(fs.readFileSync(model)).digest('hex')!==manifest.bundledAiDepth?.modelSha256)throw Error('Bundled AI model checksum mismatch');
fs.mkdirSync(path.join(stage,'models/depth'),{recursive:true});
for(const file of ['depth-anything-v2-small.onnx','depth-anything-v2-small.json','LICENSE.txt','README.md'])fs.copyFileSync(path.join(modelRoot,file),path.join(stage,'models/depth',file));
const strokeRoot=process.env.PH_STROKE_MODEL_ROOT;if(!strokeRoot)throw Error('Set PH_STROKE_MODEL_ROOT to the verified TEED export directory');
const strokeModel=path.join(strokeRoot,'teed.onnx');if(crypto.createHash('sha256').update(fs.readFileSync(strokeModel)).digest('hex')!==manifest.bundledAiStrokes?.modelSha256)throw Error('Bundled AI stroke model checksum mismatch');
fs.mkdirSync(path.join(stage,'models/strokes'),{recursive:true});for(const file of ['teed.onnx','teed.json','LICENSE.txt','README.md'])fs.copyFileSync(path.join(strokeRoot,file),path.join(stage,'models/strokes',file));
fs.copyFileSync(path.join(root,'docs/新手安装与升级教程.md'),path.join(stage,'安装与升级教程.md'));
fs.copyFileSync(path.join(root,'docs/FEATURES.md'),path.join(stage,'功能与适用版本.md'));
fs.copyFileSync(path.join(root,'CHANGELOG.md'),path.join(stage,'更新记录.md'));
console.log('Staged AnkerMake PhotoHub 0.8.7 Public Beta');
