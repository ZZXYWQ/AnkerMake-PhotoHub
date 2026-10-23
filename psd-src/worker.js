import {readPsd,initializeCanvas} from 'ag-psd';
initializeCanvas((w,h)=>new OffscreenCanvas(w,h),(w,h)=>new ImageData(w,h));
self.onmessage=({data:buffer})=>{
 try{
  const header=new DataView(buffer);
  if(buffer.byteLength<26||header.getUint32(0)!==0x38425053||header.getUint16(4)!==1)throw Error('请选择标准 PSD 文件（暂不支持 PSB）。');
  if(header.getUint16(22)!==8||![1,3].includes(header.getUint16(24)))throw Error('目前支持 8 位 RGB / 灰度 PSD；请在 Photoshop 中转换后保存。');
  const height=header.getUint32(14),width=header.getUint32(18);
  if(!width||!height||width*height>100000000)throw Error('此 PSD 超过当前分层解析的内存预算（1 亿像素）。');
  const psd=readPsd(buffer,{useImageData:true,skipCompositeImageData:true,skipThumbnail:true,throwForMissingFeatures:false});
  const layers=[],unsupported=[],skipped=[];
  function visit(nodes,parentHidden=false,prefix=''){
   for(const l of [...(nodes||[])].reverse()){
    const name=prefix+(l.name||'未命名图层'),hidden=parentHidden||!!l.hidden;
    if(l.clipping||l.adjustment||l.effects||l.vectorMask||l.vectorStroke||l.vectorFill||l.filterEffects||l.blendMode&&!['normal','pass through'].includes(l.blendMode))unsupported.push(name+'：混合模式、剪贴、矢量或图层效果需先栅格化');
    if(l.children){if((l.opacity??1)!==1||l.mask)unsupported.push(name+'：组透明度或组蒙版需先合并');visit(l.children,hidden,name+' / ');continue;}
    const d=l.imageData;
    if(!d?.width||!d?.height){if(l.text||l.placedLayer)unsupported.push(name+'：缺少已渲染像素');else skipped.push(name);continue;}
    if(!(d.data instanceof Uint8ClampedArray||d.data instanceof Uint8Array))throw Error('不支持此图层的像素精度');
    const pixels=new Uint8ClampedArray(d.data),left=l.left||0,top=l.top||0;
    const m=l.mask;
    if(m&&!m.disabled){
     if(!m.imageData||m.positionRelativeToLayer||m.userMaskDensity!==undefined||m.userMaskFeather!==undefined)unsupported.push(name+'：此蒙版需先应用');
     else{
      const md=m.imageData,ml=m.left||0,mt=m.top||0,bg=m.defaultColor??255;
      for(let y=0;y<d.height;y++)for(let x=0;x<d.width;x++){
       const mx=left+x-ml,my=top+y-mt,v=mx>=0&&my>=0&&mx<md.width&&my<md.height?md.data[(my*md.width+mx)*4]:bg;
       pixels[(y*d.width+x)*4+3]=Math.round(pixels[(y*d.width+x)*4+3]*v/255);
      }
     }
    }
    const fill=l.fillOpacity??1;
    layers.push({name,left,top,width:d.width,height:d.height,opacity:(l.opacity??1)*fill,visible:!hidden,pixels});
   }
  }
  visit(psd.children);
  if(unsupported.length)throw Error('以下图层无法保证分层外观，请先在 Photoshop 栅格化 / 应用效果：\n'+[...new Set(unsupported)].slice(0,12).join('\n'));
  if(!layers.length)throw Error('PSD 中没有可导入的像素图层。');
  if(layers.length>300)throw Error('图层超过 300 个，请分批导入。');
  postMessage({width:psd.width,height:psd.height,layers,skipped},layers.map(l=>l.pixels.buffer));
 }catch(e){postMessage({error:e.message||String(e)});}
};
