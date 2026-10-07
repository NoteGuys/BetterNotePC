const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs').promises, path = require('node:path');
const { createBackupReader } = require('../electron/backupReader.cjs');
const { createBackupWriter } = require('../electron/backupWriter.cjs');
const { createBackupReaderClient } = require('../electron/backupReaderClient.cjs');
const qa = process.env.BETTERNOTE_QA_TEMP;
if (!qa || !path.isAbsolute(qa)) throw Error('Set BETTERNOTE_QA_TEMP to the isolated QA folder.');
const note = (id = 'a', updatedAt = 2) => ({ id, name: 'Same name', updatedAt, pageCount: 1, folderId: null,
  templateId: 'whiteboard', pdfBase64: 'synthetic-original-pdf', pages: [{ id: id + '-page', notebookId: id, pageIndex: 0,
    templateId: 'whiteboard', pageWidth: 1200, pageHeight: 1600, pdfPageImage: 'synthetic-pdf-page',
    strokes: [{ id: 'ink', tool: 'pen', color: '#f00', width: 2, points: [{ x: -50, y: 10, pressure: .5 }, { x: 100, y: 200, pressure: .8 }] }],
    textElements: [{ id: 'text', text: 'Engineering note ทดสอบ', x: 20, y: 30 }],
    imageElements: [{ id: 'image', src: 'data:image/png;base64,cWE=', x: 40, y: 50, width: 80, height: 60, locked: true }]
  }] });
async function fixture() { return fs.mkdtemp(path.join(qa, 'betternote-reader-')); }
async function json(root, relative, value) {
  const file = path.join(root, relative); await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value)); return file;
}
async function legacy(root, notes = [note()], folders = []) {
  return json(root, 'Full_System/BetterNote_Latest_Backup.json', { version: 1, appName: 'BetterNote', folders, notebooks: notes });
}
async function modern(root, notes = [note()]) {
  const writer = createBackupWriter({ localDir: root, driveCandidates: [] });
  const metadata = { folders: [], notebooks: notes.map(({ pages, ...header }) => header) };
  assert.equal((await writer.execute({ action: 'begin', jobId: 'qa-job', metadata, metadataRevision: 'qa-revision', phase: 'data' })).success, true);
  for (const value of notes) assert.equal((await writer.execute({ action: 'notebook', jobId: 'qa-job', notebook: value, pdfRevision: 'pending-pdf' })).success, true);
  assert.equal((await writer.execute({ action: 'finish', jobId: 'qa-job', metadataRevision: 'qa-revision' })).success, true);
  return JSON.parse(await fs.readFile(path.join(root, 'Full_System/backup_manifest.json')));
}
const read = (root, options = {}) => createBackupReader().execute({ folderPath: root, ...options });
const expectBlocked = (result, reason) => { assert.equal(result.success, false); assert.equal(result.reason, reason); assert.equal(result.data, undefined); };

test('Chosen folder never falls back to a valid backup somewhere else', async () => {
  const root = await fixture(); await legacy(root);
  expectBlocked(await read(path.join(root, 'missing'), { candidates: [root] }), 'not-found');
  expectBlocked(await read('relative-path', { candidates: [root] }), 'absolute-backup-folder-required');
});
test('Discovery requires a choice instead of merging different destinations', async () => {
  const root = await fixture(), a = path.join(root, 'A'), b = path.join(root, 'B');
  await legacy(a, [note('a')]); await legacy(b, [note('b')]);
  const result = await createBackupReader().execute({ candidates: [a, b] });
  expectBlocked(result, 'backup-folder-choice-required'); assert.equal(result.folders.length, 2);
  assert.deepEqual((await read(a)).data.notebooks.map(n => n.id), ['a']);
});
test('Discovery does not bypass an incomplete destination in favour of a stale one', async () => {
  const root = await fixture(), a = path.join(root, 'A'), b = path.join(root, 'B');
  await legacy(a); await json(b, 'Full_System/BetterNote_Latest_Backup.json', { notebooks: 'partial' });
  expectBlocked(await createBackupReader().execute({ candidates: [a, b] }), 'backup-folder-choice-required');
});
test('A single discovered destination is fully checked before returning recovery data', async () => {
  const root = await fixture(); await legacy(root);
  const result = await createBackupReader().execute({ candidates: [path.join(root, 'missing'), root, root] });
  assert.equal(result.success, true); assert.equal(result.verification, 'content-checked'); assert.equal(result.data.notebooks.length, 1);
});
test('A newer editable notebook wins over an older full-system snapshot', async () => {
  const root = await fixture(), previous = note('a', 1), current = note('a', 3);
  current.pages[0].strokes.push({ id: 'new', points: [{ x: 70, y: 30 }] });
  await legacy(root, [previous]); await json(root, 'Editable_Notes/latest.bnote', current);
  const result = await read(root); assert.equal(result.success, true); assert.deepEqual(result.data.notebooks, [current]);
});
test('An older editable file cannot replace a newer complete snapshot', async () => {
  const root = await fixture(), current = note('a', 5); current.name = 'Latest';
  await legacy(root, [current]); await json(root, 'Editable_Notes/old.bnote', note('a', 1));
  assert.deepEqual((await read(root)).data.notebooks, [current]);
});
test('Matching ID and edit time with different content is a conflict, never guessed', async () => {
  const root = await fixture(), changed = note(); changed.pages[0].strokes = [];
  await legacy(root); await json(root, 'Editable_Notes/conflict.bnote', changed);
  const result = await read(root); expectBlocked(result, 'backup-conflict'); assert.equal(result.issues[0].id, 'a');
});
test('Same-name notebooks with different IDs remain distinct', async () => {
  const root = await fixture(); await legacy(root, [note('a'), note('b')]);
  assert.deepEqual((await read(root)).data.notebooks.map(n => n.id), ['a', 'b']);
});
test('Equal content with different property order or cached thumbnail is not a conflict', async () => {
  const root = await fixture(), original = note(); await legacy(root, [original]);
  const reordered = Object.fromEntries(Object.entries(original).reverse()); reordered.thumbnailUrl = 'cached-thumbnail';
  await json(root, 'Editable_Notes/copy.bnote', reordered); assert.equal((await read(root)).success, true);
});
test('Recovery preserves strokes, locked images, text, PDF background and whiteboard coordinates', async () => {
  const root = await fixture(), original = note(); await modern(root, [original]);
  const result = await read(root); assert.equal(result.success, true); assert.deepEqual(result.data.notebooks, [original]);
});
test('Legacy pages missing linkage/index are normalized without inventing a blank page', async () => {
  const root = await fixture(), original = note(); delete original.pageCount;
  delete original.pages[0].notebookId; delete original.pages[0].pageIndex; await legacy(root, [original]);
  const restored = (await read(root)).data.notebooks[0];
  assert.equal(restored.pageCount, 1); assert.equal(restored.pages[0].notebookId, 'a');
  assert.equal(restored.pages[0].pageIndex, 0); assert.deepEqual(restored.pages[0].strokes, original.pages[0].strokes);
});
for (const [name, mutate] of [
  ['empty pages', n => { n.pages = []; n.pageCount = 0; }],
  ['mismatched page count', n => { n.pageCount = 2; }],
  ['wrong page owner', n => { n.pages[0].notebookId = 'another-note'; }],
  ['missing page identity', n => { delete n.pages[0].id; }],
  ['duplicate page indexes', n => { n.pages.push({ ...n.pages[0], id: 'other' }); n.pageCount = 2; }],
  ['invalid stroke array', n => { n.pages[0].strokes = 'broken'; }],
  ['null image object', n => { n.pages[0].imageElements = [null]; }],
  ['invalid handwriting coordinates', n => { n.pages[0].strokes[0].points[0].x = null; }],
  ['invalid page dimensions', n => { n.pages[0].pageWidth = 'wide'; }],
  ['invalid text content', n => { n.pages[0].textElements[0].text = { unexpected: true }; }],
  ['invalid edit time', n => { n.updatedAt = 'yesterday'; }]
]) test('Rejects ' + name + ' before exposing any recovery payload', async () => {
  const root = await fixture(), broken = note(); mutate(broken); await legacy(root, [broken]);
  expectBlocked(await read(root), 'invalid-backup-data');
});
test('Page IDs must also be unique across notebooks', async () => {
  const root = await fixture(), a = note('a'), b = note('b'); b.pages[0].id = a.pages[0].id;
  await legacy(root, [a, b]); expectBlocked(await read(root), 'invalid-backup-data');
});
test('Duplicate notebook IDs inside a full snapshot cannot silently replace one another', async () => {
  const root = await fixture(); await legacy(root, [note(), note()]); expectBlocked(await read(root), 'invalid-backup-data');
});
test('Missing folders and folder cycles block incomplete libraries', async () => {
  const root = await fixture(), value = note(); value.folderId = 'missing'; await legacy(root, [value]);
  expectBlocked(await read(root), 'backup-incomplete');
  await legacy(root, [note()], [{ id: 'f1', parentId: 'f2' }, { id: 'f2', parentId: 'f1' }]);
  expectBlocked(await read(root), 'invalid-backup-data');
});
test('Truncated JSON blocks the whole selection rather than silently skipping a notebook', async () => {
  const root = await fixture(); await legacy(root); const file = await json(root, 'Editable_Notes/truncated.bnote', note('b'));
  await fs.writeFile(file, '{"id":'); expectBlocked(await read(root), 'invalid-backup-data');
});
test('Only notebook files in the selected backup are inspected; temporary/history files are ignored', async () => {
  const root = await fixture(); await legacy(root);
  await json(root, 'Editable_Notes/.history/old.bnote', { broken: true });
  await json(root, 'Editable_Notes/new.bnote.pending-123', { broken: true });
  await json(root, 'Editable_Notes/nested/not-selected.bnote', { broken: true });
  assert.equal((await read(root)).count, 1);
});
test('A linked backup file resolving outside the selected root is refused', async () => {
  const root = await fixture(); const full = await legacy(root);
  const reader = createBackupReader({ fs: { ...fs, realpath: async file => file === full ? path.join(path.dirname(root), 'outside.json') : fs.realpath(file) } });
  expectBlocked(await reader.execute({ folderPath: root }), 'unsafe-backup-path');
});
test('Manifest preview reads metadata only, never images/strokes/full-system JSON', async () => {
  const root = await fixture(); await modern(root);
  const reads = [], reader = createBackupReader({ fs: { ...fs, open: async (...args) => {
    reads.push(args[0]); if (!args[0].endsWith('backup_manifest.json')) throw Error('Heavy payload read during preview'); return fs.open(...args);
  } } });
  const result = await reader.execute({ folderPath: root, previewOnly: true });
  assert.equal(result.success, true); assert.equal(result.verification, 'metadata-only');
  assert.equal(result.data, undefined); assert.equal(result.notebooks[0].id, 'a'); assert.equal(reads.length, 1);
  assert.ok(!JSON.stringify(result).includes('synthetic-original-pdf'));
});
test('A missing advertised notebook cannot fall back to the full snapshot', async () => {
  const root = await fixture(), manifest = await modern(root); await fs.unlink(path.join(root, manifest.notebooks.a.editable.path));
  expectBlocked(await read(root), 'backup-incomplete'); expectBlocked(await read(root, { previewOnly: true }), 'backup-incomplete');
});
test('A same-size changed notebook fails the content hash check even after a successful preview', async () => {
  const root = await fixture(), manifest = await modern(root); assert.equal((await read(root, { previewOnly: true })).success, true);
  const file = path.join(root, manifest.notebooks.a.editable.path), bytes = await fs.readFile(file, 'utf8');
  await fs.writeFile(file, bytes.replace('Engineering', 'Xngineering')); expectBlocked(await read(root), 'backup-incomplete');
});
test('A newly arriving full-system file cannot be accepted against an older manifest', async () => {
  const root = await fixture(); await modern(root);
  const full = path.join(root, 'Full_System/BetterNote_Latest_Backup.json'), bytes = await fs.readFile(full, 'utf8');
  await fs.writeFile(full, bytes.replace('Engineering', 'Xngineering')); expectBlocked(await read(root), 'backup-incomplete');
});
test('A manifest conflict is reported instead of importing only the other notebooks', async () => {
  const root = await fixture(), manifest = await modern(root, [note('a'), note('b')]);
  manifest.notebooks.a.backupConflict = { error: 'newer-backup-exists' }; await json(root, 'Full_System/backup_manifest.json', manifest);
  expectBlocked(await read(root), 'backup-conflict');
});
test('Manifest path traversal cannot read another directory', async () => {
  const root = await fixture(), manifest = await modern(root); manifest.notebooks.a.editable.path = '../outside.bnote';
  await json(root, 'Full_System/backup_manifest.json', manifest); expectBlocked(await read(root), 'invalid-backup-manifest');
});
test('A complete snapshot with no manifest remains compatible with old backups', async () => {
  const root = await fixture(); await legacy(root); assert.equal((await read(root)).success, true);
});
test('Standalone legacy notebooks can be recovered when they need no missing folders', async () => {
  const root = await fixture(); await json(root, 'Editable_Notes/a.bnote', note());
  assert.equal((await read(root)).success, true);
});
test('Legacy summary cache skips content reads until a file changes', async () => {
  const root = await fixture(); await legacy(root); let reads = 0;
  const reader = createBackupReader({ fs: { ...fs, open: async (...args) => { reads++; return fs.open(...args); } } });
  const first = await reader.execute({ folderPath: root, previewOnly: true }); assert.equal(first.data, undefined);
  const previous = reads; await reader.execute({ folderPath: root, previewOnly: true }); assert.equal(reads, previous);
  const changed = note('a', 10); changed.name = 'Changed name'; await legacy(root, [changed]);
  const next = await reader.execute({ folderPath: root, previewOnly: true }); assert.ok(reads > previous); assert.equal(next.notebooks[0].name, 'Changed name');
});
test('A file changed during reading does not produce a mixed recovery snapshot', async () => {
  const root = await fixture(), full = await legacy(root);
  const reader = createBackupReader({ fs: { ...fs, open: async (...args) => {
    if (args[0] === full) await fs.appendFile(full, ' '); return fs.open(...args);
  } } });
  expectBlocked(await reader.execute({ folderPath: root }), 'backup-changed-during-read');
});
test('An unavailable virtual drive has a bounded timeout instead of hanging recovery', async () => {
  const root = await fixture(); await legacy(root);
  const reader = createBackupReader({ deadlineMs: 20, fs: { ...fs, open: () => new Promise(() => {}) } });
  expectBlocked(await reader.execute({ folderPath: root }), 'backup-read-timeout');
});
test('Size limits reject oversized input before attempting its content read', async () => {
  const root = await fixture(); await legacy(root); let reads = 0;
  const reader = createBackupReader({ maxFileBytes: 32, fs: { ...fs, readFile: async (...args) => { reads++; return fs.readFile(...args); } } });
  expectBlocked(await reader.execute({ folderPath: root }), 'backup-too-large'); assert.equal(reads, 0);
});
test('Actual reader worker validates data and coalesces identical concurrent requests', async () => {
  const root = await fixture(); await modern(root); const client = createBackupReaderClient();
  try {
    const command = { folderPath: root, previewOnly: true }, one = client.execute(command), two = client.execute(command);
    assert.equal(one, two); assert.equal((await one).success, true);
    const loaded = await client.execute({ folderPath: root }); assert.equal(loaded.verification, 'content-checked'); assert.deepEqual(loaded.data.notebooks, [note()]);
  } finally { await client.close(); }
});
test('Closing the reader cannot report an abandoned scan as success, and a fresh worker can restart', async () => {
  const root = await fixture(); await legacy(root); const client = createBackupReaderClient();
  const pending = client.execute({ folderPath: root }); await client.close(); expectBlocked(await pending, 'backup-reader-unavailable');
  try { assert.equal((await client.execute({ folderPath: root })).success, true); } finally { await client.close(); }
});
test('Reader worker timeout terminates outstanding work without a late success', async () => {
  const root = await fixture(); await legacy(root); const client = createBackupReaderClient({ timeoutMs: 1 });
  try { expectBlocked(await client.execute({ folderPath: root }), 'backup-read-timeout'); } finally { await client.close(); }
});

test('Current writer partial round keeps the old complete snapshot, but recovery selects the newer editable version', async () => {
  const root = await fixture(), previous = note('a', 2); await modern(root, [previous]);
  const next = note('a', 9); next.pages[0].strokes.push({ id: 'fresh', points: [{ x: 20, y: 30 }] });
  const writer = createBackupWriter({ localDir: root });
  const metadata = { folders: [], notebooks: [{ ...next, pages: undefined }] };
  await writer.execute({ action: 'begin', jobId: 'partial', metadata, metadataRevision: 'next', phase: 'data' });
  assert.equal((await writer.execute({ action: 'notebook', jobId: 'partial', notebook: next, pdfRevision: 'pending' })).success, true);
  const oldFull = JSON.parse(await fs.readFile(path.join(root, 'Full_System/BetterNote_Latest_Backup.json')));
  assert.equal(oldFull.notebooks[0].updatedAt, 2);
  const result = await read(root); assert.equal(result.success, true); assert.deepEqual(result.data.notebooks[0], next);
  await writer.execute({ action: 'abort', jobId: 'partial' });
});
test('A legitimate notebook name with consecutive dots is still readable', async () => {
  const root = await fixture(), original = note(); original.name = 'Chapter..2'; await modern(root, [original]);
  assert.equal((await read(root)).success, true);
});

test('A file growing between the size check and open is rejected without reading beyond the budget', async () => {
  const root = await fixture(), full = await legacy(root); let reads = 0;
  const reader = createBackupReader({ fs: { ...fs, open: async (...args) => {
    if (args[0] === full) await fs.appendFile(full, ' '.repeat(1024));
    const handle = await fs.open(...args), original = handle.read.bind(handle);
    handle.read = (...readArgs) => { reads++; return original(...readArgs); }; return handle;
  } } });
  expectBlocked(await reader.execute({ folderPath: root }), 'backup-changed-during-read');assert.equal(reads, 0);
});

test('Windows filename case changes cannot make a valid notebook disappear from recovery', { skip: process.platform !== 'win32' }, async () => {
  const root = await fixture(), manifest = await modern(root), source = path.join(root, manifest.notebooks.a.editable.path);
  await fs.rename(source, path.join(path.dirname(source), path.basename(source).toUpperCase()));
  assert.equal((await read(root)).success, true);
});


test('Packaged reader uses its shared validator without any development src directory', async () => {
 const root=await fixture(),app=path.join(root,'packaged-app'),folder=path.join(root,'selected');
 await fs.mkdir(path.join(app,'electron'),{recursive:true});await fs.writeFile(path.join(app,'package.json'),JSON.stringify({type:'module'}));
 for(const file of ['backupReader.cjs','backupReader.worker.cjs','backupReaderClient.cjs','backupValidation.js'])
   await fs.copyFile(path.join(__dirname,'../electron',file),path.join(app,'electron',file));
 await legacy(folder);
 const {createBackupReaderClient:packaged}=require(path.join(app,'electron/backupReaderClient.cjs'));const client=packaged();
 try{const result=await client.execute({folderPath:folder});assert.equal(result.success,true);assert.equal(result.data.notebooks[0].id,'a');}
 finally{await client.close();}
});


test('Verified v2 notebooks with deleted folder references restore to Documents with their full content', async () => {
  const root=await fixture(),a=note('a',2),b=note('b',3);a.folderId='deleted-folder';b.folderId='another-deleted-folder';
  const manifest=await modern(root,[a,b]),before=await fs.readFile(path.join(root,'Full_System/backup_manifest.json'),'utf8');
  const result=await read(root);assert.equal(result.success,true);assert.deepEqual(result.recoveredFolderNotebookIds,['a','b']);
  for(const restored of result.data.notebooks){const original=restored.id==='a'?a:b;assert.equal(restored.folderId,null);assert.ok(restored.updatedAt>original.updatedAt);assert.deepEqual(restored.pages,original.pages);}
  assert.equal(await fs.readFile(path.join(root,'Full_System/backup_manifest.json'),'utf8'),before);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(root,manifest.notebooks.a.editable.path),'utf8')),a);
});
test('A complete current manifest ignores archived duplicate, unrelated and damaged old filenames', async () => {
  const root=await fixture();await modern(root);await json(root,'Editable_Notes/old-name.bnote',{...note('a',20),folderId:'old-folder'});
  await json(root,'Editable_Notes/unrelated-old.bnote',note('archived',50));await fs.writeFile(path.join(root,'Editable_Notes/truncated-old.bnote'),'{');
  const opened=[],reader=createBackupReader({fs:{...fs,open:async(...args)=>{opened.push(path.basename(args[0]));return fs.open(...args);}}});
  const result=await reader.execute({folderPath:root});assert.equal(result.success,true);assert.equal(result.data.notebooks.length,1);assert.equal(result.data.notebooks[0].id,'a');
  for(const file of ['old-name.bnote','unrelated-old.bnote','truncated-old.bnote'])assert.ok(!opened.includes(file));
});
test('Orphan folder compatibility never bypasses an invalid folder hierarchy or damaged tracked notebook', async () => {
  const root=await fixture(),a=note();a.folderId='deleted-folder';const manifest=await modern(root,[a]);
  const artifact=path.join(root,manifest.notebooks.a.editable.path),raw=await fs.readFile(artifact,'utf8');
  await fs.writeFile(artifact,raw.replace('Engineering','Xngineering'));expectBlocked(await read(root),'backup-incomplete');
  await fs.writeFile(artifact,raw);const fullFile=path.join(root,'Full_System/BetterNote_Latest_Backup.json'),full=JSON.parse(await fs.readFile(fullFile,'utf8'));
  full.folders=[{id:'child',parentId:'missing-parent'}];const bytes=Buffer.from(JSON.stringify(full));await fs.writeFile(fullFile,bytes);
  manifest.fullSize=bytes.length;manifest.fullHash=require('node:crypto').createHash('sha256').update(bytes).digest('hex');await json(root,'Full_System/backup_manifest.json',manifest);
  expectBlocked(await read(root),'backup-incomplete');
});
test('Matching full-snapshot notebooks verify their editable hashes with a bounded 1 MiB buffer', async () => {
  const root=await fixture(),a=note();a.pdfBase64='x'.repeat(3*1048576);const manifest=await modern(root,[a]);let largest=0;
  const artifact=path.join(root,manifest.notebooks.a.editable.path),reader=createBackupReader({fs:{...fs,open:async(...args)=>{
    const handle=await fs.open(...args);if(args[0]===artifact){const read=handle.read.bind(handle);handle.read=(buffer,...rest)=>{largest=Math.max(largest,buffer.length);return read(buffer,...rest);};}return handle;
  }}});
  const result=await reader.execute({folderPath:root});assert.equal(result.success,true);assert.equal(result.data.notebooks[0].pdfBase64.length,a.pdfBase64.length);assert.ok(largest>0&&largest<=1048576);
});
test('A progressing cold Drive read may exceed the old five-second per-operation deadline', async () => {
  const root=await fixture();await modern(root);let delayed=false;
  const reader=createBackupReader({fs:{...fs,open:async(...args)=>{if(!delayed){delayed=true;await new Promise(resolve=>setTimeout(resolve,5100));}return fs.open(...args);}}});
  assert.equal((await reader.execute({folderPath:root})).success,true);
});


test('A recovered folder relocation can be backed up again without an equal-time conflict', async () => {
 const root=await fixture(),original=note();original.folderId='deleted-folder';await modern(root,[original]);const recovered=await read(root);assert.equal(recovered.success,true);
 const writer=createBackupWriter({localDir:root,driveCandidates:[]}),data=recovered.data,metadata={folders:data.folders,notebooks:data.notebooks.map(({pages,...header})=>header)};
 assert.equal((await writer.execute({action:'begin',jobId:'after-recovery',metadata,metadataRevision:'after-recovery',phase:'data'})).success,true);
 assert.equal((await writer.execute({action:'notebook',jobId:'after-recovery',notebook:data.notebooks[0],pdfRevision:'pending'})).success,true);
 assert.equal((await writer.execute({action:'finish',jobId:'after-recovery',metadataRevision:'after-recovery'})).success,true);
 const second=await read(root);assert.equal(second.success,true);assert.deepEqual(second.recoveredFolderNotebookIds,[]);assert.equal(second.data.notebooks[0].folderId,null);
});


test('A trusted retained full-snapshot notebook with a reserved object-key ID remains recoverable',async()=>{
 const root=await fixture(),manifest=await modern(root),fullFile=path.join(root,'Full_System/BetterNote_Latest_Backup.json'),full=JSON.parse(await fs.readFile(fullFile,'utf8'));
 full.notebooks.push(note('constructor'));const bytes=Buffer.from(JSON.stringify(full));await fs.writeFile(fullFile,bytes);manifest.fullSize=bytes.length;manifest.fullHash=require('node:crypto').createHash('sha256').update(bytes).digest('hex');await json(root,'Full_System/backup_manifest.json',manifest);
 const result=await read(root);assert.equal(result.success,true);assert.equal(result.count,2);assert.ok(result.data.notebooks.some(note=>note.id==='constructor'));
});


async function staleDeletedEntriesFixture() {
 const root=await fixture(),a=note('active'),b=note('retired-1'),c=note('retired-2'),prior=await modern(root,[a,b,c]);
 const writer=createBackupWriter({localDir:root,driveCandidates:[]});assert.equal((await writer.execute({action:'prune',notebookIds:[b.id,c.id]})).success,true);
 const metadata={folders:[],notebooks:[{...a,pages:undefined}]};
 assert.equal((await writer.execute({action:'begin',jobId:'new-current',metadata,metadataRevision:'new-current',phase:'data'})).success,true);
 assert.equal((await writer.execute({action:'reuse',jobId:'new-current',notebook:a})).success,true);
 assert.equal((await writer.execute({action:'finish',jobId:'new-current',metadataRevision:'new-current'})).success,true);
 const file=path.join(root,'Full_System/backup_manifest.json'),manifest=JSON.parse(await fs.readFile(file,'utf8'));
 manifest.notebooks[b.id]=prior.notebooks[b.id];manifest.notebooks[c.id]=prior.notebooks[c.id];await json(root,'Full_System/backup_manifest.json',manifest);
 return {root,a,b,c,manifest,file};
}
test('Restore ignores only old inactive missing list entries absent from a verified committed snapshot',async()=>{
 const {root,a,file}=await staleDeletedEntriesFixture(),before=await fs.readFile(file,'utf8');
 const preview=await read(root,{previewOnly:true});assert.equal(preview.success,true);assert.equal(preview.count,1);assert.equal(preview.inactiveEntriesPendingCheck,2);
 const restored=await read(root);assert.equal(restored.success,true);assert.equal(restored.count,1);assert.deepEqual(restored.data.notebooks,[a]);assert.deepEqual(restored.ignoredRetiredNotebookIds,['retired-1','retired-2']);
 assert.equal(await fs.readFile(file,'utf8'),before);
});
test('A missing current file still blocks Restore even with a valid full snapshot',async()=>{
 const {root,a,manifest}=await staleDeletedEntriesFixture();await fs.unlink(path.join(root,manifest.notebooks[a.id].editable.path));expectBlocked(await read(root),'backup-incomplete');
});
test('Missing inactive data that is still in the complete snapshot remains protected',async()=>{
 const root=await fixture(),manifest=await modern(root,[note('a'),note('b')]);manifest.activeIds=['a'];await json(root,'Full_System/backup_manifest.json',manifest);
 await fs.unlink(path.join(root,manifest.notebooks.b.editable.path));expectBlocked(await read(root),'backup-incomplete');
});
test('Without explicit committed scope and times, missing entries cannot be treated as retired',async()=>{
 for(const mutate of [m=>delete m.activeIds,m=>m.fullRevision=null,m=>delete m.lastDataSuccess,m=>delete m.notebooks['retired-1'].editable.savedAt]){
  const {root,manifest}=await staleDeletedEntriesFixture();mutate(manifest);await json(root,'Full_System/backup_manifest.json',manifest);expectBlocked(await read(root),'backup-incomplete');
 }
});
test('A newer staged notebook must not be skipped when its file is still downloading',async()=>{
 const {root,manifest}=await staleDeletedEntriesFixture();manifest.notebooks['retired-1'].editable.savedAt=manifest.lastDataSuccess+1;await json(root,'Full_System/backup_manifest.json',manifest);expectBlocked(await read(root),'backup-incomplete');
});
test('A tampered full snapshot cannot authorize ignoring any missing old entry',async()=>{
 const {root}=await staleDeletedEntriesFixture(),file=path.join(root,'Full_System/BetterNote_Latest_Backup.json'),raw=await fs.readFile(file,'utf8');await fs.writeFile(file,raw.replace('Engineering','Xngineering'));expectBlocked(await read(root),'backup-incomplete');
});
test('An inactive editable file that exists remains recoverable rather than being discarded by scope',async()=>{
 const {root,b,manifest}=await staleDeletedEntriesFixture();await json(root,manifest.notebooks[b.id].editable.path,b);
 const result=await read(root);assert.equal(result.success,true);assert.ok(result.data.notebooks.some(n=>n.id===b.id));assert.deepEqual(result.ignoredRetiredNotebookIds,['retired-2']);
});
