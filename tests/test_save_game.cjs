// Resume a running game in a fresh document with the same browser storage.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const entries=new Map(),storage={getItem:k=>entries.has(k)?entries.get(k):null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};
const plane=new Float32Array([10,21.32,-5,75,21.32,-5,75,21.32,65,10,21.32,-5,75,21.32,65,10,21.32,65]);
function setup(){
  const elements={},listeners={},windowEvents={};let tick,now=0,state,live,camera;
  const doc={documentElement:{dataset:{}},pointerLockElement:null,addEventListener(n,f){(listeners[n]??=[]).push(f)},exitPointerLock(){this.pointerLockElement=null}};
  function el(id){return elements[id]??={textContent:'',innerHTML:'',style:{},dataset:{},hidden:false,disabled:false,events:{},classes:new Set(),
    get classList(){return {add:n=>this.classes.add(n),remove:n=>this.classes.delete(n),contains:n=>this.classes.has(n)}},
    querySelector(){return {textContent:''}},addEventListener(n,f){(this.events[n]??=[]).push(f)},
    click(){if(!this.disabled)for(const f of this.events.click||[])f({isTrusted:false,stopImmediatePropagation(){}})},
    focus(){doc.activeElement=this},pause(){},load(){},removeAttribute(){},play(){return Promise.resolve()},requestPointerLock(){},
    showModal(){this.open=true},close(){this.open=false;for(const f of this.events.close||[])f()}}}
  doc.getElementById=el;
  const pad={index:0,mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};
  const c={document:doc,localStorage:storage,console,Float32Array,Map,Set,Math,Number,Array,SF_SCENE:{positions:plane},navigator:{getGamepads:()=>[pad]},
    addEventListener(n,f){(windowEvents[n]??=[]).push(f)},requestAnimationFrame(f){tick=f},
    SFRenderer:class{render(value){live=value;state=JSON.parse(JSON.stringify(value));const {player:p,cameraYaw:y,cameraPitch:pit}=value,eye=[p.x+Math.sin(y)*3.8,p.y+1.7,p.z+Math.cos(y)*3.8];return camera={eye,target:[eye[0]-Math.sin(y)*Math.cos(pit),eye[1]-Math.sin(pit),eye[2]-Math.cos(y)*Math.cos(pit)],yaw:y};}}};
  c.window=c;vm.createContext(c);for(const file of ['web/assets/opening-actors.js','web/ps1-rules.js','web/mission.js','web/save.js','web/tutorial.js','web/game.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c,{filename:file});
  const step=(n=1)=>{for(let i=0;i<n;i++)tick(now+=16)},button=(i,on)=>{pad.buttons[i]={pressed:on,value:on?1:0};step()},dispatch=(n,e)=>{for(const f of listeners[n]||[])f(e)};
  return {c,el,doc,pad,step,button,dispatch,windowEvents,get state(){return state},get live(){return live},get camera(){return camera}};
}

const first=setup();first.step();
assert.equal(first.c.SFSave.load(),null,'First launch has no save');
assert.equal(first.el('continue-game').hidden,true,'Continue is unavailable with no save');
first.el('start').click();first.doc.pointerLockElement=first.el('game');first.step();
const before=first.state.player.x;first.pad.axes[1]=-1;first.step(40);first.pad.axes[1]=0;first.step();
assert.ok(first.state.player.x<before-2,'The player moves before saving');
// Aim deliberately at a live enemy and fire twice, so enemy progress is saved.
const enemy=first.live.enemies.find(e=>e.source!==184);
for(let i=0;i<6;i++){
  const eye=first.camera.eye,dx=enemy.x-eye[0],dy=enemy.y+1.25-eye[1],dz=enemy.z-eye[2],desiredYaw=Math.atan2(-dx,-dz),desiredPitch=-Math.atan2(dy,Math.hypot(dx,dz));
  const delta=Math.atan2(Math.sin(first.state.cameraYaw-desiredYaw),Math.cos(first.state.cameraYaw-desiredYaw));
  first.dispatch('mousemove',{movementX:delta/.003,movementY:(desiredPitch-first.state.cameraPitch)/.002});first.step();
}
first.button(7,true);first.button(7,false);first.step(20);first.button(7,true);first.button(7,false);first.step(400);
first.pad.axes[1]=-1;first.step(5);first.pad.axes[1]=0;
for(const callback of first.windowEvents.pagehide||[])callback();
const saved=first.c.SFSave.load();assert.ok(saved,'A running game is automatically saved');
assert.ok(Math.abs(saved.player.x-first.state.player.x)<.001&&Math.abs(saved.player.z-first.state.player.z)<.001,'Closing the page saves the latest position immediately');
assert.ok(saved.player.ammo<=13,'Ammunition spent in combat is saved');
assert.ok(saved.enemies.some(e=>!e.alive),'Neutralized enemies are saved');
const rawBefore=JSON.stringify(saved),second=setup();second.step(10);
assert.equal(JSON.stringify(second.c.SFSave.load()),rawBefore,'The title screen does not overwrite progress');
assert.equal(second.el('continue-game').hidden,false,'Continue appears when a save exists');
second.button(13,true);second.button(13,false);
assert.equal(second.el('continue-game').dataset.gamepadSelected,'true','D-pad selects Continue');
second.button(0,true);second.button(0,false);second.step();
assert.equal(second.el('overlay').hidden,true,'Cross resumes directly from the title');
assert.ok(Math.abs(second.state.player.x-saved.player.x)<.01,'The player resumes at the saved position');
assert.ok(Math.abs(second.state.player.z-saved.player.z)<.01,'The second position axis is restored');
assert.equal(second.state.player.health,saved.player.health);assert.equal(second.state.player.armor,saved.player.armor);
assert.equal(second.state.player.ammo,saved.player.ammo);assert.equal(second.state.player.reserve,saved.player.reserve);
assert.equal(second.state.enemies.length,saved.enemies.length);
for(let i=0;i<saved.enemies.length;i++){
  const before=saved.enemies[i],after=second.state.enemies[i];
  assert.equal(after.source??null,before.source);assert.equal(after.alive,before.alive);assert.equal(after.health,before.health);
  assert.ok(Math.hypot(after.x-before.x,after.z-before.z)<.15,'Each enemy resumes near its saved position');
  if(before.source===184){assert.ok(after.route&&after.route.length===5,'The original patrol route is reconstructed');assert.equal(after.routeIndex,before.routeIndex);}
}
const ammo=second.state.player.ammo;second.button(7,true);second.button(7,false);
assert.equal(second.state.player.ammo,ammo-1,'Controller shooting works after continuing');
second.button(9,true);second.button(9,false);
assert.equal(second.el('controls-dialog').open,true,'Options opens the pause menu');
second.button(13,true);second.button(13,false);
assert.equal(second.doc.activeElement,second.el('help-save-quit'),'D-pad selects Save and Quit');
second.button(0,true);second.button(0,false);
assert.equal(second.el('controls-dialog').open,false,'Save and Quit closes the pause menu');
assert.equal(second.el('overlay').hidden,false,'Save and Quit returns to the title');
assert.equal(second.c.SFSave.load().player.ammo,ammo-1,'Save and Quit persists the latest shot');
assert.equal(second.el('continue-game').hidden,false,'The saved game can be continued again');
console.log('Save integration passed: combat, pagehide, controller Continue, Save and Quit and restored progress.');
