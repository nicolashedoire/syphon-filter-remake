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
let nextFrame, state, now=1000;
const document={getElementById:element,addEventListener(name,fn){(listeners[name]??=[]).push(fn);},pointerLockElement:null,exitPointerLock(){this.pointerLockElement=null;}};
const context={console,Float32Array,Map,Set,Math,Number,Array,document,requestAnimationFrame(fn){nextFrame=fn;},addEventListener(){},SFRenderer:class{render(value){state=JSON.parse(JSON.stringify(value));}}};
context.window=context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('web/assets/georgia-street.js','utf8'),context);
vm.runInContext(fs.readFileSync('web/game.js','utf8'),context);
function advance(frames){for(let i=0;i<frames;i++){now+=16;nextFrame(now);}}
function dispatch(name,event){for(const fn of listeners[name]||[])fn(event);}
function down(key){dispatch('keydown',{key,preventDefault(){}});}
function up(key){dispatch('keyup',{key});}
function aimAt(enemy){const dx=enemy.x-state.player.x,dz=enemy.z-state.player.z;const desired=Math.atan2(-dx,-dz);const delta=Math.atan2(Math.sin(state.cameraYaw-desired),Math.cos(state.cameraYaw-desired));dispatch('mousemove',{movementX:delta/.003,movementY:0});advance(1);}
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
assert.equal(element('ammo-hud').textContent,'6 / 12','Shots consume ammunition');
down('r');up('r');advance(75);
assert.equal(element('ammo-hud').textContent,'12 / 12','Reloading replenishes the magazine');
// Face the marked extraction point and walk to it using the French keyboard control.
const dx=state.objective.x-state.player.x,dz=state.objective.z-state.player.z;
const desired=Math.atan2(-dx,-dz),delta=Math.atan2(Math.sin(state.cameraYaw-desired),Math.cos(state.cameraYaw-desired));
dispatch('mousemove',{movementX:delta/.003,movementY:0});down('z');advance(90);up('z');
assert.match(element('overlay-title').innerHTML,/ACCOMPLIE/,'Reaching extraction completes the mission');
console.log('Web game smoke test passed: start, aiming, combat, reload, movement and extraction.');
