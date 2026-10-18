import {runHeavyJob} from './foregroundJobs.js';
const prepareFullBackupBlobImpl =async()=>{
 const {default:BackupWorker}=await import('./fullBackup.worker.js?worker&inline');const worker=new BackupWorker();
 return new Promise((resolve,reject)=>{
  let settled=false;
  const finish=(error,blob)=>{if(settled)return;settled=true;clearTimeout(timer);worker.onmessage=worker.onerror=worker.onmessageerror=null;worker.terminate();error?reject(Error(error)):resolve(blob);};
  const timer=setTimeout(()=>finish('backup-export-timeout'),180000);
  worker.onmessage=({data})=>finish(data.error,data.blob);worker.onerror=()=>finish('backup-export-failed');worker.onmessageerror=worker.onerror;
  try{worker.postMessage({action:'export'});}catch(_){finish('backup-export-failed');}
 });
};


export const prepareFullBackupBlob=(...args)=>runHeavyJob(()=>prepareFullBackupBlobImpl(...args));
