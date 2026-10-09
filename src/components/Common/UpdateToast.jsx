import React,{useEffect} from 'react';
import {Download} from 'lucide-react';
import {useLanguage} from '../../services/i18n';
const style={position:'fixed',right:24,bottom:24,zIndex:1500,display:'flex',alignItems:'center',gap:12,width:'max-content',maxWidth:'min(360px, calc(100vw - 32px))',padding:'14px 18px',border:'1px solid rgba(96,165,250,.4)',borderRadius:12,background:'#172338',color:'#eaf3ff',boxShadow:'0 6px 24px rgba(0,0,0,.25)',pointerEvents:'none'};
export function UpdateToast({notice,visible,onDismiss}){
 const {t}=useLanguage();
 useEffect(()=>{if(!notice)return;const timer=setTimeout(onDismiss,5000);return()=>clearTimeout(timer);},[notice,onDismiss]);
 if(!notice || !visible)return null;
 return <div className="bn-update-toast" style={style} role="status" aria-live="polite" aria-atomic="true">
  <Download size={20} aria-hidden="true" style={{flexShrink:0,color:'#60a5fa'}}/><div><strong style={{display:'block',fontSize:13,lineHeight:1.5}}>{t('updateToastAvailable')}</strong><small style={{display:'block',marginTop:3,color:'#bed0e7',fontSize:11,lineHeight:1.5}}>{t('updateToastSettings')}</small></div>
 </div>;
}
