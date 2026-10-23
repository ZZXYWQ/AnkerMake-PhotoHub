const fs=require('fs'),path=require('path');
fs.writeFileSync(path.join(__dirname,'../payload/raster-tools.js'),['core.js','document.js','native-replace.js','editor.js','layer-controls.js'].map(f=>fs.readFileSync(path.join(__dirname,f),'utf8')).join('\n'));
