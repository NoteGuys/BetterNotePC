// Bundle the actual offline workers for isolated browser tests.
const fs = require('node:fs'), path = require('node:path'), esbuild = require('esbuild');
exports.setupRecoveryWorker = build => {
  exports.setupPdfAssets(build);
  build.onResolve({ filter: /(?:backup(?:Recovery|Preparation)|editorPages|bnote|pdfRaster)\.worker\.js\?worker&inline$/ }, args => ({ path: args.path.includes('bnote.worker') ? 'bnote' : args.path.includes('pdfRaster') ? 'pdfRaster' : args.path.includes('editorPages') ? 'editorPages' : args.path.includes('backupPreparation') ? 'backupPreparation' : 'backupRecovery', namespace: 'qa-recovery-worker' }));
  build.onLoad({ filter: /.*/, namespace: 'qa-recovery-worker' }, async args => {
    const root = path.resolve(__dirname, '../..');
    if (process.env.BETTERNOTE_QA_BUILT_WORKER === '1') {
      const assets = path.join(root, 'dist/assets');
      const files = fs.readdirSync(assets).filter(name => name.startsWith(args.path + '.worker-') && name.endsWith('.js'));
      if (files.length !== 1) throw Error('Build the inline worker before browser QA.');
      return { contents: fs.readFileSync(path.join(assets, files[0]), 'utf8'), loader: 'js' };
    }
    const bundled = await esbuild.build({ entryPoints: [path.join(root, 'src/services/' + args.path + '.worker.js')],
      bundle: true, write: false, format: 'iife', platform: 'browser', logLevel: 'silent', plugins:[{name:'offline-pdf-assets',setup:exports.setupPdfAssets}] });
    return { contents: 'const source=' + JSON.stringify(bundled.outputFiles[0].text) + ';export default function(){const url=URL.createObjectURL(new Blob([source],{type:"text/javascript"}));try{return new Worker(url);}finally{URL.revokeObjectURL(url);}}', loader: 'js' };
  });
};
// Playwright JSON bindings do not carry ArrayBuffers. Only the test transport uses Base64.
exports.encodeBinaryCommand = async command => {
  const result = {...command};
  for (const key of ['notebookEncoded','pdfBytes']) if (result[key] instanceof ArrayBuffer) {
    result[key] = {qaBase64:await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(new Blob([result[key]]));})};
  }
  return result;
};
exports.decodeBinaryCommand = command => {
  for (const key of ['notebookEncoded','pdfBytes']) if (command[key]?.qaBase64) {
    const bytes=Buffer.from(command[key].qaBase64,'base64');command[key]=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  }
  return command;
};

exports.setupPdfAssets = build => {
  build.onLoad({filter:/[\\/]utils[\\/]pdfAssetUrls\.js$/}, args=>{
    let contents=fs.readFileSync(args.path,'utf8');
    for(const [kind,variable]of [['standard_fonts','fontUrls'],['cmaps','cmapUrls']]){
      const dir=path.resolve(__dirname,'../../node_modules/pdfjs-dist',kind),map={};
      for(const filename of fs.readdirSync(dir))if(/\.(pfb|ttf|bcmap)$/.test(filename)){
        let url=require('node:url').pathToFileURL(path.join(dir,filename)).href;
        if(process.env.BETTERNOTE_QA_REAL_PDF_ASSETS==='1'){
          const assets=path.resolve(__dirname,'../../dist/assets'),stem=path.parse(filename).name,ext=path.extname(filename);
          const built=fs.readdirSync(assets).find(n=>n.startsWith(stem+'-')&&n.endsWith(ext));
          if(built)url=require('node:url').pathToFileURL(path.join(assets,built)).href;
          else {
            url='data:application/octet-stream;base64,'+fs.readFileSync(path.join(dir,filename)).toString('base64');
            const scripts=fs.readdirSync(assets).filter(n=>n.endsWith('.js'));
            if(!scripts.some(n=>fs.readFileSync(path.join(assets,n),'utf8').includes(url)))throw Error('Bundled PDF asset is missing: '+filename);
          }
        }
        map['../../node_modules/pdfjs-dist/'+kind+'/'+filename]=url;
      }
      contents=contents.replace(new RegExp('(?:export )?const '+variable+' = import\\.meta\\.glob\\([^;]+;'),'export const '+variable+' = '+JSON.stringify(map)+';');
    }
    return{contents,loader:'js',resolveDir:path.dirname(args.path)};
  });
  build.onResolve({filter:/pdf\.worker\.min\.mjs\?url$/},()=>({path:'pdf-worker-url',namespace:'qa-pdf-url'}));
  build.onLoad({filter:/.*/,namespace:'qa-pdf-url'},()=>({contents:'export default '+JSON.stringify(require('node:url').pathToFileURL(process.env.BETTERNOTE_QA_HARDENED === '1' ? path.resolve(__dirname,'../../dist/assets',fs.readdirSync(path.resolve(__dirname,'../../dist/assets')).find(n=>n.startsWith('pdf.worker.min-')&&n.endsWith('.mjs'))) : path.resolve(__dirname,'../../node_modules/pdfjs-dist/build/pdf.worker.min.mjs')).href),loader:'js'}));
};
