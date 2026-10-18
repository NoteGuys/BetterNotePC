import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TRANSLATIONS,setAppLanguage,getAppLanguage,t} from '../src/services/i18n.js';
import {LANGUAGES,languageDirection,languageLocale} from '../src/services/languageCatalog.js';
import {additionalTranslations} from '../src/services/translations/newLanguages.js';
import {languageUi} from '../src/services/translations/languageUi.js';
import {lessons,categories,guideText,searchLessons} from '../src/components/Guide/guideContent.js';
import {figures} from '../src/components/Guide/guideFigures.js';
import {localizeNotebookCopyName} from '../src/utils/notebookNames.js';
import {COMMUNITY_DOWNLOADS,COMMUNITY_FEEDBACK,openCommunityLink} from '../src/services/communityLinks.js';

const placeholders=text=>[...text.matchAll(/\{\w+\}/g)].map(m=>m[0]).sort();
for(const code of ['ar','es','de']){
 test(code+' provides every English UI key with matching placeholders and readable text',()=>{
  const dict=TRANSLATIONS[code];assert.deepEqual(Object.keys(dict).sort(),Object.keys(TRANSLATIONS.en).sort());
  for(const [key,value]of Object.entries(dict)){
   assert.equal(typeof value,'string',key);assert.ok(value.trim(),key);assert.doesNotMatch(value,/\uFFFD|undefined|TODO|\u0000/u,key);
   assert.deepEqual(placeholders(value),placeholders(TRANSLATIONS.en[key]),key);
   if(key!=='langThai')assert.doesNotMatch(value,/[\u0e00-\u0e7f]/u,key);
  }
  const source=readFileSync(new URL('../src/services/translations/newLanguages.js',import.meta.url),'utf8');
  const rows=source.slice(source.indexOf('const rows = `')+14,source.lastIndexOf('`;')).trim().split('\n');
  const keys=rows.map(r=>r.split('|')[0]);assert.equal(new Set(keys).size,keys.length);assert.equal(keys.length,Object.keys(additionalTranslations[code]).length);
 });
 test(code+' covers all 55 lessons, 10 categories, UI labels and every annotated image',()=>{
  assert.equal(lessons.length,55);assert.equal(categories.length,10);
  for(const category of categories){assert.ok(category[code]);assert.ok(category['description'+code]);}
  for(const lesson of lessons){assert.ok(lesson.title[code]);assert.ok(lesson.intro[code]);assert.ok(lesson.steps[code].length>=3,lesson.id);
   for(const step of lesson.steps[code]){const [title,body,...rest]=step.split('|');assert.ok(title?.trim()&&body?.trim(),lesson.id);assert.equal(rest.length,0);}
   if(lesson.note.en)assert.ok(lesson.note[code],lesson.id+' missing note');
   for(const related of lesson.related)assert.ok(lessons.some(l=>l.id===related));
  }
  assert.deepEqual(Object.keys(guideText[code]).sort(),Object.keys(guideText.en).sort());
  for(const fig of Object.values(figures)){assert.ok(fig.alt[code]);for(const mark of fig.marks)assert.ok(mark.label[code]);}
 });
 test(code+' language survives both preference entry points without changing other preferences',async()=>{
  const preferences=await import('../src/services/userPreferences.js');const memory=new Map([['betternote_user_preferences',JSON.stringify({activeColor:'#123456',palmRejection:true})]]);
  globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v)};
  globalThis.window={dispatchEvent(){}};globalThis.CustomEvent=class{};
  try{setAppLanguage(code);assert.equal(getAppLanguage(),code);assert.equal(preferences.loadEditorPreferences().language,code);
   preferences.setAppLanguage(code);assert.equal(getAppLanguage(),code);assert.equal(JSON.parse(memory.get('betternote_user_preferences')).activeColor,'#123456');
   const name='ملاحظات $& $1 {draft} C:\\work';assert.ok(t('coverThumbnailAlt','',{name}).includes(name));
  }finally{delete globalThis.localStorage;delete globalThis.window;delete globalThis.CustomEvent;setAppLanguage('en');}
 });
 test(code+' duplicate suffixes translate without rewriting stored names',()=>{
  const original='Physics (Copy)(2)';assert.equal(localizeNotebookCopyName(original,TRANSLATIONS[code].notebookCopySuffix),'Physics ('+TRANSLATIONS[code].notebookCopySuffix+')(2)');
  assert.equal(original,'Physics (Copy)(2)');
 });
}
test('Arabic beta status, script direction and locale choices are explicit',()=>{
 assert.equal(LANGUAGES.length,7);assert.equal(LANGUAGES.filter(l=>l.experimental).length,1);assert.equal(LANGUAGES.find(l=>l.experimental).code,'ar');
 assert.match(TRANSLATIONS.th.langArabic,/\(รุ่นทดสอบ\)/);assert.match(TRANSLATIONS.ar.langArabic,/\(نسخة تجريبية\)/);
 for(const {code}of LANGUAGES){assert.equal(languageDirection(code),code==='ar'?'rtl':'ltr');assert.doesNotThrow(()=>new Intl.DateTimeFormat(languageLocale(code)).format(new Date()));}
});
test('Guide search finds native words, including Arabic without diacritics',()=>{
 for(const query of ['استعادة','التكبير','restaurar','Bilder','Sicherung'])assert.ok(searchLessons(query).length,query);
 assert.ok(searchLessons('استعادة','backup').length);assert.equal(searchLessons('no-match-xxyyzz').length,0);
});
test('Community actions use only verified distribution endpoints and handle errors',async()=>{
 assert.equal(COMMUNITY_DOWNLOADS,'https://github.com/NoteGuys/BetterNote-Releases/releases');assert.equal(COMMUNITY_FEEDBACK,'https://github.com/NoteGuys/BetterNote-Releases/issues');
 const opened=[];globalThis.window={electronAPI:{openExternal:async url=>{opened.push(url);return {success:true};}}};
 try{assert.equal(await openCommunityLink(COMMUNITY_DOWNLOADS),true);assert.equal(await openCommunityLink(COMMUNITY_FEEDBACK),true);
 assert.equal(await openCommunityLink('https://github.com/NoteGuys/BetterNotePC'),false);assert.equal(opened.length,2);
 window.electronAPI.openExternal=async()=>{throw Error('offline');};assert.equal(await openCommunityLink(COMMUNITY_DOWNLOADS),false);
 }finally{delete globalThis.window;}
});
