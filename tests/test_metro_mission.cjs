// Exercise the reconstructed mission using the actual French subway geometry.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const entries=new Map(),storage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};
function setup(){
 const elements={},listeners={},windowEvents={};let tick,now=0,live;
 const doc={title:'',documentElement:{dataset:{}},pointerLockElement:null,addEventListener(n,f){(listeners[n]??=[]).push(f)},exitPointerLock(){},querySelector(){return null}};
 function el(id){return elements[id]??={textContent:'',innerHTML:'',style:{},dataset:{},hidden:false,disabled:false,events:{},classes:new Set(),
  get classList(){return {add:n=>this.classes.add(n),remove:n=>this.classes.delete(n),contains:n=>this.classes.has(n)}},
  querySelector(){return {textContent:''}},addEventListener(n,f){(this.events[n]??=[]).push(f)},click(){for(const f of this.events.click||[])f({isTrusted:false,stopImmediatePropagation(){}})},focus(){},pause(){},load(){},removeAttribute(){},play(){return Promise.resolve()},requestPointerLock(){}}}
 doc.getElementById=el;
 const pad={index:0,mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};
 const c={document:doc,localStorage:storage,console,Float32Array,Map,Set,Math,Number,Array,location:{search:'?mission=metro',href:''},navigator:{getGamepads:()=>[pad]},
  addEventListener(n,f){(windowEvents[n]??=[]).push(f)},requestAnimationFrame(f){tick=f},
  SFRenderer:class{render(value){live=value;const p=value.player,y=value.cameraYaw;return {eye:[p.x+Math.sin(y)*3,p.y+1.7,p.z+Math.cos(y)*3],target:[p.x,p.y+1.4,p.z],yaw:y}}}};
 c.window=c;vm.createContext(c);
 for(const f of ['web/assets/subway2-textured.js','web/metro-data.js','web/metro-fires.js','web/level-select.js','web/ps1-rules.js','web/save.js','web/game.js'])vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f});
 const step=(n=1)=>{for(let i=0;i<n;i++)tick(now+=16)},key=(key)=>{for(const f of listeners.keydown||[])f({key,preventDefault(){}});for(const f of listeners.keyup||[])f({key})};
 const button=(n)=>{pad.buttons[n]={pressed:true,value:1};step();pad.buttons[n]={pressed:false,value:0};step();};
 return {c,el,step,key,button,events:windowEvents,get live(){return live}};
}
const a=setup();a.step();a.button(13);assert.equal(a.el('help-brief').dataset.gamepadSelected,'true','Down selects the next visible menu option');a.button(13);assert.equal(a.el('metro-select').dataset.gamepadSelected,'true','Down selects the metro action in the same order as the visible menu');a.button(12);a.button(12);assert.ok(a.c.SF_METRO_ACTIVE);assert.equal(a.c.SF_SCENE,a.c.SF_SUBWAY2_TERRAIN);
a.el('start').click();assert.match(a.el('overlay-text').textContent,/cachette des explosifs/i);a.el('start').click();a.step();
assert.equal(a.el('overlay').hidden,true);assert.ok(a.live.enemies.length>=9,'Original enemy positions spawn on actual terrain');
assert.ok(a.live.enemies.every(e=>e.source>=210&&e.source<=221),'Enemies use native object identifiers');
assert.ok(Math.hypot(a.live.player.x+14.37,a.live.player.z+1.16)<.1,'Player uses native spawn');
assert.equal(a.live.allies.length,1,'CBDC ally is present');assert.equal(a.c.SF_METRO_FIRES.length,173,'Flame locations come from original object records');
const p=a.live.player;const integrity=[p.health,p.armor];Object.assign(p,{x:-10.24,y:-12.32,z:6.98});a.step(400);assert.deepEqual([p.health,p.armor],integrity,'Visual flames do not cause passive damage');Object.assign(p,{x:-13.5,y:-11.2,z:-27.5});a.key('e');a.step();assert.ok(p.x>6,'Provisional train passage reaches the other corridor');
Object.assign(p,{x:8.39,y:-12.49,z:-49.94});a.key('e');a.step();assert.match(a.el('message').textContent,/C4 PRIS/);
a.events.pagehide[0]();const saved=a.c.SFSave.load();assert.equal(saved.hasC4,true);assert.equal(saved.crossedTrain,true);assert.equal(saved.allyContact,false);
const b=setup();b.step();assert.equal(b.el('continue-game').hidden,false);b.el('continue-game').click();b.step();
assert.ok(Math.hypot(b.live.player.x-8.39,b.live.player.z+49.94)<.1,'Metro position and C4 resume independently');
const q=b.live.player;Object.assign(q,{x:7,y:-11.2,z:-14});b.key('e');b.step();assert.ok(q.y> -2,'Provisional passage reaches upper floor');
Object.assign(q,{x:3.93,y:3.8,z:18.81});b.key('e');b.step();assert.match(b.el('message').textContent,/CBDC REPÉRÉ/);
// A visible guard threatens the contacted ally only after a grace period.
const guard=b.live.enemies[0],friend=b.live.allies[0];for(const e of b.live.enemies){if(e!==guard){e.alive=false;e.health=0;}}
Object.assign(guard,{x:4,y:3.8,z:15,route:[],alive:true,health:2});const friendHealth=friend.health;b.step(400);assert.equal(friend.health,friendHealth,'The player has time to intervene');
let trace=false;for(let i=0;i<250&&friend.health===friendHealth;i++){b.step();trace ||= b.live.enemyShots.length>0;}
assert.ok(friend.health<friendHealth,'A guard in line of sight can hit the ally');assert.ok(trace,'The attack is visibly traced');
guard.alive=false;guard.health=0;const safe=friend.health;b.step(300);assert.equal(friend.health,safe,'Neutralizing the guard protects the ally');
Object.assign(q,{x:11,y:0,z:-14.07});b.key('e');b.step();assert.match(b.el('overlay-title').innerHTML,/ACCOMPLIE/);assert.equal(b.c.SFSave.load(),null,'A completed mission clears its own save');
// A guard behind geometry cannot shoot through it; after gaining sight it can defeat the ally.
const loss=setup();loss.step();loss.el('start').click();loss.el('start').click();loss.step();
const lp=loss.live.player;Object.assign(lp,{x:-13.5,y:-11.2,z:-27.5});loss.key('e');loss.step();Object.assign(lp,{x:8.39,y:-12.49,z:-49.94});loss.key('e');loss.step();Object.assign(lp,{x:3.93,y:3.8,z:18.81});loss.key('e');loss.step();
const threat=loss.live.enemies[0],cbdc=loss.live.allies[0];for(const e of loss.live.enemies){if(e!==threat){e.alive=false;e.health=0;}}
Object.assign(threat,{x:8,y:3.8,z:19,route:[],alive:true,health:2});loss.step(700);assert.equal(cbdc.health,3,'Walls prevent the guard from hitting the ally');
Object.assign(threat,{x:4,y:3.8,z:15});for(let i=0;i<1200&&cbdc.alive;i++)loss.step();
assert.equal(cbdc.alive,false);assert.match(loss.el('overlay-text').textContent,/neutralisé/i,'The mission fails when the ally dies');
console.log('Metro mission: native terrain/spawn/hostiles, French objectives, save/resume, passage, ally and completion passed.');
// Validate that navigable collision cells connect each objective. The original
// stair/door is not implemented, so the prototype uses a marked transition.
{
 const terrain=a.c.SF_SUBWAY2_TERRAIN.positions,g=fs.readFileSync('web/game.js','utf8');
 const source=g.slice(g.indexOf('  const key='),g.indexOf('  function setMessage'));
 const scope={window:{SF_SUBWAY2_TERRAIN:{positions:terrain}},Float32Array,Map,Math};
 vm.runInNewContext('const CELL=6;'+source+';let [groundGrid,wallGrid]=prepareCollision(window.SF_SUBWAY2_TERRAIN.positions);globalThis.h=heightAt;globalThis.w=wallAt;',scope);
 function reachable(start,targets){
  const step=.5,q=[start],key=(x,y,z)=>`${Math.round(x*2)},${Math.round(y*2)},${Math.round(z*2)}`,seen=new Set([key(...start)]),found=new Set();
  for(let i=0;i<q.length&&i<100000&&found.size<targets.length;i++){
   const [x,y,z]=q[i];targets.forEach((p,n)=>{if(Math.hypot(x-p[0],y-p[1],z-p[2])<2.35)found.add(n)});
   for(const [dx,dz] of [[step,0],[-step,0],[0,step],[0,-step]]){const nx=x+dx,nz=z+dz,ny=scope.h(nx,nz,y);if(ny===null||scope.w(nx,ny,nz))continue;const k=key(nx,ny,nz);if(!seen.has(k)){seen.add(k);q.push([nx,ny,nz]);}}
  }
  return found.size;
 }
 assert.equal(reachable([-14.37,-11.19,-1.16],[[-13.5,-11.2,-27.5]]),1,'The temporary train passage is reachable from the native spawn');
 assert.equal(reachable([7,-11.2,-27.5],[[8.39,-12.47,-49.94],[7,-11.14,-14]]),2,'The cache and lower passage are reachable after crossing the train');
 assert.equal(reachable([10,0,-14],[[3.93,3.8,18.81],[12.09,.22,-14.07]]),2,'The upper ally and passage target are reachable');
}
console.log('Metro geometry: both floors connect their local objectives.');
