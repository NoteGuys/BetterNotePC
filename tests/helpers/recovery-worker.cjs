// Bundle the actual offline workers for isolated browser tests.
const fs = require('node:fs'), path = require('node:path'), esbuild = require('esbuild');
exports.setupRecoveryWorker = build => {
  build.onResolve({ filter: /backup(?:Recovery|Preparation)\.worker\.js\?worker&inline$/ }, args => ({ path: args.path.includes('backupPreparation') ? 'backupPreparation' : 'backupRecovery', namespace: 'qa-recovery-worker' }));
  build.onLoad({ filter: /.*/, namespace: 'qa-recovery-worker' }, async args => {
    const root = path.resolve(__dirname, '../..');
    if (process.env.BETTERNOTE_QA_BUILT_WORKER === '1') {
      const assets = path.join(root, 'dist/assets');
      const files = fs.readdirSync(assets).filter(name => name.startsWith(args.path + '.worker-') && name.endsWith('.js'));
      if (files.length !== 1) throw Error('Build the inline worker before browser QA.');
      return { contents: fs.readFileSync(path.join(assets, files[0]), 'utf8'), loader: 'js' };
    }
    const bundled = await esbuild.build({ entryPoints: [path.join(root, 'src/services/' + args.path + '.worker.js')],
      bundle: true, write: false, format: 'iife', platform: 'browser', logLevel: 'silent' });
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
