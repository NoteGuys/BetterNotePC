// Bundle the actual offline recovery worker for isolated browser tests.
const fs = require('node:fs'), path = require('node:path'), esbuild = require('esbuild');
exports.setupRecoveryWorker = build => {
  build.onResolve({ filter: /backupRecovery\.worker\.js\?worker&inline$/ }, () => ({ path: 'recovery-worker', namespace: 'qa-recovery-worker' }));
  build.onLoad({ filter: /.*/, namespace: 'qa-recovery-worker' }, async () => {
    const root = path.resolve(__dirname, '../..');
    if (process.env.BETTERNOTE_QA_BUILT_WORKER === '1') {
      const assets = path.join(root, 'dist/assets');
      const files = fs.readdirSync(assets).filter(name => /^backupRecovery\.worker-.*\.js$/.test(name));
      if (files.length !== 1) throw Error('Build the inline recovery worker before browser QA.');
      return { contents: fs.readFileSync(path.join(assets, files[0]), 'utf8'), loader: 'js' };
    }
    const bundled = await esbuild.build({ entryPoints: [path.join(root, 'src/services/backupRecovery.worker.js')],
      bundle: true, write: false, format: 'iife', platform: 'browser', logLevel: 'silent' });
    return { contents: 'const source=' + JSON.stringify(bundled.outputFiles[0].text) + ';export default function(){const url=URL.createObjectURL(new Blob([source],{type:"text/javascript"}));try{return new Worker(url);}finally{URL.revokeObjectURL(url);}}', loader: 'js' };
  });
};
