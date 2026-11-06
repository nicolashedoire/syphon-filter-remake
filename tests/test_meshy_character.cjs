'use strict';
const assert=require('node:assert/strict');
require('../web/meshy-character.js');
const {Character,parseGLB}=global.SFMeshyCharacter;
function fixture(){
  const pieces=[],views=[],accessors=[];let size=0;
  function add(array,type,componentType,count){
    const data=Buffer.from(array.buffer,array.byteOffset,array.byteLength),padding=(4-size%4)%4;
    if(padding){pieces.push(Buffer.alloc(padding));size+=padding;}
    views.push({buffer:0,byteOffset:size,byteLength:data.length});pieces.push(data);size+=data.length;
    accessors.push({bufferView:views.length-1,componentType,count,type});return accessors.length-1;
  }
  const p=add(new Float32Array([0,0,0, 1,0,0, 0,1,0]),'VEC3',5126,3);
  const n=add(new Float32Array([0,0,1, 0,0,1, 0,0,1]),'VEC3',5126,3);
  const uv=add(new Float32Array([0,0,1,0,0,1]),'VEC2',5126,3);
  const j=add(new Uint8Array(12),'VEC4',5121,3);
  const w=add(new Float32Array([1,0,0,0, 1,0,0,0, 1,0,0,0]),'VEC4',5126,3);
  const indices=add(new Uint16Array([0,1,2]),'SCALAR',5123,3);
  const inv=add(new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),'MAT4',5126,1);
  const times=add(new Float32Array([0,1]),'SCALAR',5126,2);
  const values=add(new Float32Array([0,0,0, 2,0,0]),'VEC3',5126,2);
  const json={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0,1]}],nodes:[{name:'mixamorig:Hips',translation:[0,0,0],children:[2]},{mesh:0,skin:0},{name:'mixamorig:RightHand'}],
    meshes:[{primitives:[{attributes:{POSITION:p,NORMAL:n,TEXCOORD_0:uv,JOINTS_0:j,WEIGHTS_0:w},indices}]}],
    skins:[{inverseBindMatrices:inv,joints:[0]}],animations:[{name:'Move',samplers:[{input:times,output:values}],channels:[{sampler:0,target:{node:0,path:'translation'}}]}],
    accessors,bufferViews:views,buffers:[{byteLength:size}]};
  const jsonRaw=Buffer.from(JSON.stringify(json)),jsonChunk=Buffer.concat([jsonRaw,Buffer.alloc((4-jsonRaw.length%4)%4,0x20)]);
  const raw=Buffer.concat(pieces),binChunk=Buffer.concat([raw,Buffer.alloc((4-raw.length%4)%4)]),header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);
  header.writeUInt32LE(0x46546c67,0);header.writeUInt32LE(2,4);header.writeUInt32LE(12+8+jsonChunk.length+8+binChunk.length,8);
  jh.writeUInt32LE(jsonChunk.length,0);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(binChunk.length,0);bh.writeUInt32LE(0x004e4942,4);
  const all=Buffer.concat([header,jh,jsonChunk,bh,binChunk]);return all.buffer.slice(all.byteOffset,all.byteOffset+all.length);
}
const c=new Character(fixture());
assert.deepEqual(Array.from(c.pose(null,0).vertices.slice(0,3)),[0,0,0]);
let frame=c.pose('Move',.5);assert.equal(frame.vertices[0],1);assert.equal(frame.rightHand[12],1);
assert.deepEqual(Array.from(frame.uv),[0,0,1,0,0,1]);
frame=c.pose('Move',1.5);assert.equal(frame.vertices[0],1);
frame=c.pose('Move',10,{loop:false});assert.equal(frame.vertices[0],2);assert.equal(frame.rightHand[12],2);
frame=c.pose('Move',.5,{inPlace:true});assert.equal(frame.vertices[0],0);assert.equal(frame.rightHand[12],0);
assert.throws(()=>c.pose('Shoot',0),/Unknown animation/);
assert.throws(()=>parseGLB(new ArrayBuffer(12)),/glTF 2/);
console.log('Meshy GLB skinning, animation interpolation, loop, clamping, and hand attachment tests passed');
