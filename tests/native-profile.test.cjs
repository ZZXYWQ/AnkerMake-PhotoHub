/* Parse exact vendor fixtures without executing their bootstrap or printer code. */
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto'),cp=require('child_process'),assert=require('node:assert/strict');
const folder=process.argv[2];if(!folder)throw Error('Supply a directory of verified editor module fixtures');
const scope={URL,window:{EPCComposition:{}}};
const adapter=fs.readFileSync(path.join(__dirname,'../psd-src/composition-native.js'),'utf8').replace('window.EPCComposition.prepare=prepare;','window.EPCComposition.prepare=prepare;window.testProfile={compile,expected};');
vm.runInNewContext(adapter,scope);
for(const [name,hash] of Object.entries(scope.window.testProfile.expected)){
 const raw=fs.readFileSync(path.join(folder,name)),source=raw.toString('utf8');
 assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),hash,name+' exact source');
 const transformed=scope.window.testProfile.compile(name,source,'https://fixture.invalid/editor/assets/'+name);
 const result=cp.spawnSync(process.execPath,['--input-type=module','--check'],{input:transformed,encoding:'utf8',windowsHide:true});
 assert.equal(result.status,0,name+': '+result.stderr);
 assert.notEqual(transformed,source);
 assert.throws(()=>scope.window.testProfile.compile(name,source+source,'https://fixture.invalid/editor/assets/'+name),/校验失败/);
 console.log('PASS exact-profile patches and ESM syntax: '+name);
}
