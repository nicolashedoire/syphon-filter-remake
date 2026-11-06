// The second-level export is independent of Georgia Street and contains only terrain.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={window:{},Float32Array};
vm.runInNewContext(fs.readFileSync('web/assets/subway2-textured.js','utf8'),context);
const t=context.window.SF_SUBWAY2_TERRAIN;
assert.ok(t&&t.positions&&t.uvs,'The separate SUBWAY2 terrain asset loads');
assert.equal(context.window.SF_TEXTURED_SCENE,undefined,'The asset does not replace the Georgia scene');
assert.equal(t.positions.length/9,12349,'Original terrain triangles are present');
assert.equal(t.uvs.length,t.positions.length/3*2,'Every vertex has a texture coordinate');
assert.ok(t.positions.every(Number.isFinite)&&t.uvs.every(Number.isFinite),'Geometry values are finite');
assert.ok(t.uvs.every(value=>value>=0&&value<=1),'Texture coordinates lie within the atlas');
assert.equal(t.rooms.length,23);assert.equal(t.initialRoom,19);assert.equal(t.visibility.length,23);
let next=0;
for(let i=0;i<t.rooms.length;i++){
 const room=t.rooms[i];assert.equal(room.start,next);assert.equal(room.count%3,0);next+=room.count;
 assert.ok(room.min.every((value,j)=>value<=room.max[j]),'Room bounds are valid');
 assert.ok(t.visibility[i].every(value=>value>=0&&value<t.rooms.length),'Visibility indices are valid');
}
assert.equal(next,t.positions.length/3,'Room ranges cover the terrain');
const atlas=Buffer.from(t.atlas.split(',')[1],'base64');
assert.equal(atlas.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
assert.equal(atlas.readUInt32BE(16),1024);assert.equal(atlas.readUInt32BE(20),2048);
assert.equal(Object.keys(t.materials).length,20);
console.log('French SUBWAY2 terrain, UV atlas and room visibility checks passed.');
