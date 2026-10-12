import {performanceMetrics} from '../utils/performanceMetrics.js';
export const startPerformanceMonitor=()=>{
 if(!window.electronAPI?.recordPerformance)return()=>{};
 let observer;
 try{observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())performanceMetrics.record('long-task',entry.duration);});observer.observe({type:'longtask',buffered:false});}catch(_){}
 const publish=()=>{const items=performanceMetrics.take();if(items.length)window.electronAPI.recordPerformance(items);};
 const timer=setInterval(publish,30000);
 return()=>{clearInterval(timer);observer?.disconnect();publish();};
};

