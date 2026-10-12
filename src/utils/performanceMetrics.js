// Numeric summaries only: no samples containing ink, notebook identities or filenames.
export const createPerformanceMetrics=(limit=256)=>{
 const buckets=new Map();
 return {record(category,duration){if(!['ink','save','long-task','frame'].includes(category)||!Number.isFinite(duration)||duration<0)return;let b=buckets.get(category);if(!b){b={values:[],count:0,max:0,index:0};buckets.set(category,b);}b.count++;b.max=Math.max(b.max,duration);b.values[b.index++%limit]=duration;},
 take(){const result=[];for(const [category,b]of buckets){const a=b.values.slice().sort((x,y)=>x-y);const q=p=>a[Math.max(0,Math.ceil(a.length*p)-1)]||0;result.push({event:'performance',category,count:b.count,p50:q(.5),p95:q(.95),p99:q(.99),max:b.max});}buckets.clear();return result;}};
};
export const performanceMetrics=createPerformanceMetrics();

