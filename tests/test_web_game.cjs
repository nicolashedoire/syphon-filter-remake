// Exercise the game logic with the real level data and a stubbed rendering surface.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const elements = {}, listeners = {};
function element(id) {
  return elements[id] ??= {textContent:'',innerHTML:'',style:{},hidden:false,disabled:false,events:{},
    classList:{add(){},remove(){}},querySelector(){return {textContent:''}},
    addEventListener(name,fn){this.events[name]=fn;},focus(){}};
}
let nextFrame, state, lastCamera, now=1000;
const document={getElementById:element,addEventListener(name,fn){(listeners[name]??=[]).push(fn);},pointerLockElement:null,exitPointerLock(){this.pointerLockElement=null;}};
const context={console,Float32Array,Map,Set,Math,Number,Array,document,requestAnimationFrame(fn){nextFrame=fn;},addEventListener(){},SFRenderer:class{render(value){state=JSON.parse(JSON.stringify(value));const {player:p,cameraYaw:yaw,cameraPitch:pitch}=value;const sy=Math.sin(yaw),cy=Math.cos(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);const eye=[p.x+sy*cp*3.8+cy*.65,p.y+1.7+sp*3.8,p.z+cy*cp*3.8-sy*.65];lastCamera={eye,target:[eye[0]-sy*cp,eye[1]-sp,eye[2]-cy*cp]};return lastCamera;}}};
context.window=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('web/assets/georgia-street.js','utf8'),context);
vm.runInContext(fs.readFileSync('web/ps1-rules.js','utf8'),context);
vm.runInContext(fs.readFileSync('web/game.js','utf8'),context);
function advance(frames){for(let i=0;i<frames;i++){now+=16;nextFrame(now);}}
function dispatch(name,event){for(const fn of listeners[name]||[])fn(event);}
function down(key){dispatch('keydown',{key,preventDefault(){}});}
function up(key){dispatch('keyup',{key});}
function aimAt(enemy){
  for(let i=0;i<6;i++){
    const dx=enemy.x-lastCamera.eye[0],dy=enemy.y+1.25-lastCamera.eye[1],dz=enemy.z-lastCamera.eye[2];
    const desiredYaw=Math.atan2(-dx,-dz),desiredPitch=-Math.atan2(dy,Math.hypot(dx,dz));
    const yawDelta=Math.atan2(Math.sin(state.cameraYaw-desiredYaw),Math.cos(state.cameraYaw-desiredYaw));
    dispatch('mousemove',{movementX:yawDelta/.003,movementY:(desiredPitch-state.cameraPitch)/.002});advance(1);
  }
}
function shoot(){element('game').events.mousedown({button:0,clientX:0,clientY:0});advance(20);}
assert.ok(nextFrame,'The game loop starts');
element('start').events.click();
assert.equal(element('overlay').hidden,true,'The briefing closes when the mission starts');
document.pointerLockElement=element('game');advance(1);
assert.equal(state.enemies.length,3,'Three enemies spawn on the actual level');
for(let i=0;i<3;i++){
  const enemy=state.enemies.find(e=>e.alive);aimAt(enemy);shoot();shoot();
}
assert.equal(state.enemies.filter(e=>e.alive).length,0,'The three enemies can be defeated');
assert.ok(state.objective,'The extraction marker appears after combat');
assert.equal(element('ammo-hud').textContent,'9 / 45','Shots consume ammunition');
down('r');up('r');advance(75);
assert.equal(element('ammo-hud').textContent,'15 / 39','Reloading replenishes the magazine and consumes reserve ammunition');
// Face the marked extraction point and walk to it using the French keyboard control.
const dx=state.objective.x-state.player.x,dz=state.objective.z-state.player.z;
const desired=Math.atan2(-dx,-dz),delta=Math.atan2(Math.sin(state.cameraYaw-desired),Math.cos(state.cameraYaw-desired));
dispatch('mousemove',{movementX:delta/.003,movementY:0});down('z');advance(90);up('z');
assert.match(element('overlay-title').innerHTML,/ACCOMPLIE/,'Reaching extraction completes the mission');
console.log('Web game smoke test passed: start, aiming, combat, reload, movement and extraction.');

// The reticle's vertical direction matters: looking above a target must miss.
element('start').events.click();document.pointerLockElement=element('game');advance(1);
let victim=state.enemies[0];aimAt(victim);
dispatch('mousemove',{movementX:0,movementY:-220});advance(1);
element('game').events.mousedown({button:0,clientX:0,clientY:0});advance(1);
assert.equal(state.enemies[0].health,2,'A shot aimed above an enemy must miss');
advance(20);

// Add a real triangle wall to the scene and verify hits do not pass through it.
const original=context.SF_SCENE.positions, wallX=(state.player.x+state.enemies[0].x)/2;
const wall=new Float32Array([wallX,18,18, wallX,27,18, wallX,27,38, wallX,18,18, wallX,27,38, wallX,18,38]);
const withWall=new Float32Array(original.length+wall.length);withWall.set(original);withWall.set(wall,original.length);context.SF_SCENE.positions=withWall;
aimAt(state.enemies[0]);element('game').events.mousedown({button:0,clientX:0,clientY:0});advance(1);
assert.equal(state.enemies[0].health,2,'A wall blocks shots at enemies');
assert.ok(state.impact && !state.impact.hit,'A blocked shot renders an impact');
const healthBefore=state.player.health,armorBefore=state.player.armor;advance(260);
assert.equal(state.player.health,healthBefore,'Enemy shots cannot pass through the wall');
assert.equal(state.player.armor,armorBefore,'The wall also protects armor');
console.log('Web shooting tests passed: vertical aim, wall impacts and enemy line of sight.');

// The first click after Escape recaptures the pointer without firing.
document.pointerLockElement=null;dispatch('pointerlockchange',{});
let captureRequests=0;element('game').requestPointerLock=()=>{captureRequests++;document.pointerLockElement=element('game');dispatch('pointerlockchange',{});};
const ammoBefore=element('ammo-hud').textContent;
element('game').events.mousedown({button:0,clientX:0,clientY:0});
assert.equal(captureRequests,1,'Clicking the game recaptures the pointer');
assert.equal(element('ammo-hud').textContent,ammoBefore,'Recapturing the pointer does not consume ammunition');
console.log('Pointer recapture test passed.');
