const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs').promises,path=require('node:path');
const {createBackupWorkerClient}=require('../electron/backupWorkerClient.cjs');
const preview=process.env.BETTERNOTE_QA_TEMP;
if(!preview||!path.isAbsolute(preview))throw Error('Set BETTERNOTE_QA_TEMP to the isolated QA folder.');
test('Actual native worker writes and verifies synthetic artifacts at both destinations',async()=>{
 const root=await fs.mkdtemp(path.join(preview,'betternote-worker-')),local=path.join(root,'local'),drive=path.join(root,'My Drive','BetterNote.AppPC');
 const client=createBackupWorkerClient({localDir:local,driveCandidates:[]});
 try{
  const note={id:'worker-note',name:'Synthetic',updatedAt:2,pageCount:1,pages:[{id:'page',pageIndex:0,strokes:[],textElements:[],imageElements:[]}]};
  const metadata={folders:[],notebooks:[{...note,pages:undefined}]};
  assert.equal((await client.execute({action:'inspect',customBackupPath:drive})).lastSync,null);
  assert.equal((await client.execute({action:'begin',jobId:'worker-job',metadata,metadataRevision:'m',customBackupPath:drive})).success,true);
  assert.equal((await client.execute({action:'notebook',jobId:'worker-job',notebook:note,pdfRevision:'p',pdfBase64:Buffer.from('%PDF-1.7\nworker fixture\n%%EOF').toString('base64')})).success,true);
  assert.equal((await client.execute({action:'finish',jobId:'worker-job',metadataRevision:'m'})).success,true);
  const inspected=await client.execute({action:'inspect',customBackupPath:drive,includeFiles:true});
  assert.equal(inspected.files.length,6);assert.equal(inspected.targets.length,2);assert.equal(inspected.cloudUploadVerified,false);
  for(const destination of [local,drive])assert.deepEqual(JSON.parse(await fs.readFile(path.join(destination,'Full_System','BetterNote_Latest_Backup.json'))).notebooks[0],note);
 }finally{await client.close();}
});
test('Worker close and restart cannot acknowledge an abandoned request as success',async()=>{
 const root=await fs.mkdtemp(path.join(preview,'betternote-worker-restart-'));
 const client=createBackupWorkerClient({localDir:root,driveCandidates:[]});
 const abandoned=client.execute({action:'inspect'});await client.close();
 assert.equal((await abandoned).success,false);
 try{assert.equal((await client.execute({action:'inspect'})).success,true);}
 finally{await client.close();}
});