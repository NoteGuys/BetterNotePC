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
  const n = note(), result = await run(writer, [n], { customBackupPath: drive });
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
test('An unreachable selected target reports partial results while local backup succeeds', async () => {
  const root=await fixture(), destination=await fixture();
  await fs.writeFile(path.join(destination,'blocked'),'not a directory');
  const result=await run(createBackupWriter({localDir:root}),[note()],{customBackupPath:path.join(destination,'blocked')});
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
 await run(writer,[note()],{customBackupPath:drive});const before=await fs.readFile(fullFile(drive));
 let release;const gate=new Promise(resolve=>release=resolve);
 const slow=createBackupWriter({localDir:local,deadlineMs:150,beforeReplace:async({file,relative})=>{
  if(file.toLowerCase().startsWith(drive.toLowerCase()+path.sep)&&relative.endsWith('.bnote'))await gate;
 }});
 const changed=note('n1','Example',20);await slow.execute({action:'begin',jobId:'case-job',metadata:meta([changed]),customBackupPath:drive});
 await slow.execute({action:'notebook',jobId:'case-job',notebook:changed,pdfBase64:pdf});
 const inspected=await slow.execute({action:'inspect',customBackupPath:drive.toUpperCase()});
 assert.equal(inspected.targets[1].error,'destination-busy');release();await new Promise(resolve=>setTimeout(resolve,60));
 assert.deepEqual(await fs.readFile(fullFile(drive)),before);await slow.execute({action:'abort',jobId:'case-job'});
});