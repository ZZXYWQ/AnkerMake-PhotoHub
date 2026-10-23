/* AnkerMake PhotoHub 0.6.1 Public Beta; production payload only. */
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),stage=path.join(root,'dist/release-payload-0.6.1');
fs.mkdirSync(stage,{recursive:true});
for(const file of fs.readdirSync(path.join(root,'payload'))){if(file.endsWith('.js'))fs.copyFileSync(path.join(root,'payload',file),path.join(stage,file));}
fs.copyFileSync(path.join(root,'dist/EufyPhotoCraftBridge.exe'),path.join(stage,'bridge.exe'));
fs.mkdirSync(path.join(stage,'native'),{recursive:true});
for(const [source,dest]of [['native/bin/PhotoHubInk.dll','native/PhotoHubInk.dll'],['native/vendor/minhook-1.3.4/LICENSE.txt','native/MinHook-LICENSE.txt'],['native/PROVENANCE.txt','native/PROVENANCE.txt'],['native/使用说明.txt','使用说明.txt'],['THIRD-PARTY-NOTICES.txt','THIRD-PARTY-NOTICES.txt'],['LICENSE','LICENSE']])fs.copyFileSync(path.join(root,source),path.join(stage,dest));
fs.cpSync(path.join(root,'licenses'),path.join(stage,'licenses'),{recursive:true});
fs.copyFileSync(path.join(root,'docs/新手安装与升级教程.md'),path.join(stage,'安装与升级教程.md'));
fs.copyFileSync(path.join(root,'CHANGELOG.md'),path.join(stage,'更新记录.md'));
console.log('Staged AnkerMake PhotoHub 0.6.1 Public Beta');
