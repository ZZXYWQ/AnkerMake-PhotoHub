/* Preserve the supplied raster bytes; import must not require an export canvas. */
(()=>{'use strict';
async function prepare(file,api){
 const bytes=new Uint8Array(await file.slice(0,12).arrayBuffer());
 const mime=bytes[0]===0x89&&bytes[1]===0x50&&bytes[2]===0x4e&&bytes[3]===0x47?'image/png':bytes[0]===0xff&&bytes[1]===0xd8?'image/jpeg':String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&String.fromCharCode(...bytes.slice(8,12))==='WEBP'?'image/webp':null;
 if(!mime)throw Error('请选择 PNG、JPEG 或 WebP 图片；文件未修改');
 const blob=new Blob([file],{type:mime}),url=URL.createObjectURL(blob);
 try{
  const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('原始图片读取失败'));reader.readAsDataURL(blob);});
  if(typeof dataUrl!=='string'||!dataUrl.startsWith('data:'+mime+';base64,'))throw Error('原始图片读取失败；未缩小图片');
  const fileName=file.name||'PhotoHub.'+({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[mime]);
  if(api)return api('/raster/prepare',{dataUrl,fileName});
  const image=new Image();image.src=url;await image.decode();
  const width=image.naturalWidth,height=image.naturalHeight;
  if(!width||!height)throw Error('原图尺寸无效');
  return {dataUrl,width,height,fileName,singleObject:true};
 }finally{URL.revokeObjectURL(url);}
}
window.EPCImageImport={prepare};
})();
