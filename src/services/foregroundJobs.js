// A single lane for memory-heavy work. Queued foreground work immediately
// pauses optional PDF backup; pen input and local saves never enter this lane.
let foreground=0,tail=Promise.resolve();
export const hasForegroundJobs=()=>foreground>0;
const enqueue=work=>{const job=tail.then(work);tail=job.catch(()=>{});return job;};
export const runForegroundJob=work=>{
 foreground++;
 return Promise.resolve().then(work).finally(()=>{foreground--;});
};
// Priority scopes remain nestable. Only entry points acquire the heavy lane.
export const runHeavyJob=work=>runForegroundJob(()=>enqueue(work));
export const runDataJob=enqueue;
export const runBackgroundJob=work=>{
 if(hasForegroundJobs())return Promise.reject(Error('pdf-backup-deferred'));
 return enqueue(()=>{if(hasForegroundJobs())throw Error('pdf-backup-deferred');return work();});
};
