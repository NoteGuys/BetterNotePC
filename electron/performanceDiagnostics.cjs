const fs = require('node:fs/promises');
const path = require('node:path');
const EVENTS = new Set(['startup','resources','renderer-gone','child-gone','unresponsive','responsive','renderer-error','performance','operation','gpu-info']);
const REASONS = new Set(['clean-exit','abnormal-exit','killed','crashed','oom','launch-failed','integrity-failure']);
const CATEGORIES = new Set(['ink','save','long-task','frame']);
const finite = (n,max=1e9) => Number.isFinite(n) && n >= 0 ? Math.min(max,n) : undefined;
function sanitizeEvent(input) {
  if (!EVENTS.has(input?.event)) return null;
  const value = {event:input.event};
  if(['backup','restore','pdf','clipboard','image'].includes(input.operation))value.operation=input.operation;
  if(['start','finish','failed'].includes(input.phase))value.phase=input.phase;
  if (REASONS.has(input.reason)) value.reason=input.reason;
  if (['GPU','Utility','Renderer','Browser','Zygote','Sandbox helper','Pepper Plugin'].includes(input.type)) value.type=input.type;
  if (Number.isInteger(input.exitCode)) value.exitCode=input.exitCode;
  if (['legacy','default'].includes(input.gpuProfile)) value.gpuProfile=input.gpuProfile;
  if (['application','renderer','worker'].includes(input.scope)) value.scope=input.scope;
  for (const key of ['workingSetKiB','peakWorkingSetKiB','privateKiB','cpuPercent','processCount','vendorId','deviceId']) {
    const n=finite(input[key]);if(n!==undefined)value[key]=n;
  }
  if(typeof input.driverVersion==='string'&&/^[0-9.]{1,32}$/.test(input.driverVersion))value.driverVersion=input.driverVersion;
  if (CATEGORIES.has(input.category)) {
    value.category=input.category;
    for (const key of ['count','p50','p95','p99','max']) {const n=finite(input[key],1e7);if(n!==undefined)value[key]=n;}
  }
  if(input.gpu && typeof input.gpu==='object') {
    value.gpu={};for(const key of ['gpu_compositing','rasterization','canvas_oop_rasterization','opengl']) {
      if(['enabled','enabled_on','disabled_off_ok','disabled_software','unavailable_software','disabled_off','unavailable_off','enabled_force','disabled','unavailable'].includes(input.gpu[key]))value.gpu[key]=input.gpu[key];
    }
  }
  return value;
}
function createDiagnosticLog({directory,version,runtime,maxBytes=256*1024}) {
  const file=path.join(directory,'performance.jsonl'),previous=file+'.previous';
  let queue=Promise.resolve(),queued=0;
  const record = data => {
    const clean=sanitizeEvent(data);if(!clean||queued>=32)return;
    queued++;
    queue=queue.catch(()=>{}).then(async()=>{
      try {
        await fs.mkdir(directory,{recursive:true});
        const line=JSON.stringify({time:new Date().toISOString(),version,runtime,...clean})+'\n';
        let size=0;try{size=(await fs.stat(file)).size;}catch(_){}
        if(size+Buffer.byteLength(line)>maxBytes){await fs.rename(file,previous).catch(async()=>{await fs.unlink(previous).catch(()=>{});await fs.rename(file,previous);});}
        await fs.appendFile(file,line,'utf8');
      }finally{queued--;}
    }).catch(()=>{});
  };
  const exportReport=async destination=>{await queue;const chunks=[];for(const item of [previous,file]){try{const info=await fs.stat(item);if(info.size<=maxBytes)chunks.push(await fs.readFile(item,'utf8'));}catch(_){}}await fs.writeFile(destination,chunks.join(''),'utf8');};
  return {record,exportReport,flush:()=>queue};
}
module.exports={sanitizeEvent,createDiagnosticLog};


