export const LAST_UPDATE_CHECK_DATE_KEY = 'betternote_last_update_check_date';
export const STORE_PRODUCT_ID = '9N9NH9GHFV8J';
export const STORE_URL = 'ms-windows-store://pdp/?productid=' + STORE_PRODUCT_ID;
export const STORE_WEB_URL = 'https://apps.microsoft.com/detail/' + STORE_PRODUCT_ID;
export const RELEASES_URL = 'https://github.com/NoteGuys/BetterNotePC/releases';
export const UPDATE_FEED_URL = 'https://raw.githubusercontent.com/NoteGuys/BetterNotePC/main/release-info.json';
const MAX_FEED_BYTES = 65536;
const versionParts = value => {
  if (typeof value !== 'string' || value.length > 128 || !/^v?(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(value)) return null;
  const [core,pre] = value.replace(/^v/,'').split('+')[0].split(/-(.*)/s);
  if(pre?.split('.').some(id=>/^0\d+$/.test(id)))return null;
  const numbers=core.split('.').map(Number);
  return numbers.every(Number.isSafeInteger)?{numbers,pre:pre?.split('.')}:null;
};
export function compareVersions(a,b) {
  const x=versionParts(a),y=versionParts(b);if(!x||!y)return 0;
  for(let i=0;i<3;i++)if(x.numbers[i]!==y.numbers[i])return x.numbers[i]>y.numbers[i]?1:-1;
  if(!x.pre&&!y.pre)return 0;if(!x.pre)return 1;if(!y.pre)return -1;
  for(let i=0;i<Math.max(x.pre.length,y.pre.length);i++){
    const p=x.pre[i],q=y.pre[i];if(p===q)continue;if(p===undefined)return -1;if(q===undefined)return 1;
    const pn=/^\d+$/.test(p),qn=/^\d+$/.test(q);
    if(pn&&qn)return BigInt(p)>BigInt(q)?1:-1;if(pn!==qn)return pn?-1:1;return p>q?1:-1;
  }
  return 0;
}
export const isNewerVersion=(current,target)=>compareVersions(target,current)>0;
const text=(value,max=500)=>typeof value==='string'&&value.length<=max?value:'';
const textList=value=>Array.isArray(value)&&value.length<=50&&value.every(v=>typeof v==='string'&&v.length<=1000)?value:[];
const day=now=>new Date(now()).toLocaleDateString('en-CA');
export function createUpdateChecker({currentVersion,fetchImpl=(...args)=>fetch(...args),storage,now=Date.now,timeoutMs=4000,getAppInfo=async()=>({version:currentVersion,distribution:'installer'})}){
  let pending,lastAttempt=0,lastSuccess=null;
  const checked=()=>{try{return storage?.getItem(LAST_UPDATE_CHECK_DATE_KEY)===day(now);}catch(_){return false;}};
  const clear=()=>{try{storage?.removeItem(LAST_UPDATE_CHECK_DATE_KEY);}catch(_){}lastSuccess=null;lastAttempt=0;};
  const check=(options={})=>{
    if(pending)return pending;
    if(!options.force && (checked()||lastAttempt && now()-lastAttempt<300000))return Promise.resolve({
      ...(lastSuccess||{hasUpdate:false,status:'unavailable',currentVersion}),throttled:true});
    lastAttempt=now();
    pending=(async()=>{
      let timer;const controller=new AbortController();
      try{
        const work=(async()=>{
          const info=await getAppInfo();
          const version=versionParts(info?.version)?info.version:currentVersion;
          if(info?.distribution==='store')return{hasUpdate:false,status:'store-managed',currentVersion:version,distribution:'store',updateUrl:STORE_URL};
          const res=await fetchImpl(UPDATE_FEED_URL,{signal:controller.signal,cache:'no-cache',credentials:'omit',redirect:'error',headers:{Accept:'application/json'}});
          if(!res.ok)throw Object.assign(Error('unavailable'),{reason:res.status===404?'feed-not-configured':'unavailable'});
          if(Number(res.headers?.get('content-length'))>MAX_FEED_BYTES)throw Error('invalid-feed');
          let body='';
          if(res.body?.getReader){
            const reader=res.body.getReader(),decoder=new TextDecoder();let size=0;
            try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>MAX_FEED_BYTES)throw Error('invalid-feed');body+=decoder.decode(part.value,{stream:true});}body+=decoder.decode();}
            finally{reader.cancel().catch(()=>{});}
          }else {body=await res.text();if(new TextEncoder().encode(body).length>MAX_FEED_BYTES)throw Error('invalid-feed');}
          const data=JSON.parse(body),latest=data?.version||data?.latestVersion;
          if(!versionParts(latest))throw Error('invalid-feed');
          const hasUpdate=isNewerVersion(version,latest),distribution=info?.distribution==='store'?'store':'installer';
          return {hasUpdate,status:hasUpdate?'available':'current',currentVersion:version,latestVersion:latest,distribution,
            title:text(data.title),releaseDate:text(data.releaseDate,40),bugFixes:textList(data.bugFixes),features:textList(data.features),
            storeUrl:STORE_URL,storeWebUrl:STORE_WEB_URL,updateUrl:distribution==='store'?STORE_URL:RELEASES_URL};
        })();
        const result=await Promise.race([work,new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('timeout'));},timeoutMs);})]);
        lastSuccess=result;try{storage?.setItem(LAST_UPDATE_CHECK_DATE_KEY,day(now));}catch(_){}
        return result;
      }catch(error){return {hasUpdate:false,status:'unavailable',reason:error.reason||'unavailable',currentVersion};}
      finally{clearTimeout(timer);}
    })().finally(()=>{pending=null;});
    return pending;
  };
  return {check,checked,clear};
}
export async function openUpdateDestination(target,{native,openWeb}={}){
  if(![STORE_URL,STORE_WEB_URL,RELEASES_URL].includes(target))return false;
  const open=async url=>{
    try{if(native)return (await native(url))?.success===true;return Boolean(openWeb?.(url));}catch(_){return false;}
  };
  if(await open(target))return true;
  return target===STORE_URL?open(STORE_WEB_URL):false;
}
