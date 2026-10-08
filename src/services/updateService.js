import packageInfo from '../../package.json' with { type:'json' };
import { createUpdateChecker, openUpdateDestination, STORE_URL } from './updateCore.js';
export {compareVersions,isNewerVersion,LAST_UPDATE_CHECK_DATE_KEY,STORE_PRODUCT_ID,STORE_URL,STORE_WEB_URL,RELEASES_URL} from './updateCore.js';
export const CURRENT_APP_VERSION = packageInfo.version;
const checker=createUpdateChecker({
  currentVersion:CURRENT_APP_VERSION,
  getStoreUpdate:async()=>window.electronAPI?.checkStoreUpdate?.(),
  storage:typeof window==='undefined'?null:window.localStorage,
  getAppInfo:async()=> window.electronAPI?.getAppInfo ? window.electronAPI.getAppInfo() : {version:CURRENT_APP_VERSION,distribution:'installer'}
});
export const getInstalledAppInfo=async()=>{
 try{const info=await window.electronAPI?.getAppInfo?.();if(info?.version)return info;}catch(_){}
 return{version:CURRENT_APP_VERSION,distribution:'installer'};
};
export const hasCheckedToday=checker.checked;
export const clearCheckDate=checker.clear;
export const checkForStoreUpdate=checker.check;
export const openMicrosoftStore=(target=STORE_URL)=>openUpdateDestination(target||STORE_URL,{
  native:typeof window!=='undefined'&&window.electronAPI?.openExternal?url=>window.electronAPI.openExternal(url):null,
  openWeb:typeof window!=='undefined'?url=>window.open(url,'_blank','noopener,noreferrer'):null
});
