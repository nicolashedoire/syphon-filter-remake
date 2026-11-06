// Exercise input axes, animation direction, safe start, and tutorial pause.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function setup(){
  const els={},handlers={},doc={documentElement:{dataset:{}},pointerLockElement:null,addEventListener(k,fn){(handlers[k]??=[]).push(fn)},exitPointerLock(){}};
  function element(id){return els[id]??={textContent:'',innerHTML:'',style:{},hidden:false,events:{},classList:{add(){},remove(){}},querySelector(){return {textContent:''}},addEventListener(k,fn){this.events[k]=fn},focus(){},pause(){},load(){},removeAttribute(){}}}
  doc.getElementById=element;let state,tick,now=0;
  const scene={positions:new Float32Array([10,21.32,-5,75,21.32,-5,75,21.32,60, 10,21.32,-5,75,21.32,60,10,21.32,60])};
  const c={window:null,document:doc,console,Float32Array,Map,Set,Math,Number,Array,SF_SCENE:scene,addEventListener(){},requestAnimationFrame(fn){tick=fn},SFRenderer:class{render(s){state=JSON.parse(JSON.stringify(s));let y=s.cameraYaw,p=s.cameraPitch,eye=[s.player.x+Math.sin(y)*3.8,s.player.y+1.4,s.player.z+Math.cos(y)*3.8];return {eye,target:[eye[0]-Math.sin(y)*Math.cos(p),eye[1]-Math.sin(p),eye[2]-Math.cos(y)*Math.cos(p)]}}}};c.window=c;vm.createContext(c);
  vm.runInContext(fs.readFileSync('web/ps1-rules.js','utf8'),c);vm.runInContext(fs.readFileSync('web/game.js','utf8'),c);
  const step=n=>{for(let i=0;i<n;i++)tick(now+=16)},key=(name,k)=>{for(const fn of handlers[name]||[])fn({key:k,preventDefault(){}})};
  element('start').events.click();step(1);
  return {element,doc,handlers,step,key,get state(){return state}};
}
const expected=[['z',-1,0,Math.PI/2],['s',1,0,-Math.PI/2],['q',0,1,Math.PI],['d',0,-1,0]];
for(const [key,ex,ez,heading] of expected){
  const g=setup(),start={...g.state.player};g.key('keydown',key);g.step(60);g.key('keyup',key);
  const dx=g.state.player.x-start.x,dz=g.state.player.z-start.z;
  assert.ok(dx*ex+dz*ez>5.8,`${key}: moves in the expected camera-relative direction`);
  assert.ok(Math.abs(dx*ez-dz*ex)<.05,`${key}: no movement on the other axis`);
  assert.ok(Math.abs(Math.atan2(Math.sin(g.state.player.angle-heading),Math.cos(g.state.player.angle-heading)))<.05,`${key}: body faces the movement direction`);
  assert.equal(g.state.player.animation,'run');
}
{
 const g=setup(),start={...g.state.player};g.key('keydown','Shift');g.key('keydown','z');g.step(60);g.key('keyup','z');g.key('keyup','Shift');
 assert.ok(start.x-g.state.player.x>1.7&&start.x-g.state.player.x<2,'Walking uses the measured PS1 movement rate');assert.equal(g.state.player.animation,'walk');
}
{
 const g=setup(),before={...g.state.player};g.step(1400);
 assert.equal(g.state.player.health,before.health,'The player does not lose health while idle at spawn');
 assert.equal(g.state.player.armor,before.armor,'The player does not lose armor while idle at spawn');
 g.doc.documentElement.dataset.tutorialOpen='true';g.key('keydown','z');g.step(180);
 assert.equal(g.state.player.x,before.x,'The tutorial pauses player movement');assert.equal(g.state.player.armor,before.armor,'The tutorial pauses enemy damage');
 g.doc.documentElement.dataset.tutorialOpen='false';g.key('keydown','z');g.step(30);g.key('keyup','z');assert.ok(g.state.player.x<before.x-1,'Movement resumes after the tutorial');
}
{
 const g=setup();g.doc.pointerLockElement=g.element('game');g.element('game').events.mousedown({button:0,clientX:0,clientY:0});g.step(1);
 const armor=g.state.player.armor;g.doc.documentElement.dataset.tutorialOpen='true';g.step(500);
 assert.equal(g.state.player.armor,armor,'Combat is paused while reading the tutorial');
 g.doc.documentElement.dataset.tutorialOpen='false';g.step(400);
 assert.ok(g.state.player.armor<armor,'A visible enemy can attack after the engagement grace period');
 assert.equal(g.state.player.health,150,'Incoming damage first affects armor');
}
{
 const g=setup();const move=(x,y)=>{for(const f of g.handlers.mousemove||[])f({target:g.element('game'),clientX:x,clientY:y})};
 const yaw=g.state.cameraYaw;move(200,100);move(230,100);g.step(1);assert.ok(g.state.cameraYaw<yaw,'Mouse look works over the canvas when pointer lock is unavailable');
}
console.log('Movement tests passed: all directions, animation headings, safe spawn, tutorial pause and pointer fallback.');
