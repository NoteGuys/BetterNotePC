// Screenshot-scale archive with synthetic strings; no user backups or database access.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs').promises,path=require('node:path'),{createHash}=require('node:crypto');
const {createBackupReaderClient}=require('../electron/backupReaderClient.cjs');
const qa=process.env.BETTERNOTE_QA_TEMP;if(!qa||!path.isAbsolute(qa))throw Error('Use isolated QA storage.');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
test('A roughly 270 MB archive with 21 image-heavy notes, deleted folders and archived duplicates is readable',async()=>{
 const root=await fs.mkdtemp(path.join(qa,'betternote-reader-large-'));await fs.mkdir(path.join(root,'Full_System'));await fs.mkdir(path.join(root,'Editable_Notes'));
 const full={version:1,appName:'BetterNote',folders:[],notebooks:[]},manifest={version:2,notebooks:{},activeIds:[]};
 let editableBytes=0;for(let i=0;i<21;i++){
  const id='qa-large-'+i,MiB=i===0?40:i===1?29:2,payload='data:image/png;base64,'+'x'.repeat(MiB*1048576);
  const note={id,name:'Synthetic engineering '+i,updatedAt:100+i,folderId:i<2?'previously-deleted-'+i:null,pageCount:1,pages:[{id:id+'-p0',notebookId:id,pageIndex:0,updatedAt:100+i,pdfPageImage:payload,strokes:[{points:[{x:-20,y:10},{x:250,y:120}]}],imageElements:[{id:'locked',src:'data:image/png;base64,cWE=',x:10,y:20,width:30,height:40,locked:true}],textElements:[{text:'Synthetic',x:10,y:20}]}]};
  const bytes=Buffer.from(JSON.stringify(note)),relative='Editable_Notes/'+id+'.bnote';await fs.writeFile(path.join(root,relative),bytes);editableBytes+=bytes.length;
  const token=JSON.stringify([id,note.updatedAt,note.name,note.folderId,1,false]);manifest.notebooks[id]={name:note.name,updatedAt:note.updatedAt,folderId:note.folderId,pageCount:1,editable:{path:relative,hash:hash(bytes),size:bytes.length,revision:token}};manifest.activeIds.push(id);full.notebooks.push(note);
 }
 let bytes=Buffer.from(JSON.stringify(full));manifest.fullSize=bytes.length;manifest.fullHash=hash(bytes);await fs.writeFile(path.join(root,'Full_System/BetterNote_Latest_Backup.json'),bytes);bytes=null;full.notebooks=[];
 await fs.writeFile(path.join(root,'Full_System/backup_manifest.json'),JSON.stringify(manifest));
 const archive=Buffer.from(JSON.stringify({id:'old-copy',pages:[{pdfPageImage:'z'.repeat(6*1048576)}]}));for(let i=0;i<9;i++)await fs.writeFile(path.join(root,'Editable_Notes','old-'+i+'.bnote'),archive);
 const started=Date.now(),progress=[],client=createBackupReaderClient();
 try{
  const result=await client.execute({folderPath:root},event=>progress.push(event));assert.equal(result.success,true);assert.equal(result.count,21);assert.equal(result.recoveredFolderNotebookIds.length,2);
  assert.equal(result.data.notebooks[0].pages[0].pdfPageImage.length,'data:image/png;base64,'.length+40*1048576);assert.equal(result.data.notebooks[0].pages[0].imageElements[0].locked,true);
  assert.ok(progress.some(event=>event.bytesDone>1048576));assert.ok(progress.every(event=>event.bytesDone<=event.totalBytes));
  console.log(JSON.stringify({fixture:root,notebooks:21,archiveMiB:Math.round((editableBytes+manifest.fullSize+archive.length*9)/1048576),elapsedMs:Date.now()-started,progressEvents:progress.length}));
 }finally{await client.close();}
});
