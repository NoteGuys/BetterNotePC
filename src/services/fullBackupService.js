import {runForegroundJob} from './foregroundJobs.js';
const prepareFullBackupBlobImpl =async()=>{
 const {default:BackupWorker}=await import('./fullBackup.worker.js?worker&inline');const worker=new BackupWorker();
 return new Promise((resolve,reject)=>{
  const finish=(error,blob)=>{clearTimeout(timer);worker.terminate();error?reject(Error(error)):resolve(blob);};
  const timer=setTimeout(()=>finish('backup-export-timeout'),180000);
  worker.onmessage=({data})=>finish(data.error,data.blob);worker.onerror=()=>finish('backup-export-failed');worker.onmessageerror=worker.onerror;
  worker.postMessage({action:'export'});
 });
};


export const prepareFullBackupBlob=(...args)=>runForegroundJob(()=>prepareFullBackupBlobImpl(...args));
