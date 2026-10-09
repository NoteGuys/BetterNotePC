import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Folder, PenLine, Shapes, Image, Files, Hand, Download, HardDrive, Settings, Search, ArrowLeft, ArrowRight, ChevronRight, X, Maximize2, Menu, Check, Info } from 'lucide-react';
import { useLanguage } from '../../services/i18n';
import { categories, lessons, GUIDE_VERSION, guideText, searchLessons } from './guideContent';
import { figures } from './guideFigures';
import './UserGuide.css';
const icons={BookOpen,Folder,PenLine,Shapes,Image,Files,Hand,Download,HardDrive,Settings};
const asset=name=>`${import.meta.env.BASE_URL}user-guide/${name}`;
const popular=['first-notebook','restore','hold-shape','pdf-export'];
function MarkedImage({figure,language}){
 return <div className="bn-guide-image" style={{width:`min(100%, ${Math.round(figure.width*1.25)}px)`}}><img src={asset(figure.file)} width={figure.width} height={figure.height} alt={figure.alt?.[language]||figure.alt?.en||''} decoding="async" />
  <svg viewBox={`0 0 ${figure.width} ${figure.height}`} aria-hidden="true" preserveAspectRatio="xMidYMid meet">
   {figure.marks.map((mark,i)=><g key={i}>
    {mark.w<75&&mark.w/mark.h>.75&&mark.w/mark.h<1.3?<ellipse cx={mark.x+mark.w/2} cy={mark.y+mark.h/2} rx={mark.w/2+5} ry={mark.h/2+5} fill="none" stroke="#e15c39" strokeWidth="2.5"/>:<rect x={mark.x-5} y={mark.y-5} width={mark.w+10} height={mark.h+10} rx="8" fill="none" stroke="#e15c39" strokeWidth="2.5"/>}
    <circle cx={Math.max(14,mark.x-6)} cy={Math.max(14,mark.y-7)} r="13" fill="#e15c39" stroke="#fff" strokeWidth="2" />
    <text x={Math.max(14,mark.x-6)} y={Math.max(14,mark.y-7)+4.5} textAnchor="middle" fill="white" fontSize="13" fontWeight="700" fontFamily="sans-serif">{i+1}</text>
   </g>)}
  </svg>
 </div>;
}
function Figure({id,language,words}){
 const [expanded,setExpanded]=useState(false),dialog=useRef(null),figure=figures[id];
 useEffect(()=>{if(expanded&&!dialog.current.open)dialog.current.showModal();},[expanded]);
 if(!figure)return null;
 const legend=<ol className="bn-guide-legend">{figure.marks.map((m,i)=><li key={i}><b>{i+1}</b><span>{m.label[language]||m.label.en}</span></li>)}</ol>;
 return <figure className="bn-guide-figure">
  <div className="bn-guide-figure-top"><span>{words.figure}</span><button type="button" onClick={()=>setExpanded(true)}><Maximize2 size={15}/>{words.enlarge}</button></div>
  <button type="button" className="bn-guide-image-button" onClick={()=>setExpanded(true)} aria-label={words.enlarge}><MarkedImage figure={figure} language={language}/></button>
  <figcaption>{legend}<small>{words.screenshot}</small></figcaption>
  {expanded&&<dialog ref={dialog} className="bn-guide-dialog" aria-label={words.enlarge} onClose={()=>setExpanded(false)} onClick={event=>{if(event.target===dialog.current)dialog.current.close();}}>
   <div className="bn-guide-dialog-head"><span>{words.figure}</span><button type="button" autoFocus onClick={()=>dialog.current.close()} aria-label={words.close}><X size={22}/></button></div>
   <div className="bn-guide-dialog-body"><MarkedImage figure={figure} language={language}/>{legend}</div>
  </dialog>}
 </figure>;
}
export default function UserGuide(){
 const {language:appLanguage}=useLanguage();
 const [language,setLanguage]=useState(()=>appLanguage==='th'?'th':'en');
 const words=guideText[language], [category,setCategory]=useState('all'),[query,setQuery]=useState(''),[articleId,setArticleId]=useState(null),[contentsOpen,setContentsOpen]=useState(false);
 const scroll=useRef(null),heading=useRef(null),first=useRef(true);
 const article=lessons.find(item=>item.id===articleId),group=categories.find(item=>item.id===(article?.category||category));
 const filtered=searchLessons(query,category);
 const openArticle=id=>{setArticleId(id);setContentsOpen(false);};
 const home=()=>{setArticleId(null);setCategory('all');setQuery('');setContentsOpen(false);};
 const chooseCategory=id=>{setCategory(id);setArticleId(null);setQuery('');setContentsOpen(false);};
 useEffect(()=>{scroll.current?.scrollTo(0,0);if(first.current){first.current=false;return;}heading.current?.focus({preventScroll:true});},[articleId,category]);
 const related=article?.related.map(id=>lessons.find(item=>item.id===id)).filter(Boolean)||[];
 const siblings=article?lessons.filter(item=>item.category===article.category):[];
 const position=siblings.findIndex(item=>item.id===articleId);
 return <section className="bn-studio-main bn-guide" aria-label={words.title}>
  <header className="bn-guide-header"><button type="button" className="bn-guide-brand" onClick={home}><BookOpen size={21}/><span>{words.title}</span></button>
   <div className="bn-guide-search"><Search size={17}/><input type="search" value={query} placeholder={words.search} aria-label={words.search} onChange={e=>{setQuery(e.target.value);setArticleId(null);setCategory('all');}}/>{query&&<button type="button" onClick={()=>setQuery('')} aria-label={words.clear}><X size={16}/></button>}</div>
   <select value={language} onChange={e=>setLanguage(e.target.value)} aria-label={words.language}><option value="th">ไทย</option><option value="en">English</option></select>
  </header>
  <div className="bn-guide-body">
   <button type="button" className="bn-guide-toc-toggle" aria-expanded={contentsOpen} onClick={()=>setContentsOpen(!contentsOpen)}><Menu size={18}/>{contentsOpen?words.hideContents:words.showContents}</button>
   <nav className={`bn-guide-toc ${contentsOpen?'is-open':''}`} aria-label={words.contents}>
    <span className="bn-guide-eyebrow">{words.contents}</span><button type="button" onClick={home} className={!article&&category==='all'?'is-active':''}>{words.home}</button>
    {categories.map((c,i)=>{const Icon=icons[c.icon];return <React.Fragment key={c.id}><button type="button" onClick={()=>chooseCategory(c.id)} className={(article?.category||category)===c.id?'is-active':''}><Icon size={16}/><span>{c[language]}</span></button>
     {article?.category===c.id&&<div className="bn-guide-toc-lessons">{siblings.map(item=><button type="button" key={item.id} onClick={()=>openArticle(item.id)} aria-current={articleId===item.id?'page':undefined}>{item.title[language]}</button>)}</div>}
    </React.Fragment>;})}
    <div className="bn-guide-toc-foot"><span>BetterNote {GUIDE_VERSION}</span><small><Check size={13}/>{words.offline}</small></div>
   </nav>
   <main ref={scroll} className="bn-guide-scroll">
    {article?<article className="bn-guide-article">
     <div className="bn-guide-breadcrumb"><button type="button" onClick={home}>{words.title}</button><ChevronRight size={14}/><button type="button" onClick={()=>chooseCategory(article.category)}>{group[language]}</button></div>
     <span className="bn-guide-eyebrow">{String(categories.indexOf(group)+1).padStart(2,'0')} / {group[language]}</span>
     <h1 ref={heading} tabIndex={-1}>{article.title[language]}</h1><p className="bn-guide-lead">{article.intro[language]}</p>
     <Figure key={articleId} id={article.figure} language={language} words={words}/>
     <h2>{words.steps}</h2><ol className="bn-guide-steps">{article.steps[language].map((step,i)=>{const [title,...body]=step.split('|');return <li key={i}><b className="bn-guide-step-number">{String(i+1).padStart(2,'0')}</b><div><h3>{title}</h3><p>{body.join('|')}</p></div></li>;})}</ol>
     {article.note[language]&&<aside className="bn-guide-note"><Info size={18}/><div><strong>{words.note}</strong><p>{article.note[language]}</p></div></aside>}
     {['local-backup','drive-backup','incremental'].includes(article.id)&&<Figure id="backup-buttons" language={language} words={words}/>}
     {article.id==='show-files'&&figures['explorer']&&<Figure id="explorer" language={language} words={words}/>}
     {article.id==='colors'&&figures['recolor']&&<Figure id="recolor" language={language} words={words}/>}
     {related.length>0&&<div className="bn-guide-related"><h2>{words.related}</h2>{related.map(item=><button type="button" key={item.id} onClick={()=>openArticle(item.id)}>{item.title[language]}<ArrowRight size={16}/></button>)}</div>}
     <footer className="bn-guide-article-footer">{position>0?<button type="button" onClick={()=>openArticle(siblings[position-1].id)}><ArrowLeft size={16}/>{words.previous}</button>:<button type="button" onClick={()=>chooseCategory(article.category)}><ArrowLeft size={16}/>{group[language]}</button>}{position<siblings.length-1&&<button type="button" onClick={()=>openArticle(siblings[position+1].id)}>{words.next}<ArrowRight size={16}/></button>}</footer>
    </article>:<div className="bn-guide-home">
     {!query&&category==='all'&&<><div className="bn-guide-intro"><span className="bn-guide-eyebrow">BETTERNOTE / USER GUIDE</span><h1 ref={heading} tabIndex={-1}>{words.subtitle}</h1><p className="bn-guide-lead">{words.intro}</p><div className="bn-guide-meta">{categories.length} {language==='th'?'หมวด':'topics'}<span>·</span>{lessons.length} {words.lessons}<span>·</span>{GUIDE_VERSION}</div></div>
     <div className="bn-guide-featured"><div><span className="bn-guide-eyebrow">PC → SURFACE</span><h2>{language==='th'?'เขียนต่ออีกเครื่องอย่างมั่นใจ':'Pick up on another device'}</h2><p>{language==='th'?'สำรองงาน เลือกเครื่องต้นทาง แล้วกู้คืนให้ถูกชุด':'Back up your work, choose the source and restore the right set.'}</p><button type="button" onClick={()=>openArticle('restore')}>{words.read}<ArrowRight size={17}/></button></div>{figures['restore']&&<img src={asset(figures.restore.file)} alt={language==='th'?'ตัวเลือกเครื่องต้นทางสำหรับกู้คืน':'Restore source picker'}/>}</div>
     <h2>{words.popular}</h2><div className="bn-guide-popular">{popular.map((id,i)=>{const item=lessons.find(l=>l.id===id);return <button type="button" key={id} onClick={()=>openArticle(id)}><span>{String(i+1).padStart(2,'0')}</span><strong>{item.title[language]}</strong><ArrowRight size={17}/></button>;})}</div>
     <h2>{words.browse}</h2><div className="bn-guide-category-grid">{categories.map((c,i)=>{const Icon=icons[c.icon];return <button type="button" key={c.id} onClick={()=>chooseCategory(c.id)}><div className="bn-guide-category-top"><Icon size={23}/><span>{String(i+1).padStart(2,'0')}</span></div><h3>{c[language]}</h3><p>{c[language==='th'?'descriptionTh':'descriptionEn']}</p><small>{lessons.filter(l=>l.category===c.id).length} {words.lessons}<ArrowRight size={15}/></small></button>;})}</div></>}
     {(query||category!=='all')&&<><div className="bn-guide-breadcrumb"><button type="button" onClick={home}><ArrowLeft size={15}/>{words.back}</button></div><span className="bn-guide-eyebrow">{query?words.search:words.contents}</span><h1 ref={heading} tabIndex={-1}>{query?`“${query}”`:group[language]}</h1><p className="bn-guide-lead">{query?`${filtered.length} ${words.lessons}`:group[language==='th'?'descriptionTh':'descriptionEn']}</p><div className="bn-guide-lesson-list">{filtered.map((item,i)=><button type="button" key={item.id} onClick={()=>openArticle(item.id)}><span>{String(i+1).padStart(2,'0')}</span><div><h3>{item.title[language]}</h3><p>{item.intro[language]}</p></div><ArrowRight size={18}/></button>)}</div>{filtered.length===0&&<div className="bn-guide-empty"><Search size={28}/><h2>{words.empty}</h2><p>{words.emptyHelp}</p><button type="button" onClick={()=>setQuery('')}>{words.clear}</button></div>}</>}
    </div>}
   </main>
  </div>
 </section>;
}
