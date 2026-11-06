// Exercise the French-disc patrol inside the actual game loop and collision grid.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements={},listeners={};
function element(id){return elements[id]??={textContent:'',innerHTML:'',style:{},hidden:false,disabled:false,events:{},
  classList:{add(){},remove(){}},querySelector(){return {textContent:''};},addEventListener(name,fn){this.events[name]=fn;},focus(){}};}
let nextFrame,state,lastCamera,now=1000;
const document={getElementById:element,addEventListener(name,fn){(listeners[name]??=[]).push(fn);},pointerLockElement:null,exitPointerLock(){this.pointerLockElement=null;}};
const context={console,Float32Array,Uint8Array,Uint16Array,Map,Set,Math,Number,Array,document,requestAnimationFrame(fn){nextFrame=fn;},addEventListener(){},
  SFRenderer:class{render(value){state=value;const {player:p,cameraYaw:yaw,cameraPitch:pitch}=value;
    const sy=Math.sin(yaw),cy=Math.cos(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
    const eye=[p.x+sy*cp*3.8+cy*.65,p.y+1.7+sp*3.8,p.z+cy*cp*3.8-sy*.65];
    lastCamera={eye,target:[eye[0]-sy*cp,eye[1]-sp,eye[2]-cy*cp]};return lastCamera;}}};
context.window=context;vm.createContext(context);
for(const file of ['web/assets/georgia-street.js','web/assets/props.js','web/assets/opening-actors.js','web/ps1-rules.js','web/mission.js','web/game.js'])
  vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
function advance(frames){for(let i=0;i<frames;i++){now+=50;nextFrame(now);}}
function dispatch(name,event){for(const fn of listeners[name]||[])fn(event);}
function aimAt(enemy){for(let i=0;i<6;i++){
  const dx=enemy.x-lastCamera.eye[0],dy=enemy.y+1.25-lastCamera.eye[1],dz=enemy.z-lastCamera.eye[2];
  const desiredYaw=Math.atan2(-dx,-dz),desiredPitch=-Math.atan2(dy,Math.hypot(dx,dz));
  const yawDelta=Math.atan2(Math.sin(state.cameraYaw-desiredYaw),Math.cos(state.cameraYaw-desiredYaw));
  dispatch('mousemove',{movementX:yawDelta/.003,movementY:(desiredPitch-state.cameraPitch)/.002});advance(1);
}}
assert.ok(nextFrame,'The game loop starts');
element('start').events.click();document.pointerLockElement=element('game');advance(1);
let patrol=state.enemies.find(e=>e.source===184);
assert.ok(patrol,'The authored hostile is spawned');
assert.ok(Math.hypot(patrol.x-31.94,patrol.z-59.64)<.1,'The hostile starts at its authored position');
assert.ok(Math.abs(patrol.y-21.33)<.1,'The native Y coordinate matches the terrain');
assert.ok(state.enemies.every(e=>e.source!==172&&e.source!==173),'Protected CBDC agents are never identified as hostiles');
const health=state.player.health,armor=state.player.armor;
advance(1400);
assert.equal(patrol.routeIndex,patrol.route.length,'The enemy follows every authored path node without becoming stuck');
assert.ok(Math.hypot(patrol.x-54.66,patrol.z-43.4)<.2,'The patrol reaches its final node');
assert.equal(state.player.health,health);assert.equal(state.player.armor,armor,'A patrol does not cause passive damage');

// Restart; engaging a training target stops the patrol rather than continuing
// its original route during the prototype's simplified alert behavior.
element('start').events.click();document.pointerLockElement=element('game');advance(50);
patrol=state.enemies.find(e=>e.source===184);
const target=state.enemies.find(e=>e.source!==184);
assert.ok(target,'A nearby training target is available');
aimAt(target);
element('game').events.mousedown({button:0,clientX:0,clientY:0});advance(1);
assert.equal(target.health,1,'The test shot hits and starts the combat alert');
const frozen={x:patrol.x,z:patrol.z};advance(30);
assert.ok(Math.hypot(patrol.x-frozen.x,patrol.z-frozen.z)<.001,'The patroller stops after the combat alert');
console.log('Authored enemy patrol integration, safe idle, alert, and CBDC separation passed.');
