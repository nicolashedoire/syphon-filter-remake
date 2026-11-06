// Check the original PS1 animation asset is consistent with Gabe's triangle order.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = {window:{},Float32Array,Uint8Array,Uint16Array};
vm.runInNewContext(fs.readFileSync('web/assets/characters.js', 'utf8'),context);
vm.runInNewContext(fs.readFileSync('web/assets/animations.js', 'utf8'),context);
const vertices = context.window.SF_CHARACTERS.gabe.positions.length;
for(const [name, expected, fps] of [['idle',40,7.5],['walk',25,30],['run',14,30]]){
 const clip=context.window.SF_ANIMATIONS.gabe[name];
 assert.equal(clip.frames.length,expected,`${name}: frame count`);
 assert.equal(clip.fps,fps,`${name}: sampling rate`);
 for(const frame of clip.frames){
  assert.equal(frame.length,vertices,`${name}: vertex ordering`);
  let minY=Infinity,maxY=-Infinity,maxX=0,maxZ=0;
  for(let i=0;i<frame.length;i+=3){
   assert.ok(Number.isFinite(frame[i])&&Number.isFinite(frame[i+1])&&Number.isFinite(frame[i+2]));
   minY=Math.min(minY,frame[i+1]);maxY=Math.max(maxY,frame[i+1]);maxX=Math.max(maxX,Math.abs(frame[i]));maxZ=Math.max(maxZ,Math.abs(frame[i+2]));
  }
  assert.ok(Math.abs(minY)<0.001,`${name}: ground alignment`);
  assert.ok(maxY>1.2&&maxY<2.5&&maxX<2&&maxZ<2,`${name}: local pose without world movement`);
 }
 assert.ok(clip.frames[0].some((v,i)=>v!==clip.frames[Math.floor(expected/2)][i]),`${name}: poses change`);
}
console.log('Original PS1 character animation checks passed.');
