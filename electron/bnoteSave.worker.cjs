const {parentPort}=require('node:worker_threads');
const fs=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto');
const {createReadStream}=require('node:fs');
let session=null,sequence=Promise.resolve();
const signature=async file=>{try{const s=await fs.stat(file);if(!s.isFile())throw Error();return [s.size,s.mtimeMs,s.ctimeMs,s.ino].join(':');}catch(e){if(e.code==='ENOENT')return null;throw e;}};
const digest=async file=>{const hash=createHash('sha256');for await(const part of createReadStream(file))hash.update(part);return hash.digest('hex');};
const abort=async()=>{const old=session;session=null;if(old){await old.handle?.close().catch(()=>{});await fs.unlink(old.temp).catch(()=>{});}};
async function execute(command){
 if(command.action==='begin'){
  if(session || !path.isAbsolute(command.path) || !/\.bnote$/i.test(command.path) || !Number.isInteger(command.size) || command.size<1 || command.size>272*1048576)throw Error();
  const previous=await signature(command.path),temp=command.path+'.pending-'+command.id;
  session={previous,id:command.id,path:command.path,temp,size:command.size,offset:0,hash:createHash('sha256'),handle:await fs.open(temp,'wx')};
  return{success:true};
 }
 const s=session;if(!s || command.id!==s.id)throw Error();
 if(command.action==='abort'){await abort();return{success:true};}
 if(command.action==='chunk'){
  if(!(command.bytes instanceof ArrayBuffer) || command.offset!==s.offset || !command.bytes.byteLength || command.bytes.byteLength>2*1048576 || s.offset+command.bytes.byteLength>s.size)throw Error();
  const bytes=Buffer.from(command.bytes);let offset=0;
  while(offset<bytes.length){const result=await s.handle.write(bytes,offset,bytes.length-offset);if(!result.bytesWritten)throw Error();offset+=result.bytesWritten;}
  s.hash.update(bytes);s.offset+=bytes.length;return{success:true};
 }
 if(command.action==='finish'){
  if(s.offset!==s.size)throw Error();await s.handle.sync();await s.handle.close();s.handle=null;
  const expected=s.hash.digest('hex');if(await digest(s.temp)!==expected)throw Error();
  const {decodeBnote}=await import('./bnoteFormat.js');
  decodeBnote(new Uint8Array(await fs.readFile(s.temp)));
  if(await signature(s.path)!==s.previous)throw Error();
  await fs.rename(s.temp,s.path);
  if(await digest(s.path)!==expected)throw Error();
  session=null;return{success:true,size:s.size};
 }
 throw Error();
}
parentPort.on('message',command=>{sequence=sequence.then(async()=>{
 try{parentPort.postMessage({requestId:command.requestId,...await execute(command)});}
 catch(_){await abort();parentPort.postMessage({requestId:command.requestId,success:false,reason:'bnote-save-failed'});}
});});
