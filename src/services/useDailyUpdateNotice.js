import {useEffect,useRef,useState,useCallback} from 'react';
import {checkForStoreUpdate} from './updateService.js';
import {localUpdateDay} from './updateCore.js';
export const UPDATE_NOTICE_KEY='betternote_update_notice_v2';
export function useDailyUpdateNotice(homeVisible,{check=checkForStoreUpdate,startupMs=15000,now=Date.now,storage=window.localStorage}={}){
 const [notice,setNotice]=useState(null),pendingNotice=useRef(null),enabled=useRef(homeVisible),release=useRef(()=>{});
 enabled.current=homeVisible;
 useEffect(()=>{
  let live=true,timer=null,busy=false,initial=true;
  const safe=()=>!document.hidden && !window.__bn_pen_active && !window.__bn_drag_active;
  const read=()=>{try{return storage.getItem(UPDATE_NOTICE_KEY);}catch(_){return null;}};
  const present=()=>{
   const value=pendingNotice.current;if(!live || !value || !enabled.current || !safe())return;
   const signature=JSON.stringify({day:localUpdateDay(now()),version:value.currentVersion});
   if(read()===signature){pendingNotice.current=null;return;}
   try{storage.setItem(UPDATE_NOTICE_KEY,signature);}catch(_){}
   pendingNotice.current=null;setNotice(value);
  };
  const scheduleNext=()=>{const next=new Date(now());next.setHours(24,0,0,0);timer=setTimeout(run,Math.max(1000,next.getTime()-now()+15000));};
  const run=async()=>{
   if(!live || busy)return;
   if(!safe()){clearTimeout(timer);timer=setTimeout(run,5000);return;}
   busy=true;initial=false;
   try{const result=await check();if(live){pendingNotice.current=result?.status==='available' && result.hasUpdate ? result : null;present();}}
   catch(_){}finally{busy=false;if(live)scheduleNext();}
  };
  const wake=()=>{if(!live || initial || !safe())return;present();clearTimeout(timer);run();};
  release.current=present;timer=setTimeout(run,startupMs);
  document.addEventListener('visibilitychange',wake);window.addEventListener('focus',wake);
  return()=>{live=false;clearTimeout(timer);pendingNotice.current=null;release.current=()=>{};document.removeEventListener('visibilitychange',wake);window.removeEventListener('focus',wake);};
 },[check,startupMs,now,storage]);
 useEffect(()=>{if(homeVisible)release.current();},[homeVisible]);
 const dismiss=useCallback(()=>setNotice(null),[]);
 return{notice,dismiss};
}
