import { validateNotebook } from './backupValidation.js';
export const MAX_BNOTE_BYTES = 272 * 1048576;
const fail = code => { throw Object.assign(new Error(code), { code }); };
// Accept portable exports and the legacy standalone notebook format.
export function decodeBnote(bytes) {
 if (!(bytes instanceof Uint8Array) || !bytes.byteLength) fail('bnote-empty');
 if (bytes.byteLength > MAX_BNOTE_BYTES) fail('bnote-too-large');
 let data;
 try { data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); }
 catch (_) { fail('bnote-invalid'); }
 if (!data || typeof data!=='object' || Array.isArray(data)) fail('bnote-invalid');
 const raw=data.notebook || data;
 const source=data.pages;
 if (!raw || typeof raw!=='object' || Array.isArray(raw) || !Array.isArray(source)) fail('bnote-invalid');
 if (data.format && data.format!=='BetterNote_Document') fail('bnote-invalid');
 if (data.format==='BetterNote_Document' && data.version!==undefined && data.version!==1) fail('bnote-invalid');
 if (raw.pageCount!==undefined && raw.pageCount!==source.length && source.length) fail('bnote-incomplete');
 const id=raw.id || 'legacy-import';
 const pages=source.length ? source.map((p,i)=>({...p,id:p?.id || 'legacy-page-'+i,notebookId:id,pageIndex:p?.pageIndex ?? i})) :
 [{id:'legacy-page-0',notebookId:id,pageIndex:0,strokes:[],textElements:[],imageElements:[],templateId:raw.templateId || 'blank'}];
 try { return validateNotebook({...raw,id,pageCount:pages.length,pages}); }
 catch (e) { fail(e.code==='backup-incomplete'?'bnote-incomplete':'bnote-invalid'); }
}
