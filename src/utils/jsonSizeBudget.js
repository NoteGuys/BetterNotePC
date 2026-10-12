// Count JSON UTF-8 bytes before allocating a complete JSON string/buffer.
// Plain notebook records only; string scanning retains no second media copy.
export const assertJsonSize=(value,limit=272*1024*1024)=>{
 let bytes=0;const ancestors=new Set();const add=n=>{bytes+=n;if(bytes>limit)throw Error('backup-too-large');};
 const string=s=>{add(2);for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(c===34||c===92)add(2);else if(c<32)add([8,9,10,12,13].includes(c)?2:6);else if(c<128)add(1);else if(c<2048)add(2);else if(c>=0xd800&&c<=0xdbff){const next=s.charCodeAt(i+1);if(next>=0xdc00&&next<=0xdfff){add(4);i++;}else add(6);}else if(c>=0xdc00&&c<=0xdfff)add(6);else add(3);}};
 const visit=v=>{
  if(v&&typeof v.toJSON==='function')v=v.toJSON();
  if(v===null){add(4);return;}if(typeof v==='string'){string(v);return;}if(typeof v==='boolean'){add(v?4:5);return;}if(typeof v==='number'){add(Number.isFinite(v)?String(v).length:4);return;}
  if(typeof v==='bigint')throw Error('Invalid JSON value');
  if(!v||typeof v!=='object'){add(4);return;}
  if(ancestors.has(v))throw Error('Invalid JSON cycle');ancestors.add(v);add(2);
  if(Array.isArray(v)){for(let i=0;i<v.length;i++){if(i)add(1);visit(v[i]);}}
  else{let first=true;for(const key of Object.keys(v)){const item=v[key];if(item===undefined||typeof item==='function'||typeof item==='symbol')continue;if(!first)add(1);first=false;string(key);add(1);visit(item);}}
  ancestors.delete(v);
 };
 visit(value);return bytes;
};
