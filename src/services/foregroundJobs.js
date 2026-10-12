// Explicit export/capture has priority over optional PDF backup rasterization.
let active=0;
export const hasForegroundJobs=()=>active>0;
export const runForegroundJob=async work=>{active++;try{return await work();}finally{active--;}};

