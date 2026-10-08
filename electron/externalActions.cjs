const fs = require('node:fs/promises');
const { validPath } = require('./appSecurity.cjs');
const STORE_URI = 'ms-windows-store://pdp/?productid=9N9NH9GHFV8J';
const ALLOWED_HOSTS = new Set(['www.google.com','ipv4.google.com','drive.google.com','accounts.google.com','apps.microsoft.com','github.com']);
const validExternalUrl = value => {
  if (value === STORE_URI) return true;
  try {
    const url = new URL(value);
    return typeof value === 'string' && value.length <= 4096 && url.protocol === 'https:' &&
      !url.username && !url.password && !url.port && ALLOWED_HOSTS.has(url.hostname);
  } catch (_) { return false; }
};
function createExternalActions({shell,fileSystem=fs,timeoutMs=8000}) {
  const pending = new Map();
  const run = (key,work) => {
    if (pending.has(key)) return pending.get(key);
    let timer;
    const job=Promise.resolve().then(work).catch(()=>({success:false,reason:'open-failed'}));
    const result=Promise.race([job,new Promise(resolve=>{
      timer=setTimeout(()=>resolve({success:false,reason:'open-timeout'}),timeoutMs);
    })]).finally(()=>clearTimeout(timer));
    pending.set(key,result);
    // Retain the lock until the underlying OS action finishes, even after timeout.
    job.finally(()=>pending.delete(key));
    return result;
  };
  return {
    openExternal(value) {
      if (!validExternalUrl(value)) return Promise.resolve({success:false,reason:'invalid-url'});
      return run('url:'+value,async()=>{await shell.openExternal(value);return {success:true};});
    },
    openFolder(value) {
      if (!value || !validPath(value)) return Promise.resolve({success:false,reason:'invalid-path'});
      return run('folder:'+value,async()=>{
        const stat=await fileSystem.stat(value).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
        if (stat && !stat.isDirectory()) return {success:false,reason:'not-a-folder'};
        if (!stat) await fileSystem.mkdir(value,{recursive:true});
        const error=await shell.openPath(value);
        return error?{success:false,reason:'open-failed'}:{success:true};
      });
    },
    revealFile(value) {
      if (!value || !validPath(value)) return Promise.resolve({success:false,reason:'invalid-path'});
      return run('file:'+value,async()=>{
        const stat=await fileSystem.stat(value);
        if (!stat.isFile()) return {success:false,reason:'file-not-found'};
        shell.showItemInFolder(value);return {success:true};
      });
    }
  };
}
module.exports={STORE_URI,validExternalUrl,createExternalActions};
