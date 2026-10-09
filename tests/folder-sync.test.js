import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileFolders,folderToken} from '../electron/folderSyncProtocol.js';
const f=(id,extra={})=>({id,name:id,parentId:null,createdAt:10,updatedAt:10,...extra});
test('Permanent deletion survives an older restore and a peer with a faster clock',()=>{
 const gone=f('gone',{isDeleted:true,permanentlyDeleted:true,updatedAt:20});
 for(const [local,remote] of [[[gone],[f('gone',{updatedAt:999999})]],[[f('gone',{updatedAt:999999})],[gone]]]) {
  const plan=reconcileFolders(local,remote);assert.equal(plan.folders[0].permanentlyDeleted,true);assert.equal(plan.destination('gone'),null);
 }
});
test('Children of deleted folders move to the nearest live ancestor without losing their identity',()=>{
 const plan=reconcileFolders([f('root'),f('gone',{parentId:'root'}),f('child',{parentId:'gone'})],[f('gone',{isDeleted:true,permanentlyDeleted:true,restoreParentId:'root',updatedAt:20})]);
 assert.equal(plan.folders.find(f=>f.id==='child').parentId,'root');assert.equal(plan.destination('gone'),'root');
});
test('Known source metadata is received causally even when its clock moved backwards',()=>{
 const old=f('a',{updatedAt:500,name:'Old'}),fresh=f('a',{updatedAt:2,name:'New'});
 const plan=reconcileFolders([old],[fresh],{a:{local:folderToken(old),remote:folderToken(old)}});
 assert.equal(plan.folders[0].name,'New');
});
test('Local metadata edit survives an unchanged source',()=>{
 const old=f('a'),local=f('a',{name:'Local',updatedAt:30});
 assert.equal(reconcileFolders([local],[old],{a:{local:folderToken(old),remote:folderToken(old)}}).folders[0].name,'Local');
});
test('Legacy sample collision preserves both installations and rewires only local children',()=>{
 const local=f('folder-demo-1',{name:'Lecture Notes',createdAt:20}),incoming=f('folder-demo-1',{name:'My original root',createdAt:10});
 const plan=reconcileFolders([local,f('local-child',{parentId:local.id})],[incoming,f('source-child',{parentId:incoming.id})]);
 const relocated=plan.remaps[local.id];assert.ok(relocated);assert.equal(plan.folders.find(f=>f.id===relocated).name,'Lecture Notes');
 assert.equal(plan.folders.find(f=>f.id==='local-child').parentId,relocated);assert.equal(plan.folders.find(f=>f.id==='source-child').parentId,incoming.id);
 assert.equal(plan.folders.find(f=>f.id===incoming.id).name,'My original root');
 const again=reconcileFolders(plan.folders,[incoming]);assert.deepEqual(Object.keys(again.remaps),[]);assert.equal(again.folders.length,plan.folders.length);
});
test('Cycles and unavailable parents cannot create unreachable folder trees',()=>{
 const plan=reconcileFolders([],[f('a',{parentId:'b'}),f('b',{parentId:'a'}),f('orphan',{parentId:'missing'})]);
 assert.equal(plan.folders.find(f=>f.id==='orphan').parentId,null);assert.ok(plan.folders.some(f=>['a','b'].includes(f.id)&&!f.parentId));
});

test('Moving a folder to Trash retains its nested hierarchy for an explicit undo',()=>{
 const plan=reconcileFolders([f('parent'),f('child',{parentId:'parent'})],[f('parent',{isDeleted:true,updatedAt:20})]);
 assert.equal(plan.folders.find(f=>f.id==='child').parentId,'parent');
});

test('Reserved folder IDs cannot be mistaken for inherited map properties',()=>{
 for(const id of ['constructor','__proto__','toString']) {
  const plan=reconcileFolders([f(id),f('child',{parentId:id})],[]);
  assert.equal(plan.folders.find(f=>f.id==='child').parentId,id);assert.equal(plan.destination(id),id);
 }
});
