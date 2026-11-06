// Exercise input axes, animation direction, safe start, and tutorial pause.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function setup(extraGeometry=[]){
  const els={},handlers={},doc={documentElement:{dataset:{}},pointerLockElement:null,addEventListener(k,fn){(handlers[k]??=[]).push(fn)},exitPointerLock(){}};
  function element(id){return els[id]??={textContent:'',innerHTML:'',style:{},hidden:false,events:{},classList:{add(){},remove(){}},querySelector(){return {textContent:''}},addEventListener(k,fn){this.events[k]=fn},focus(){},pause(){},load(){},removeAttribute(){}}}
  doc.getElementById=element;let state,tick,now=0;
  const scene={positions:new Float32Array([10,21.32,-5,75,21.32,-5,75,21.32,60, 10,21.32,-5,75,21.32,60,10,21.32,60,...extraGeometry])};
  const c={window:null,document:doc,console,Float32Array,Map,Set,Math,Number,Array,SF_SCENE:scene,addEventListener(){},requestAnimationFrame(fn){tick=fn},SFRenderer:class{render(s){state=JSON.parse(JSON.stringify(s));let y=s.cameraYaw,p=s.cameraPitch,eye=[s.player.x+Math.sin(y)*3.8,s.player.y+1.4,s.player.z+Math.cos(y)*3.8];return {eye,target:[eye[0]-Math.sin(y)*Math.cos(p),eye[1]-Math.sin(p),eye[2]-Math.cos(y)*Math.cos(p)]}}}};c.window=c;vm.createContext(c);
  vm.runInContext(fs.readFileSync('web/ps1-rules.js','utf8'),c);vm.runInContext(fs.readFileSync('web/game.js','utf8'),c);
  const step=n=>{for(let i=0;i<n;i++)tick(now+=16)},key=(name,k)=>{for(const fn of handlers[name]||[])fn({key:k,preventDefault(){}})};
  element('start').events.click();step(1);
  return {element,doc,handlers,step,key,get state(){return state}};
}
// Forward and backward follow the character heading; backward retains its facing.
for(const [key,direction,minDistance,maxDistance] of [['z',-1,5.8,6.5],['s',1,1.7,2]]){
  const g=setup(),start={...g.state.player};g.key('keydown',key);g.step(60);g.key('keyup',key);
  const dx=g.state.player.x-start.x,dz=g.state.player.z-start.z;
  assert.ok(dx*direction>minDistance&&dx*direction<maxDistance,`${key}: moves along heading at the appropriate speed`);
  assert.ok(Math.abs(dz)<.05,`${key}: no sideways drift`);
  assert.ok(Math.abs(g.state.player.angle-start.angle)<.001,`${key}: keeps the body heading`);
  assert.equal(g.state.player.reverse,key==='s',`${key}: correct walking direction`);
  assert.equal(g.state.player.animation,key==='s'?'walk':'run');
}
// Left/right rotate in place, updating the camera target without a movement feedback loop.
for(const [key,sign] of [['q',1],['d',-1],['ArrowLeft',1],['ArrowRight',-1]]){
  const g=setup(),start={...g.state.player};g.key('keydown',key);g.step(30);g.key('keyup',key);
  assert.ok(Math.abs(g.state.player.x-start.x)<.001&&Math.abs(g.state.player.z-start.z)<.001,`${key}: rotates without strafing`);
  const rotation=Math.atan2(Math.sin(g.state.player.angle-start.angle),Math.cos(g.state.player.angle-start.angle));
  assert.ok(rotation*sign>.9,`${key}: turns in the correct direction`);
  assert.ok(Math.abs(g.state.cameraYaw-g.state.player.angle)<.001,`${key}: camera follows the character`);
  assert.equal(g.state.cameraImmediate,false,`${key}: keyboard follow remains smoothed`);
}
{
 const g=setup(),start={...g.state.player};g.key('keydown','Shift');g.key('keydown','z');g.step(60);g.key('keyup','z');g.key('keyup','Shift');
 assert.ok(start.x-g.state.player.x>1.7&&start.x-g.state.player.x<2,'Walking uses the measured PS1 movement rate');assert.equal(g.state.player.animation,'walk');
}
{
 const g=setup(),before={...g.state.player};
 // Move beyond the former 4m trigger, turn, then remain inactive for over one minute.
 g.key('keydown','z');g.step(60);g.key('keyup','z');g.key('keydown','q');g.step(20);g.key('keyup','q');
 g.step(4200);
 assert.equal(g.state.player.health,before.health,'No health is lost after walking, turning and 67 seconds of inactivity');
 assert.equal(g.state.player.armor,before.armor,'No armor is lost before an enemy is hit');
 const rested={...g.state.player};g.doc.documentElement.dataset.tutorialOpen='true';g.key('keydown','z');g.step(180);
 assert.equal(g.state.player.x,rested.x,'The tutorial pauses player movement');assert.equal(g.state.player.armor,before.armor,'The tutorial pauses enemy damage');
 g.doc.documentElement.dataset.tutorialOpen='false';g.key('keydown','z');g.step(30);g.key('keyup','z');assert.ok(Math.hypot(g.state.player.x-rested.x,g.state.player.z-rested.z)>1,'Movement resumes after the tutorial');
}
{
 const g=setup();g.doc.pointerLockElement=g.element('game');
 // Aim directly at the first target and deliberately hit it.
 const e=g.state.enemies[0];
 for(let i=0;i<8;i++){
  const p=g.state.player,y=g.state.cameraYaw,eye=[p.x+Math.sin(y)*3.8,p.y+1.4,p.z+Math.cos(y)*3.8];
  const desired=Math.atan2(-(e.x-eye[0]),-(e.z-eye[2]));
  for(const f of g.handlers.mousemove||[])f({movementX:(y-desired)/.003,movementY:0});g.step(1);
 }
 g.element('game').events.mousedown({button:0,clientX:0,clientY:0});g.step(1);
 assert.equal(g.state.enemies[0].health,1,'A deliberate hit engages combat');
 const armor=g.state.player.armor;g.doc.documentElement.dataset.tutorialOpen='true';g.step(500);
 assert.equal(g.state.player.armor,armor,'Combat is paused while reading the tutorial');
 g.doc.documentElement.dataset.tutorialOpen='false';g.step(650);
 assert.ok(g.state.player.armor<armor,'A visible enemy can attack after the engagement grace period');
 assert.equal(g.state.player.health,150,'Incoming damage first affects armor');
}
{
 const g=setup(),before={...g.state.player};g.doc.pointerLockElement=g.element('game');
 for(const f of g.handlers.mousemove||[])f({movementX:20,movementY:-400});g.step(1);
 g.element('game').events.mousedown({button:0,clientX:0,clientY:0});g.step(4200);
 assert.equal(g.state.player.health,before.health,'A missed shot and 67 seconds idle do not trigger retaliation');
 assert.equal(g.state.player.armor,before.armor,'A missed shot does not trigger surprise armor loss');
}
{
 const g=setup(),start={...g.state.player};
 g.key('keydown','c');g.step(10);
 assert.equal(g.state.player.rolling,true,'C starts a forward roll');
 assert.ok(g.state.player.rollTime>.1&&g.state.player.rollTime<.2,'The renderer receives elapsed roll time');
 assert.ok(start.x-g.state.player.x>.6,'The roll travels along the facing direction');
 g.doc.documentElement.dataset.tutorialOpen='true';const paused={...g.state.player};g.step(40);
 assert.equal(g.state.player.x,paused.x,'The roll pauses in the guide');
 assert.equal(g.state.player.rollTime,paused.rollTime,'The roll animation pauses in the guide');
 g.doc.documentElement.dataset.tutorialOpen='false';g.step(100);
 assert.equal(g.state.player.rolling,false,'The roll ends');
 assert.ok(start.x-g.state.player.x>2.9&&start.x-g.state.player.x<3.1,'The roll has bounded travel');
 const after=g.state.player.x;g.step(100);assert.equal(g.state.player.x,after,'Holding the key does not repeat the roll');
 g.key('keyup','c');g.key('keydown','c');g.step(1);assert.equal(g.state.player.rolling,true,'A new press can roll again after the cooldown');
}
{
 const wall=[46.5,21.32,26, 46.5,24,26, 46.5,24,31, 46.5,21.32,26, 46.5,24,31, 46.5,21.32,31];
 const g=setup(wall);g.key('keydown','c');g.step(50);
 assert.ok(g.state.player.x>=46.8,'A roll cannot pass through a wall');
}
{
 const g=setup();g.key('keydown','c');g.step(45);g.key('keyup','c');g.key('keydown','c');g.step(1);
 assert.equal(g.state.player.rolling,false,'A new roll cannot start before the cooldown');
 g.step(40);g.key('keyup','c');g.key('keydown','c');g.step(1);assert.equal(g.state.player.rolling,true,'The roll is available after the cooldown');
}
{
 const g=setup();const move=(x,y)=>{for(const f of g.handlers.mousemove||[])f({target:g.element('game'),clientX:x,clientY:y})};
 const yaw=g.state.cameraYaw;move(200,100);move(230,100);g.step(1);assert.ok(g.state.cameraYaw<yaw,'Mouse look works over the canvas when pointer lock is unavailable');
 assert.ok(Math.abs(g.state.player.angle-g.state.cameraYaw)<.001,'The character follows mouse look');
 const before=g.state.cameraYaw;g.key('keydown','q');g.step(1);g.key('keyup','q');assert.ok(Math.abs(g.state.cameraYaw-before)<.1,'Keyboard turning after mouse look does not jump the camera');
}
console.log('Movement tests passed: PS1 controls, 67 seconds idle, deliberate engagement, tutorial pause and pointer fallback.');
