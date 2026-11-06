// L2 lock uses the real camera and both visibility paths, including at fire time.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const els={},docHandlers={},handlers={};let tick,now=0,live;
const doc={documentElement:{dataset:{}},pointerLockElement:null,addEventListener(n,f){(docHandlers[n]??=[]).push(f)},exitPointerLock(){}};
function el(id){return els[id]??={textContent:'',innerHTML:'',style:{},dataset:{},hidden:false,events:{},classList:{add(){},remove(){}},querySelector(){return {textContent:''}},addEventListener(n,f){this.events[n]=f},click(){this.events.click?.({isTrusted:false})},focus(){},pause(){},load(){},removeAttribute(){},requestPointerLock(){}}}
doc.getElementById=el;
const pad={index:0,mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};
const scene={positions:new Float32Array([10,21.32,-5,75,21.32,-5,75,21.32,60,10,21.32,-5,75,21.32,60,10,21.32,60])};
const c={document:doc,console,Float32Array,Map,Set,Math,Number,Array,SF_SCENE:scene,navigator:{getGamepads:()=>[pad]},addEventListener(n,f){(handlers[n]??=[]).push(f)},requestAnimationFrame(f){tick=f},SFRenderer:class{render(s){live=s;const p=s.player,y=s.cameraYaw,pitch=s.cameraPitch,eye=[p.x+Math.sin(y)*3.8,p.y+1.4,p.z+Math.cos(y)*3.8];return {eye,target:[eye[0]-Math.sin(y)*Math.cos(pitch),eye[1]-Math.sin(pitch),eye[2]-Math.cos(y)*Math.cos(pitch)]}}}};c.window=c;vm.createContext(c);
for(const file of ['web/ps1-rules.js','web/game.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
el('game').clientWidth=1280;el('game').clientHeight=720;
const step=(n=1)=>{for(let i=0;i<n;i++)tick(now+=16)},set=(i,down)=>{pad.buttons[i]={pressed:down,value:down?1:0}},press=i=>{set(i,true);step()},release=i=>{set(i,false);step()};
step();press(0);release(0);step();
const p=live.player,first={x:p.x-8,y:p.y,z:p.z-2,angle:0,alive:true,health:2,fire:999},second={x:p.x-10,y:p.y,z:p.z+3,angle:0,alive:true,health:2,fire:999};
live.enemies.splice(0,live.enemies.length,first,second);step();
pad.axes[2]=1;step(12);pad.axes[2]=0;const manualLeft=el('reticle').style.left,manualTop=el('reticle').style.top;
set(6,true);set(7,true);step();
assert.match(el('lock-status').textContent,/CIBLE VERROUILLÉE/,'L2 locks a visible enemy');
assert.equal(first.health,1,'L2 and R2 in the same frame shoot the locked enemy');
assert.equal(second.health,2);assert.notEqual(el('reticle').style.left,manualLeft,'The cursor is placed on the target');
set(7,false);step(25);second.z=p.z-1;first.z=p.z-3;step(12);
assert.match(el('lock-status').textContent,/CIBLE VERROUILLÉE/);press(7);
assert.equal(first.alive,false,'A valid existing lock is retained even when another enemy moves closer to the cursor');
assert.equal(second.health,2);release(7);step(15);
assert.match(el('lock-status').textContent,/CIBLE VERROUILLÉE/,'A live target is acquired after the locked enemy dies');
assert.equal(el('reticle').style.left===manualLeft,false);
release(6);assert.equal(el('lock-status').textContent,'','Releasing L2 clears the lock status');
assert.equal(el('reticle').style.left,manualLeft,'Releasing L2 restores manual horizontal aim');assert.equal(el('reticle').style.top,manualTop,'Releasing L2 restores manual vertical aim');
// With no living target the shot is refused rather than silently aimed elsewhere.
second.alive=false;const ammo=p.ammo;set(6,true);set(7,true);step();assert.match(el('lock-status').textContent,/AUCUNE CIBLE/);assert.equal(p.ammo,ammo,'No target means no round spent');set(7,false);set(6,false);step(25);
second.alive=true;second.x=p.x-8;second.z=p.z+100;set(6,true);step();assert.match(el('lock-status').textContent,/AUCUNE CIBLE/,'Targets outside the viewport cannot be locked');
second.z=p.z+2;step(12);assert.match(el('lock-status').textContent,/VERROUILLÉE/,'A target entering the viewport can be acquired');
second.x=p.x+8;step();assert.match(el('lock-status').textContent,/AUCUNE CIBLE/,'A lock is lost as soon as the target moves behind the camera');set(6,false);step();
// Put a single target back and add a wall between it and the camera/player.
second.alive=true;second.health=2;second.x=p.x-8;second.z=p.z+2;
const wall=(x,z0,z1)=>new Float32Array([x,p.y-1,z0,x,p.y+4,z0,x,p.y+4,z1,x,p.y-1,z0,x,p.y+4,z1,x,p.y-1,z1]);
c.SF_PROPS={positions:wall(p.x-4,p.z-5,p.z+5)};set(6,true);set(7,true);step();assert.match(el('lock-status').textContent,/AUCUNE CIBLE/,'A wall prevents lock');assert.equal(p.ammo,ammo,'A wall cannot consume ammunition for a locked shot');set(7,false);set(6,false);step();
// The camera sees over this narrow offset wall; the character does not.
c.SF_PROPS.positions=wall(p.x-1,p.z+.15,p.z+.35);set(6,true);set(7,true);step();assert.match(el('lock-status').textContent,/AUCUNE CIBLE/,'A muzzle-only obstruction prevents lock');assert.equal(p.ammo,ammo);set(7,false);set(6,false);step();
// The player sees the target but a wall between the camera and player blocks it.
c.SF_PROPS.positions=wall(p.x+1.5,p.z-5,p.z+5);set(6,true);set(7,true);step();assert.match(el('lock-status').textContent,/AUCUNE CIBLE/,'A camera-only obstruction prevents lock');assert.equal(p.ammo,ammo);set(7,false);set(6,false);step();
// Revalidation at shot time catches an obstacle introduced between checks.
c.SF_PROPS.positions=new Float32Array();set(6,true);step();assert.match(el('lock-status').textContent,/VERROUILLÉE/);c.SF_PROPS.positions=wall(p.x-4,p.z-5,p.z+5);set(7,true);step();assert.equal(p.ammo,ammo,'R2 rechecks visibility even between periodic lock checks');assert.match(el('lock-status').textContent,/AUCUNE CIBLE/);set(7,false);set(6,false);step();
// Reload cannot be interrupted by R2 and a held lock clears on disconnect.
c.SF_PROPS.positions=new Float32Array();press(2);release(2);set(6,true);step();const beforeReload=p.ammo;set(7,true);step();assert.equal(p.ammo,beforeReload,'Shooting while reloading is blocked');set(7,false);step(80);assert.equal(p.ammo,15,'Reload finishes while L2 is held');pad.connected=false;step();assert.equal(el('lock-status').textContent,'','Disconnect clears lock');
console.log('L2 lock tests passed: simultaneous fire, stable tracking, death, no target, both obstruction paths, revalidation, reload and disconnect.');
