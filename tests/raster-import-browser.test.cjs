/* Optional real-file regression: node tests/raster-import-browser.test.cjs FILE WIDTH HEIGHT */
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto'),assert=require('node:assert/strict');
(async()=>{
 const file=process.argv[2];if(!file)throw Error('Supply a local PNG/JPEG/WebP fixture; no files are downloaded');
 const source=fs.readFileSync(file),expected=crypto.createHash('sha256').update(source).digest('hex');
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<input type="file">');});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser,backend,port=server.address().port;
 try{
  if(process.argv.includes('--backend')){
   const {spawn}=require('child_process');
   backend=spawn(process.env.PYTHON||'python',[path.join(__dirname,'raster_import_server.py')],{windowsHide:true,env:process.env,stdio:['ignore','pipe','inherit']});
   port=await new Promise((resolve,reject)=>{backend.once('error',reject);backend.once('exit',code=>reject(Error('Fixture exited '+code)));backend.stdout.once('data',chunk=>resolve(Number(String(chunk).trim())));});
  }
  browser=await chromium.launch({headless:true});const page=await browser.newPage();
  await page.goto('http://127.0.0.1:'+port);
  await page.addScriptTag({path:path.resolve(__dirname,'../raster-src/import.js')});
  await page.locator('input').setInputFiles(file);
  const result=await page.evaluate(async backend=>{
   const create=document.createElement.bind(document);document.createElement=(name,...args)=>{if(name.toLowerCase()==='canvas')throw Error('Import tried to re-encode through canvas');return create(name,...args);};
   const p=await EPCImageImport.prepare(document.querySelector('input').files[0],backend?async(path,body)=>{const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw Error(await r.text());return r.json();}:undefined);
   if(!p.singleObject||p.tiles)throw Error('Import returned multiple objects');
   const raw=await(await fetch(p.dataUrl)).arrayBuffer();
   const sha256=[...new Uint8Array(await crypto.subtle.digest('SHA-256',raw))].map(b=>b.toString(16).padStart(2,'0')).join('');
   return {width:p.width,height:p.height,bytes:raw.byteLength,sha256,singleObject:true,orientationNormalized:!!p.orientationNormalized,noCanvas:true};
  },process.argv.includes('--backend'));
  if(!result.orientationNormalized){assert.equal(result.sha256,expected);assert.equal(result.bytes,source.length);}
  if(process.argv[3])assert.equal(result.width,Number(process.argv[3]));
  if(process.argv[4])assert.equal(result.height,Number(process.argv[4]));
  console.log(JSON.stringify({pass:true,...result}));
 }finally{if(browser)await browser.close();if(backend)backend.kill();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
