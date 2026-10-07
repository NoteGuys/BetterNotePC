const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs').promises, path = require('node:path');
const { createBackupWriter, notebookBackupRevision } = require('../electron/backupWriter.cjs');
const preview = process.env.BETTERNOTE_QA_TEMP;
if (!preview || !path.isAbsolute(preview)) throw new Error('Set BETTERNOTE_QA_TEMP to the isolated QA folder.');
const fixture = async () => fs.mkdtemp(path.join(preview, 'betternote-phase2-'));
const note = (id = 'n1', name = 'Example', time = 10) => ({ id, name, updatedAt: time, pageCount: 1,
  pdfBase64: 'original-pdf-is-preserved', pages: [{ id: id + '-p0', notebookId: id, pageIndex: 0, updatedAt: time,
    strokes: [{ id: 's1', points: [{ x: -10, y: 20, pressure: .7 }] }],
    imageElements: [{ id: 'i1', src: 'data:image/png;base64,c3ludGhldGlj', locked: true }], textElements: [{ id: 't1', text: 'synthetic' }] }] });
const pdf = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.7\nsynthetic\n%%EOF').toString('base64');
const meta = notes => ({ notebooks: notes.map(({ pages, pdfBase64, ...n }) => n), folders: [{ id: 'f1', name: 'Synthetic' }] });
const run = async (writer, notes, extra = {}) => {
  const jobId = 'job-' + Math.random();
  const start = await writer.execute({ action: 'begin', jobId, metadata: meta(notes), metadataRevision: 'rev-' + notes[0]?.updatedAt, ...extra });
  if (!start.success) { await writer.execute({ action: 'abort', jobId }); return start; }
  const middle = [];
  for (const n of notes) middle.push(await writer.execute({ action: 'notebook', jobId, notebook: n, pdfBase64: pdf, pdfRevision: 'pages-' + n.updatedAt }));
  return { ...await writer.execute({ action: 'finish', jobId }), middle };
};
const fullFile = root => path.join(root, 'Full_System', 'BetterNote_Latest_Backup.json');
test('A successful backup round keeps every editable field and verifies each destination', async () => {
  const local = await fixture(), drive = await fixture(), writer = createBackupWriter({ localDir: local });
  const n = note(), result = await run(writer, [n], { driveBackupPath: drive });
  assert.equal(result.success, true); assert.equal(result.targets.length, 2); assert.equal(result.cloudUploadVerified, false);
  for (const dir of [local, drive]) {
    const full = JSON.parse(await fs.readFile(fullFile(dir)));
    assert.deepEqual(full.notebooks[0], n);
    const manifest = JSON.parse(await fs.readFile(path.join(dir, 'Full_System', 'backup_manifest.json')));
    assert.equal(manifest.notebooks.n1.editable.revision, notebookBackupRevision(n));
    assert.ok(manifest.lastSync);
  }
});
test('Duplicate and Windows-sanitized names cannot overwrite another notebook', async () => {
  const root = await fixture(), writer = createBackupWriter({ localDir: root });
  assert.equal((await run(writer, [note('a', 'Same'), note('b', 'Same'), note('c', 'A/B'), note('d', 'A:B')])).success, true);
  const files = (await fs.readdir(path.join(root, 'Editable_Notes'))).filter(f => f.endsWith('.bnote'));
  assert.equal(files.length, 4);
  assert.deepEqual(new Set((await Promise.all(files.map(async f => JSON.parse(await fs.readFile(path.join(root, 'Editable_Notes', f))).id)))), new Set(['a','b','c','d']));
});
test('Rename keeps a stable backup path and does not delete the other same-name notebook', async () => {
  const root = await fixture(), writer = createBackupWriter({ localDir: root });
  await run(writer, [note('a', 'Old'), note('b', 'New')]);
  const before = (await writer.execute({ action: 'inspect' })).targets[0].notebooks.a.editable.path;
  await run(writer, [note('a', 'New', 20), note('b', 'New')]);
  assert.equal((await writer.execute({ action: 'inspect' })).targets[0].notebooks.a.editable.path, before);
  assert.equal(JSON.parse(await fs.readFile(fullFile(root))).notebooks.length, 2);
});
test('Only three previous complete note versions are retained', async () => {
  const root = await fixture(), writer = createBackupWriter({ localDir: root });
  for (let time=1; time<=6; time++) await run(writer, [note('a', 'Versions', time)]);
  const relative = (await writer.execute({ action: 'inspect' })).targets[0].notebooks.a.editable.path;
  const history = path.join(root, path.dirname(relative), '.history', path.basename(relative));
  const archived = await fs.readdir(history);
  assert.equal(archived.length, 3);
  for (const f of archived) assert.ok(JSON.parse(await fs.readFile(path.join(history,f))).pages.length);
  assert.equal(JSON.parse(await fs.readFile(path.join(root,relative))).updatedAt, 6);
});
test('A failed Windows replacement leaves the previous file byte-for-byte intact', async () => {
  const root = await fixture(), writer = createBackupWriter({ localDir: root });
  await run(writer, [note()]);
  const info = (await writer.execute({ action:'inspect' })).targets[0];
  const file = path.join(root,info.notebooks.n1.editable.path), before = await fs.readFile(file);
  const bad = createBackupWriter({ localDir:root, fs:{ ...fs, rename:async (a,b)=>{ if(b===file)throw Object.assign(new Error('held'),{code:'EPERM'});return fs.rename(a,b); } } });
  const result = await run(bad, [note('n1','Example',20)]);
  assert.equal(result.success,false); assert.deepEqual(await fs.readFile(file),before);
  assert.deepEqual((await fs.readdir(path.dirname(file))).filter(n=>n.includes('.pending-')),[]);
});
test('Disk-full failure cannot overwrite the previous full-system snapshot or advance success time', async () => {
  const root = await fixture(), writer = createBackupWriter({localDir:root});
  await run(writer,[note()]);
  const before = await fs.readFile(fullFile(root));
  const oldTime = (await writer.execute({action:'inspect'})).targets[0].lastSuccess;
  const bad = createBackupWriter({ localDir:root, beforeReplace:async ({relative})=>{ if(relative.endsWith('.bnote'))throw Object.assign(new Error('full'),{code:'ENOSPC'}); } });
  const result=await run(bad,[note('n1','Example',20)]);
  assert.equal(result.success,false);assert.deepEqual(await fs.readFile(fullFile(root)),before);
  assert.equal((await writer.execute({action:'inspect'})).targets[0].lastSuccess,oldTime);
});
test('An unreachable explicit Drive target reports partial results while local backup succeeds', async () => {
  const root=await fixture(), destination=await fixture();
  await fs.writeFile(path.join(destination,'blocked'),'not a directory');
  const result=await run(createBackupWriter({localDir:root}),[note()],{driveBackupPath:path.join(destination,'blocked')});
  assert.equal(result.success,false);assert.equal(result.targets[0].success,true);assert.equal(result.targets[1].success,false);
  assert.equal(JSON.parse(await fs.readFile(fullFile(root))).notebooks.length,1);
});
test('Malformed existing full backup is preserved instead of being silently replaced', async () => {
  const root=await fixture();await fs.mkdir(path.dirname(fullFile(root)),{recursive:true});
  const corrupt=Buffer.from('{incomplete synthetic file');await fs.writeFile(fullFile(root),corrupt);
  const result=await run(createBackupWriter({localDir:root}),[note()]);
  assert.equal(result.success,false);assert.deepEqual(await fs.readFile(fullFile(root)),corrupt);
});
test('An older device cannot overwrite the newer same-ID backup', async () => {
  const root=await fixture(), writer=createBackupWriter({localDir:root});
  await run(writer,[note('n1','Example',100)]);
  const before=await fs.readFile(fullFile(root));
  const result=await run(writer,[note('n1','Example',50)]);
  assert.equal(result.success,false);assert.deepEqual(await fs.readFile(fullFile(root)),before);
});
test('A new device with fewer notebooks preserves all other IDs, including duplicate names', async () => {
  const root=await fixture(),writer=createBackupWriter({localDir:root});
  await run(writer,[note('a','Same'),note('b','Same')]);
  await run(writer,[note('c','Same')]);
  assert.deepEqual(new Set(JSON.parse(await fs.readFile(fullFile(root))).notebooks.map(n=>n.id)),new Set(['a','b','c']));
});
test('Empty device cannot replace existing backups with an empty snapshot', async () => {
  const root=await fixture(),writer=createBackupWriter({localDir:root});await run(writer,[note()]);
  const before=await fs.readFile(fullFile(root));
  const result=await writer.execute({action:'begin',jobId:'empty',metadata:{folders:[],notebooks:[]}});
  assert.equal(result.success,false);assert.deepEqual(await fs.readFile(fullFile(root)),before);
});
test('Trash metadata preserves the complete editable notebook instead of deleting its backup', async () => {
  const root=await fixture(),writer=createBackupWriter({localDir:root});await run(writer,[note()]);
  const trashed={...note('n1','Example',20),isDeleted:true};
  assert.equal((await run(writer,[trashed])).success,true);
  const backed=JSON.parse(await fs.readFile(fullFile(root))).notebooks[0];
  assert.equal(backed.isDeleted,true);assert.deepEqual(backed.pages,trashed.pages);
});
test('Permanent pruning requires an ID and affects only that ID, even with duplicate names', async () => {
  const root=await fixture(),writer=createBackupWriter({localDir:root});await run(writer,[note('a','Same'),note('b','Same')]);
  assert.equal((await writer.execute({action:'prune',notebookIds:[]})).success,false);
  const result=await writer.execute({action:'prune',notebookIds:['a']});
  assert.equal(result.success,true);
  const ids=JSON.parse(await fs.readFile(fullFile(root))).notebooks.map(n=>n.id);
  assert.deepEqual(ids,['b']);
});
test('PDF failure remains partial while the editable notebook is still backed up', async () => {
  const root=await fixture(),writer=createBackupWriter({localDir:root}),n=note();
  await writer.execute({action:'begin',jobId:'partial',metadata:meta([n]),metadataRevision:'r'});
  await writer.execute({action:'notebook',jobId:'partial',notebook:n,pdfBase64:null,pdfRevision:'p'});
  const result=await writer.execute({action:'finish',jobId:'partial'});
  assert.equal(result.success,false);assert.equal(result.targets[0].partial,true);assert.equal(result.targets[0].lastSuccess,null);
  assert.deepEqual(JSON.parse(await fs.readFile(fullFile(root))).notebooks[0],n);
});
test('A truncated PDF cannot be acknowledged as complete', async () => {
  const root=await fixture(),writer=createBackupWriter({localDir:root}),n=note();
  await writer.execute({action:'begin',jobId:'badpdf',metadata:meta([n])});
  const result=await writer.execute({action:'notebook',jobId:'badpdf',notebook:n,pdfBase64:Buffer.from('%PDF-1.7\ntruncated').toString('base64')});
  assert.equal(result.success,false);await writer.execute({action:'abort',jobId:'badpdf'});
});
test('Cancellation before replacement leaves the old version and removes the pending file', async () => {
  const root=await fixture(),writer=createBackupWriter({localDir:root});await run(writer,[note()]);
  const info=(await writer.execute({action:'inspect'})).targets[0],relative=info.notebooks.n1.editable.path;
  const before=await fs.readFile(path.join(root,relative));
  await assert.rejects(writer.atomic(root,relative,Buffer.from(JSON.stringify(note('n1','Example',20))),null,()=>false));
  assert.deepEqual(await fs.readFile(path.join(root,relative)),before);
});
test('External modification during replacement is detected without overwriting that modification', async () => {
  const root=await fixture(),writer=createBackupWriter({localDir:root});await run(writer,[note()]);
  const concurrent=note('n1','Example',30),bad=createBackupWriter({localDir:root,beforeReplace:async ({file,relative})=>{
    if(relative.endsWith('.bnote'))await fs.writeFile(file,JSON.stringify(concurrent));
  }});
  assert.equal((await run(bad,[note('n1','Example',20)])).success,false);
  const info=(await writer.execute({action:'inspect'})).targets[0];
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(root,info.notebooks.n1.editable.path))),concurrent);
});
test('The inspection path is read-only and does not create backup directories', async () => {
  const parent=await fixture(),root=path.join(parent,'missing'),writer=createBackupWriter({localDir:root});
  const result=await writer.execute({action:'inspect'});
  assert.equal(result.lastSync,null);assert.equal(result.files.length,0);
  await assert.rejects(fs.stat(root),{code:'ENOENT'});
});


test('Equal timestamps with conflicting page content preserve the existing backup',async()=>{
 const root=await fixture(),writer=createBackupWriter({localDir:root});await run(writer,[note()]);
 const before=await fs.readFile(fullFile(root)),other=note();other.pages[0].strokes[0].points[0].x=999;
 assert.equal((await run(writer,[other])).success,false);assert.deepEqual(await fs.readFile(fullFile(root)),before);
});
test('Rechecking unchanged work does not rotate previous snapshot versions',async()=>{
 const root=await fixture(),writer=createBackupWriter({localDir:root});await run(writer,[note()]);await run(writer,[note()]);
 await assert.rejects(fs.stat(path.join(root,'Full_System','.history','BetterNote_Latest_Backup.json')),{code:'ENOENT'});
});
test('Inspection invalidates a previously successful artifact when it is deleted outside the app',async()=>{
 const root=await fixture(),writer=createBackupWriter({localDir:root});await run(writer,[note()]);
 const before=(await writer.execute({action:'inspect'})).targets[0];
 await fs.unlink(path.join(root,before.notebooks.n1.pdf.path));
 const after=(await writer.execute({action:'inspect'})).targets[0];
 assert.equal(after.notebooks.n1.pdf.revision,null);assert.equal(after.partial,true);
});
test('A timed-out write cannot replace old data after its delayed continuation resumes',async()=>{
 const root=await fixture(),writer=createBackupWriter({localDir:root});await run(writer,[note()]);
 const info=(await writer.execute({action:'inspect'})).targets[0],file=path.join(root,info.notebooks.n1.editable.path),before=await fs.readFile(file);
 let release;const gate=new Promise(r=>release=r);
 const slow=createBackupWriter({localDir:root,deadlineMs:150,beforeReplace:async({relative})=>{if(relative.endsWith('.bnote'))await gate;}});
 const job='slow';await slow.execute({action:'begin',jobId:job,metadata:meta([note('n1','Example',20)])});
 const result=await slow.execute({action:'notebook',jobId:job,notebook:note('n1','Example',20),pdfBase64:pdf});
 assert.equal(result.success,false);release();await new Promise(r=>setTimeout(r,60));
 assert.deepEqual(await fs.readFile(file),before);
 await slow.execute({action:'abort',jobId:job});
});

test('Legacy archives remain visible without claiming their unknown revision is current',async()=>{
 const root=await fixture();await fs.mkdir(path.join(root,'Editable_Notes'),{recursive:true});await fs.mkdir(path.join(root,'PDF_Documents'),{recursive:true});
 await fs.writeFile(path.join(root,'Editable_Notes','Old.bnote'),JSON.stringify(note('legacy','Old')));
 await fs.writeFile(path.join(root,'PDF_Documents','Old.pdf'),Buffer.from(pdf.split(',')[1],'base64'));
 const result=await createBackupWriter({localDir:root}).execute({action:'inspect',includeFiles:true});
 assert.equal(result.files.length,2);assert.ok(result.files.every(file=>file.legacy&&file.revision===null));assert.equal(result.lastSync,null);
});
test('A corrupt full snapshot prevents pruning any existing notebook artifact',async()=>{
 const root=await fixture(),writer=createBackupWriter({localDir:root});await run(writer,[note()]);
 const relative=(await writer.execute({action:'inspect'})).targets[0].notebooks.n1.editable.path;
 const before=await fs.readFile(path.join(root,relative));await fs.writeFile(fullFile(root),'{broken');
 assert.equal((await writer.execute({action:'prune',notebookIds:['n1']})).success,false);
 assert.deepEqual(await fs.readFile(path.join(root,relative)),before);
});
test('A tampered manifest cannot authorize deleting another notebook PDF',async()=>{
 const root=await fixture(),writer=createBackupWriter({localDir:root});await run(writer,[note('a'),note('b')]);
 const file=path.join(root,'Full_System','backup_manifest.json'),manifest=JSON.parse(await fs.readFile(file));
 const pdfPath=path.join(root,manifest.notebooks.b.pdf.path),before=await fs.readFile(pdfPath);
 manifest.notebooks.a.pdf=manifest.notebooks.b.pdf;await fs.writeFile(file,JSON.stringify(manifest));
 assert.equal((await writer.execute({action:'prune',notebookIds:['a']})).success,false);
 assert.deepEqual(await fs.readFile(pdfPath),before);
});
test('Reserved JavaScript key names retain independent notebook identities',async()=>{
 const root=await fixture(),writer=createBackupWriter({localDir:root});
 assert.equal((await run(writer,[note('__proto__'),note('constructor')])).success,true);
 assert.deepEqual(new Set(JSON.parse(await fs.readFile(fullFile(root))).notebooks.map(n=>n.id)),new Set(['__proto__','constructor']));
});
test('Inspecting a file selected as a folder reports its destination error honestly',async()=>{
 const parent=await fixture(),root=path.join(parent,'blocked');await fs.writeFile(root,'synthetic file');
 const result=await createBackupWriter({localDir:root}).execute({action:'inspect',includeFiles:true});
 assert.equal(result.success,false);assert.equal(result.targets[0].error,'ENOTDIR');assert.equal(result.lastSync,null);
});
test('Windows path letter-case cannot bypass quarantine of a timed-out destination',async()=>{
 const local=await fixture(),drive=await fixture(),writer=createBackupWriter({localDir:local});
 await run(writer,[note()],{driveBackupPath:drive});const before=await fs.readFile(fullFile(drive));
 let release;const gate=new Promise(resolve=>release=resolve);
 const slow=createBackupWriter({localDir:local,deadlineMs:150,beforeReplace:async({file,relative})=>{
  if(file.toLowerCase().startsWith(drive.toLowerCase()+path.sep)&&relative.endsWith('.bnote'))await gate;
 }});
 const changed=note('n1','Example',20);await slow.execute({action:'begin',jobId:'case-job',metadata:meta([changed]),driveBackupPath:drive});
 await slow.execute({action:'notebook',jobId:'case-job',notebook:changed,pdfBase64:pdf});
 const inspected=await slow.execute({action:'inspect',driveBackupPath:drive.toUpperCase()});
 assert.equal(inspected.targets[1].error,'destination-busy');release();await new Promise(resolve=>setTimeout(resolve,60));
 assert.deepEqual(await fs.readFile(fullFile(drive)),before);await slow.execute({action:'abort',jobId:'case-job'});
});

test('Selecting a local folder replaces the default instead of writing two local copies',async()=>{
 const root=await fixture(),defaultFolder=path.join(root,'default'),selected=path.join(root,'chosen');
 const writer=createBackupWriter({localDir:defaultFolder});
 const result=await run(writer,[note()],{localBackupPath:selected});
 assert.equal(result.success,true);assert.equal(result.targets.length,1);assert.deepEqual(result.targets[0].roles,['local']);
 assert.deepEqual(JSON.parse(await fs.readFile(fullFile(selected))).notebooks[0],note());
 await assert.rejects(fs.stat(defaultFolder),{code:'ENOENT'});
});
test('Local and Desktop Drive roles share one physical write when they select the same folder',async()=>{
 const root=await fixture(),writer=createBackupWriter({localDir:root});
 const result=await run(writer,[note()],{localBackupPath:root,driveBackupPath:root.toUpperCase()});
 assert.equal(result.targets.length,1);assert.deepEqual(new Set(result.targets[0].roles),new Set(['local','drive']));
});
test('A data-first round confirms recovery data before any PDF is generated',async()=>{
 const root=await fixture(),writer=createBackupWriter({localDir:root}),n=note();
 assert.equal((await writer.execute({action:'begin',phase:'data',jobId:'data-first',metadata:meta([n]),metadataRevision:'data-version'})).success,true);
 await writer.execute({action:'notebook',jobId:'data-first',notebook:n,pdfRevision:'p',pdfBase64:null});
 const saved=await writer.execute({action:'finish',jobId:'data-first',metadataRevision:'data-version'});
 assert.equal(saved.success,true);assert.equal(saved.dataSuccess,true);assert.equal(saved.pdfComplete,false);
 assert.ok(saved.targets[0].lastDataSuccess);assert.equal(saved.targets[0].lastSuccess,null);
 assert.deepEqual(JSON.parse(await fs.readFile(fullFile(root))).notebooks[0],n);
 const rendered=await writer.execute({action:'pdf',notebookId:n.id,revision:notebookBackupRevision(n),pdfRevision:'p',pdfBase64:pdf});
 assert.equal(rendered.success,true);assert.ok(rendered.targets[0].lastSuccess);
});
test('A failed PDF after data completion never clears the confirmed recovery snapshot',async()=>{
 const root=await fixture(),writer=createBackupWriter({localDir:root}),n=note();
 await writer.execute({action:'begin',phase:'data',jobId:'ready',metadata:meta([n]),metadataRevision:'ready'});
 await writer.execute({action:'notebook',jobId:'ready',notebook:n,pdfRevision:'p'});
 await writer.execute({action:'finish',jobId:'ready'});const before=await fs.readFile(fullFile(root));
 const result=await writer.execute({action:'pdf',notebookId:n.id,revision:notebookBackupRevision(n),pdfRevision:'p',pdfError:'pdf-backup-image-invalid'});
 assert.equal(result.success,false);assert.equal(result.targets[0].dataSuccess,true);assert.ok(result.targets[0].lastDataSuccess);
 assert.deepEqual(await fs.readFile(fullFile(root)),before);
});
test('A stale PDF cannot attach itself to a newer editable notebook',async()=>{
 const root=await fixture(),writer=createBackupWriter({localDir:root});await run(writer,[note('n1','Example',20)]);
 const result=await writer.execute({action:'pdf',notebookId:'n1',revision:notebookBackupRevision(note()),pdfBase64:pdf});
 assert.equal(result.success,false);assert.equal(result.targets[0].pdfError,'pdf-backup-superseded');
});
test('Unchanged files reuse their verified hashes, while deep verification rechecks the bytes',async()=>{
 const root=await fixture();let reads=0;
 const writer=createBackupWriter({localDir:root,fs:{...fs,readFile:async(...args)=>{reads++;return fs.readFile(...args);}}});
 await run(writer,[note()]);reads=0;await writer.execute({action:'inspect'});const cached=reads;
 reads=0;await writer.execute({action:'inspect',deepVerify:true});
 assert.ok(reads>cached);assert.equal(cached,1);
});
test('Native progress reports actual write bytes and file verification',async()=>{
 const root=await fixture(),writer=createBackupWriter({localDir:root}),n=note(),events=[];
 n.pdfBase64='x'.repeat(2200000);
 await writer.execute({action:'begin',phase:'data',jobId:'progress',metadata:meta([n])});
 await writer.execute({action:'notebook',jobId:'progress',notebook:n},event=>events.push(event));
 assert.ok(events.some(event=>event.stage==='writing'&&event.bytesDone>0&&event.bytesDone<event.totalBytes));
 assert.ok(events.some(event=>event.stage==='verified'&&event.bytesDone===event.totalBytes));
 await writer.execute({action:'abort',jobId:'progress'});
});

test('A conflicting notebook does not stop later notebooks in the same destination',async()=>{
 const root=await fixture(),writer=createBackupWriter({localDir:root});
 const originals=Array.from({length:11},(_,i)=>note('n'+i,'Book '+i,10));
 await run(writer,originals);const previous=await fs.readFile(fullFile(root));
 const incoming=originals.map((n,i)=>note(n.id,n.name,i===1?10:20));
 incoming[1].pages[0].strokes[0].points[0].x=999;
 const result=await run(writer,incoming);
 assert.equal(result.success,false);
 const target=result.targets[0];
 assert.equal(target.error,null);
 assert.equal(target.notebookIssues.n1.error,'conflicting-backup-revision');
 assert.equal(target.notebookIssues.n1.incomingUpdatedAt,10);
 assert.equal(target.notebookIssues.n1.backupUpdatedAt,10);
 assert.equal(target.notebookIssues.n1.name,'Book 1');
 for(let i=0;i<11;i++)assert.equal(target.notebooks['n'+i].editable.revision,notebookBackupRevision(i===1?originals[i]:incoming[i]));
 const blocked=JSON.parse(await fs.readFile(path.join(root,target.notebooks.n1.editable.path)));
 assert.deepEqual(blocked,originals[1]);assert.deepEqual(await fs.readFile(fullFile(root)),previous);
 assert.equal(target.dataSuccess,false);
 assert.equal((await run(writer,originals.map(n=>note(n.id,n.name,30)))).success,true);
});

test('An older notebook is reported by ID and keeps its backup while other notebooks advance',async()=>{
 const root=await fixture(),writer=createBackupWriter({localDir:root});
 const original=[note('old','Old device',100),note('healthy','Healthy',10)];
 await run(writer,original);const prior=await fs.readFile(fullFile(root));
 const result=await run(writer,[note('old','Old device',50),note('healthy','Healthy',20)]);
 assert.equal(result.success,false);
 const target=result.targets[0];assert.equal(target.notebookIssues.old.error,'newer-backup-exists');
 assert.equal(target.notebookIssues.old.backupUpdatedAt,100);
 assert.equal(target.notebookIssues.old.incomingUpdatedAt,50);
 assert.equal(target.notebooks.healthy.editable.revision,notebookBackupRevision(note('healthy','Healthy',20)));
 assert.deepEqual(await fs.readFile(fullFile(root)),prior);
});


test('Pruning publishes matching active IDs and manifest before deleting obsolete files',async()=>{
 const root=await fixture(),writer=createBackupWriter({localDir:root});await run(writer,[note('a'),note('b')]);
 const result=await writer.execute({action:'prune',notebookIds:['b']});assert.equal(result.success,true);
 const m=JSON.parse(await fs.readFile(path.join(root,'Full_System/backup_manifest.json')));assert.deepEqual(m.activeIds,['a']);assert.equal(Object.hasOwn(m.notebooks,'b'),false);
 const {createBackupReader}=require('../electron/backupReader.cjs');const read=await createBackupReader().execute({folderPath:root});assert.equal(read.success,true);assert.equal(read.count,1);
});
test('Manifest publication failure leaves notebook files untouched during pruning',async()=>{
 const root=await fixture(),writer=createBackupWriter({localDir:root});await run(writer,[note('a'),note('b')]);const file=path.join(root,'Full_System/backup_manifest.json'),prior=JSON.parse(await fs.readFile(file));
 const bfile=path.join(root,prior.notebooks.b.editable.path),before=await fs.readFile(bfile);
 const failing=createBackupWriter({localDir:root,beforeReplace:async({relative})=>{if(relative==='Full_System/backup_manifest.json')throw Object.assign(Error('manifest write failed'),{code:'EIO'});}});
 assert.equal((await failing.execute({action:'prune',notebookIds:['b']})).success,false);assert.deepEqual(await fs.readFile(bfile),before);assert.deepEqual(JSON.parse(await fs.readFile(file)),prior);
});
test('An interrupted file cleanup leaves unindexed old files while the latest snapshot remains restorable',async()=>{
 const root=await fixture(),writer=createBackupWriter({localDir:root});await run(writer,[note('a'),note('b')]);
 const failing=createBackupWriter({localDir:root,fs:{...fs,unlink:async file=>{if(file.endsWith('.bnote'))throw Object.assign(Error('cleanup failed'),{code:'EIO'});return fs.unlink(file);}}});
 assert.equal((await failing.execute({action:'prune',notebookIds:['b']})).success,false);
 const {createBackupReader}=require('../electron/backupReader.cjs'),result=await createBackupReader().execute({folderPath:root});assert.equal(result.success,true);assert.equal(result.count,1);assert.equal(result.data.notebooks[0].id,'a');
});
test('A normal unchanged backup removes only dangling old inactive manifest references',async()=>{
 const root=await fixture(),writer=createBackupWriter({localDir:root});await run(writer,[note('a'),note('b')]);const file=path.join(root,'Full_System/backup_manifest.json'),prior=JSON.parse(await fs.readFile(file));
 await writer.execute({action:'prune',notebookIds:['b']});assert.equal((await run(writer,[note('a')])).success,true);
 const current=JSON.parse(await fs.readFile(file));current.notebooks.b=prior.notebooks.b;await fs.writeFile(file,JSON.stringify(current));const fullBefore=await fs.readFile(fullFile(root));
 assert.equal((await run(createBackupWriter({localDir:root}),[note('a')])).success,true);
 const repaired=JSON.parse(await fs.readFile(file));assert.equal(Object.hasOwn(repaired.notebooks,'b'),false);assert.deepEqual(await fs.readFile(fullFile(root)),fullBefore);
});
test('Inactive files with real retained data and newer staged entries are not removed by reconciliation',async()=>{
 const root=await fixture(),writer=createBackupWriter({localDir:root});await run(writer,[note('a'),note('b')]);assert.equal((await run(writer,[note('a')])).success,true);
 let manifest=JSON.parse(await fs.readFile(path.join(root,'Full_System/backup_manifest.json')));assert.ok(manifest.notebooks.b);assert.ok(JSON.parse(await fs.readFile(fullFile(root))).notebooks.some(note=>note.id==='b'));
 const staged=note('late-stage');
 assert.equal((await writer.execute({action:'begin',jobId:'staged',metadata:meta([staged]),metadataRevision:'staged',phase:'data'})).success,true);
 assert.equal((await writer.execute({action:'notebook',jobId:'staged',notebook:staged,pdfBase64:null,pdfRevision:'pending'})).success,true);
 await writer.execute({action:'abort',jobId:'staged'});
 manifest=JSON.parse(await fs.readFile(path.join(root,'Full_System/backup_manifest.json')));manifest.notebooks['late-stage'].editable.savedAt=Date.now()+60000;
 await fs.unlink(path.join(root,manifest.notebooks['late-stage'].editable.path));
 await fs.writeFile(path.join(root,'Full_System/backup_manifest.json'),JSON.stringify(manifest));assert.equal((await run(createBackupWriter({localDir:root}),[note('a')])).success,true);
 manifest=JSON.parse(await fs.readFile(path.join(root,'Full_System/backup_manifest.json')));assert.ok(manifest.notebooks.b);assert.ok(manifest.notebooks['late-stage']);
});
test('A large full-snapshot budget does not shrink when its small manifest is published',async()=>{
 const root=await fixture(),n=note();n.pdfBase64='x'.repeat(2*1048576);
 const writer=createBackupWriter({localDir:root,deadlineMs:60,beforeReplace:async({relative})=>{if(relative==='Full_System/BetterNote_Latest_Backup.json')await new Promise(resolve=>setTimeout(resolve,300));}});
 const result=await run(writer,[n]);assert.equal(result.success,true);const m=JSON.parse(await fs.readFile(path.join(root,'Full_System/backup_manifest.json')));assert.equal(m.fullSize,(await fs.stat(fullFile(root))).size);
 const {createBackupReader}=require('../electron/backupReader.cjs');assert.equal((await createBackupReader().execute({folderPath:root})).success,true);
});

test('Binary worker snapshot keeps exact note data and attaches a complete binary PDF', async () => {
 const root=await fixture(),writer=createBackupWriter({localDir:root}),n=note(),jobId='binary-qa';
 assert.equal((await writer.execute({action:'begin',jobId,metadata:meta([n]),metadataRevision:'binary',phase:'data'})).success,true);
 const notebookEncoded=new TextEncoder().encode(JSON.stringify(n)).buffer;
 assert.equal((await writer.execute({action:'notebook',jobId,notebookEncoded,pdfRevision:'binary-pages'})).success,true);
 assert.equal((await writer.execute({action:'finish',jobId,metadataRevision:'binary'})).success,true);
 const pdfBytes=new TextEncoder().encode('%PDF-1.7\nsynthetic\n%%EOF').buffer;
 assert.equal((await writer.execute({action:'pdf',jobId,notebookId:n.id,revision:notebookBackupRevision(n),pdfRevision:'binary-pages',pdfBytes})).success,true);
 assert.deepEqual(JSON.parse(await fs.readFile(fullFile(root))).notebooks[0],n);
 const inspected=await writer.execute({action:'inspect',deepVerify:true});assert.equal(inspected.targets[0].notebooks[n.id].pdf.contentRevision,'binary-pages');
});
test('Invalid encoded snapshots and truncated binary PDFs cannot acknowledge or replace valid data', async () => {
 const root=await fixture(),writer=createBackupWriter({localDir:root}),n=note();await run(writer,[n]);
 const before=await fs.readFile(fullFile(root)),jobId='binary-bad';
 await writer.execute({action:'begin',jobId,metadata:meta([n]),metadataRevision:'bad'});
 for(const notebookEncoded of [new ArrayBuffer(0),new TextEncoder().encode('{invalid').buffer,new TextEncoder().encode('{}').buffer,'not-binary'])
  assert.equal((await writer.execute({action:'notebook',jobId,notebookEncoded})).success,false);
 await writer.execute({action:'abort',jobId});
 assert.equal((await writer.execute({action:'pdf',notebookId:n.id,revision:notebookBackupRevision(n),pdfRevision:'bad',pdfBytes:new TextEncoder().encode('%PDF-truncated').buffer})).success,false);
 assert.deepEqual(await fs.readFile(fullFile(root)),before);
});
