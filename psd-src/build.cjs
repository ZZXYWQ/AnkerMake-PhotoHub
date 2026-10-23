const fs=require('fs'),path=require('path'),esbuild=require('esbuild');
(async()=>{
 const worker=await esbuild.build({entryPoints:[path.join(__dirname,'worker.js')],bundle:true,write:false,format:'iife',platform:'browser',minify:true});
 const code=fs.readFileSync(path.join(__dirname,'importer.js'),'utf8').replace('__WORKER_SOURCE__',()=>JSON.stringify(worker.outputFiles[0].text));
 fs.writeFileSync(path.join(__dirname,'../payload/psd-runtime.inc'),code);
 const adapter=fs.readFileSync(path.join(__dirname,'../payload/adapter.js'),'utf8').split('/* PhotoHub PSD bundled runtime */')[0];
 fs.writeFileSync(path.join(__dirname,'../payload/adapter.js'),adapter+'\n/* PhotoHub PSD bundled runtime */\n'+code+'\n'+['composition-core.js','composition-native.js','composition-ui.js'].map(f=>fs.readFileSync(path.join(__dirname,f),'utf8')).join('\n'));
})();
