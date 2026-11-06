// Exercise standard PlayStation-style gamepads with no browser or GPU dependency.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements={},docHandlers={},windowHandlers={};let tick,now=0,state,pad=null,locks=0,lastView;
const doc={documentElement:{dataset:{}},pointerLockElement:null,addEventListener(n,f){(docHandlers[n]??=[]).push(f)},exitPointerLock(){this.pointerLockElement=null}};
function el(id){return elements[id]??={textContent:'',innerHTML:'',style:{},hidden:false,events:{},classList:{add(){},remove(){}},querySelector(){return {textContent:''}},addEventListener(n,f){this.events[n]=f},click(){this.events.click?.({isTrusted:false})},focus(){},pause(){},load(){},removeAttribute(){},requestPointerLock(){locks++;}}}
doc.getElementById=el;
const scene={positions:new Float32Array([10,21.32,-5,75,21.32,-5,75,21.32,60,10,21.32,-5,75,21.32,60,10,21.32,60])};
const c={document:doc,console,Float32Array,Map,Set,Math,Number,Array,SF_SCENE:scene,navigator:{getGamepads(){return pad?[pad]:[null]}},addEventListener(n,f){(windowHandlers[n]??=[]).push(f)},requestAnimationFrame(f){tick=f},SFRenderer:class{render(s){state=JSON.parse(JSON.stringify(s));const y=s.cameraYaw,p=s.cameraPitch,eye=[s.player.x+Math.sin(y)*3.8,s.player.y+1.4,s.player.z+Math.cos(y)*3.8];return lastView={eye,target:[eye[0]-Math.sin(y)*Math.cos(p),eye[1]-Math.sin(p),eye[2]-Math.cos(y)*Math.cos(p)]}}}};c.window=c;vm.createContext(c);
for(const p of ['web/ps1-rules.js','web/mission.js','web/game.js'])vm.runInContext(fs.readFileSync(p,'utf8'),c);
el('game').clientWidth=1280;el('game').clientHeight=720;
const step=(n=1)=>{for(let i=0;i<n;i++)tick(now+=16)},button=(i,pressed)=>{pad.buttons[i]={pressed,value:pressed?1:0}},release=i=>{button(i,false);step()},press=i=>{button(i,true);step()};
el('help-open').events.click=()=>{doc.documentElement.dataset.tutorialOpen='true'};
el('help-close').events.click=()=>{doc.documentElement.dataset.tutorialOpen='false'};
step(10);assert.equal(el('overlay').hidden,false,'The loop works without a controller');
pad={index:0,mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};
press(0);assert.equal(el('overlay').hidden,true,'Cross starts the game');assert.equal(locks,0,'Starting with a gamepad does not request pointer lock');
step(20);assert.doesNotMatch(el('message').textContent,/AUCUNE INTERACTION/,'Holding cross does not also interact');release(0);
const initial={...state.player};pad.axes[1]=-.1;step(40);assert.ok(Math.abs(state.player.x-initial.x)<.001,'The stick dead zone ignores drift');
pad.axes[1]=-1;step(30);assert.ok(initial.x-state.player.x>2,'The left stick moves forward');pad.axes[1]=0;
const yaw=state.cameraYaw;pad.axes[0]=1;step(15);assert.ok(state.cameraYaw<yaw-.3,'The left stick turns the player and camera');pad.axes[0]=0;
const look=state.cameraYaw;pad.axes[2]=1;pad.axes[3]=-1;step(15);
assert.equal(state.cameraYaw,look,'Moving the aim cursor does not turn the camera');
assert.ok(parseFloat(el('reticle').style.left)>50&&parseFloat(el('reticle').style.top)<50,'Right stick moves the cursor right and up');
pad.axes[2]=0;pad.axes[3]=0;
const shotView=lastView,ammo=state.player.ammo;press(7);assert.equal(state.player.ammo,ammo-1,'R2 fires');assert.equal(state.player.aiming,true,'The renderer receives the shooting pose');
const impact=state.impact,delta=[impact.x-shotView.eye[0],impact.y-shotView.eye[1],impact.z-shotView.eye[2]],f=shotView.target.map((v,i)=>v-shotView.eye[i]);
const h=Math.hypot(f[0],f[2]),right=[-f[2]/h,0,f[0]/h],up=[-right[2]*f[1],right[2]*f[0]-right[0]*f[2],right[0]*f[1]],dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const aimX=(parseFloat(el('reticle').style.left)-50)/50,aimY=(parseFloat(el('reticle').style.top)-50)/50;
assert.ok(Math.abs(dot(delta,right)/dot(delta,f)-aimX*Math.tan(Math.PI/6)*1280/720)<1e-5,'The shot follows the visible horizontal cursor with widescreen aspect');
assert.ok(Math.abs(dot(delta,up)/dot(delta,f)+aimY*Math.tan(Math.PI/6))<1e-5,'The shot follows the visible vertical cursor');
step(60);assert.equal(state.player.aiming,false,'The shooting pose ends');assert.equal(state.player.ammo,ammo-1,'Holding R2 does not fire repeatedly');release(7);press(7);assert.equal(state.player.ammo,ammo-2,'A fresh R2 press fires again');release(7);
pad.axes[2]=1;pad.axes[3]=-1;step(150);assert.equal(el('reticle').style.left,'95%','The cursor stops at the right edge');assert.equal(el('reticle').style.top,'5%','The cursor stops at the top edge');
pad.axes[2]=-1;pad.axes[3]=1;step(250);assert.equal(el('reticle').style.left,'5%','The cursor stops at the left edge');assert.equal(el('reticle').style.top,'95%','The cursor stops at the bottom edge');pad.axes[2]=0;pad.axes[3]=0;
press(11);assert.equal(el('reticle').style.left,'50%','R3 recenters horizontally');assert.equal(el('reticle').style.top,'50%','R3 recenters vertically');release(11);
// Keep normalized cursor coordinates across resize and use the new aspect.
el('game').clientWidth=720;el('game').clientHeight=1280;pad.axes[2]=-1;pad.axes[3]=-1;step(30);pad.axes[2]=0;pad.axes[3]=0;
const portraitView=lastView,portraitX=(parseFloat(el('reticle').style.left)-50)/50,portraitY=(parseFloat(el('reticle').style.top)-50)/50;press(7);
const pd=[state.impact.x-portraitView.eye[0],state.impact.y-portraitView.eye[1],state.impact.z-portraitView.eye[2]],pf=portraitView.target.map((v,i)=>v-portraitView.eye[i]),ph=Math.hypot(pf[0],pf[2]),pr=[-pf[2]/ph,0,pf[0]/ph],pu=[-pr[2]*pf[1],pr[2]*pf[0]-pr[0]*pf[2],pr[0]*pf[1]];
assert.ok(Math.abs(dot(pd,pr)/dot(pd,pf)-portraitX*Math.tan(Math.PI/6)*720/1280)<1e-5,'The leftward shot uses the resized portrait aspect');
assert.ok(Math.abs(dot(pd,pu)/dot(pd,pf)+portraitY*Math.tan(Math.PI/6))<1e-5,'The resized shot keeps its vertical alignment');release(7);el('game').clientWidth=1280;el('game').clientHeight=720;
pad.axes[2]=1;step(10);pad.axes[2]=0;doc.pointerLockElement=el('game');for(const handler of docHandlers.mousemove||[])handler({movementX:1,movementY:0});assert.equal(el('reticle').style.left,'50%','Returning to mouse look centers the cursor');doc.pointerLockElement=null;
press(2);assert.equal(state.player.reloading,true,'The renderer receives the reload pose');assert.ok(state.player.reloadTime>=0&&state.player.reloadTime<.1,'Reload animation begins at the start of the clip');release(2);step(30);assert.ok(state.player.reloadTime>.4,'Reload animation advances with gameplay time');step(45);assert.equal(state.player.reloading,false,'The reload pose ends');assert.equal(state.player.ammo,15,'Square reloads');
press(0);assert.match(el('message').textContent,/AUCUNE INTERACTION/,'Cross interacts in the mission');release(0);
press(9);assert.equal(doc.documentElement.dataset.tutorialOpen,'true','Options opens the guide');const paused={...state.player};pad.axes[1]=-1;step(80);assert.equal(state.player.x,paused.x,'The guide pauses movement');assert.equal(doc.documentElement.dataset.tutorialOpen,'true','Holding Options does not immediately close it');release(9);press(9);assert.equal(doc.documentElement.dataset.tutorialOpen,'false','A fresh Options press closes the guide');release(9);pad.axes[1]=0;
press(9);release(9);press(0);assert.equal(doc.documentElement.dataset.tutorialOpen,'false','Cross closes the guide');release(0);
pad.axes[1]=-1;step(10);const beforeDisconnect={...state.player};pad=null;step(60);assert.equal(state.player.x,beforeDisconnect.x,'Disconnecting clears movement');
pad={index:0,mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};button(7,true);const afterDisconnect=state.player.ammo;step(30);assert.equal(state.player.ammo,afterDisconnect,'A held trigger after reconnection cannot fire');release(7);press(7);assert.equal(state.player.ammo,afterDisconnect-1,'The trigger works again after release');release(7);
for(const f of windowHandlers.blur||[])f();button(7,true);for(const f of windowHandlers.focus||[])f();const afterBlur=state.player.ammo;step(30);assert.equal(state.player.ammo,afterBlur,'Returning focus with R2 held cannot fire');release(7);press(7);assert.equal(state.player.ammo,afterBlur-1,'A fresh press fires after focus is restored');
console.log('Gamepad tests passed: menu, dead zones, movement, aim, fire, reload, interaction, guide and reconnect/focus safety.');

// Verify phase transitions using the actual tutorial script and its pending start.
{
 const elements={},handlers={};let tick,now=0,pointerRequests=0;
 const doc={documentElement:{dataset:{}},pointerLockElement:null,addEventListener(n,f){(handlers[n]??=[]).push(f)},exitPointerLock(){}};
 function elem(id){return elements[id]??={textContent:'',innerHTML:'',style:{},hidden:false,disabled:false,events:{},classes:new Set(),get classList(){return {add:n=>this.classes.add(n),remove:n=>this.classes.delete(n),contains:n=>this.classes.has(n)}},querySelector(){return {textContent:''}},addEventListener(n,f,capture){(this.events[n]??=[]).push({f,capture:!!capture})},click(){let stopped=false,e={isTrusted:false,stopImmediatePropagation(){stopped=true}};for(const {f} of (this.events.click||[]).slice().sort((a,b)=>Number(b.capture)-Number(a.capture))){f(e);if(stopped)break}},focus(){},pause(){},load(){},removeAttribute(){},play(){return Promise.resolve()},showModal(){this.open=true},close(){this.open=false;for(const e of this.events.close||[])e.f()},requestPointerLock(){pointerRequests++}}}
 doc.getElementById=elem;
 const gp={index:0,mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};
 const scene={positions:new Float32Array([10,21.32,-5,75,21.32,-5,75,21.32,60,10,21.32,-5,75,21.32,60,10,21.32,60])};
 const c={document:doc,console,Float32Array,Map,Set,Math,Number,Array,SF_SCENE:scene,SF_BRIEFING:{directives:['Test'],objectives:['Test'],parameters:['Test']},navigator:{getGamepads:()=>[gp]},addEventListener(){},requestAnimationFrame(f){tick=f},SFRenderer:class{render(s){return {eye:[s.player.x+3,s.player.y+2,s.player.z],target:[s.player.x+2,s.player.y+2,s.player.z]}}}};c.window=c;vm.createContext(c);
 for(const p of ['web/tutorial.js','web/ps1-rules.js','web/game.js'])vm.runInContext(fs.readFileSync(p,'utf8'),c);
 const step=()=>tick(now+=16),cross=held=>{gp.buttons[0]={pressed:held,value:held?1:0};step()};step();cross(true);assert.equal(elem('cinematics').hidden,false,'Cross launches the intro');step();assert.equal(elem('cinematics').hidden,false,'Holding Cross does not skip the intro');cross(false);cross(true);assert.equal(elem('cinematics').hidden,true,'A fresh Cross skips the intro');assert.equal(elem('overlay').hidden,false,'The mission briefing appears');cross(false);cross(true);assert.equal(elem('controls-dialog').open,true,'Cross opens the required first-launch tutorial');step();assert.equal(elem('controls-dialog').open,true,'Holding Cross does not close the tutorial');cross(false);cross(true);assert.equal(elem('controls-dialog').open,false,'Cross closes the tutorial');assert.equal(elem('overlay').hidden,true,'Closing the tutorial starts the pending mission');assert.equal(pointerRequests,0,'The full gamepad flow never requests pointer lock');
 console.log('Gamepad intro, briefing and first-launch tutorial flow passed.');
}

// Chrome may keep a connected gamepad hidden until a button is pressed, and
// opening another tab can generate blur before the pad becomes visible.
{
 const elements={},windowHandlers={};let tick,pad=null,now=0;
 const doc={documentElement:{dataset:{}},addEventListener(){}};
 function elem(id){return elements[id]??={textContent:'',innerHTML:'',dataset:{},style:{},hidden:false,events:{},classList:{add(){},remove(){}},querySelector(){return {textContent:''}},addEventListener(n,f){this.events[n]=f},click(){this.events.click?.({isTrusted:false})},focus(){},pause(){},load(){},removeAttribute(){},play(){return Promise.resolve()}}}
 doc.getElementById=elem;
 const c={document:doc,console,Float32Array,Map,Set,Math,Number,Array,SF_SCENE:scene,SF_BRIEFING:{directives:['Test'],objectives:['Test'],parameters:['Test']},navigator:{getGamepads:()=>pad?[pad]:[null]},addEventListener(n,f){(windowHandlers[n]??=[]).push(f)},requestAnimationFrame(f){tick=f},SFRenderer:class{render(s){return {eye:[s.player.x+3,s.player.y+2,s.player.z],target:[s.player.x+2,s.player.y+2,s.player.z]}}}};c.window=c;vm.createContext(c);
 for(const p of ['web/ps1-rules.js','web/game.js'])vm.runInContext(fs.readFileSync(p,'utf8'),c);
 const step=()=>tick(now+=16);step();
 assert.match(elem('gamepad-status').textContent,/APPUYEZ SUR UNE TOUCHE/,'The title explains that browser activation is needed');
 for(const f of windowHandlers.blur||[])f();step();for(const f of windowHandlers.focus||[])f();step();
 pad={index:0,mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};
 pad.buttons[0]={pressed:true,value:1};step();
 assert.equal(elem('cinematics').hidden,false,'The first press that exposes the controller starts from the title, even after blur');
 assert.match(elem('gamepad-status').textContent,/CONNECTÉE/,'The title announces controller detection');
}

// Menu navigation uses the D-pad or vertical stick and confirms the selected
// entry, with Options available as an alternative to Cross.
{
 const elements={};let tick,now=0;
 const doc={documentElement:{dataset:{}},addEventListener(){}};
 function elem(id){return elements[id]??={textContent:'',innerHTML:'',dataset:{},style:{},hidden:false,events:{},classList:{add(){},remove(){}},querySelector(){return {textContent:''}},addEventListener(n,f){this.events[n]=f},click(){this.events.click?.({isTrusted:false})},focus(){},pause(){},load(){},removeAttribute(){},play(){return Promise.resolve()}}}
 doc.getElementById=elem;
 const gp={index:0,mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};
 const c={document:doc,console,Float32Array,Map,Set,Math,Number,Array,SF_SCENE:scene,SF_BRIEFING:{directives:['Test'],objectives:['Test'],parameters:['Test']},navigator:{getGamepads:()=>[gp]},addEventListener(){},requestAnimationFrame(f){tick=f},SFRenderer:class{render(s){return {eye:[s.player.x+3,s.player.y+2,s.player.z],target:[s.player.x+2,s.player.y+2,s.player.z]}}}};c.window=c;vm.createContext(c);
 for(const p of ['web/ps1-rules.js','web/game.js'])vm.runInContext(fs.readFileSync(p,'utf8'),c);
 let helpOpened=0;elem('help-brief').events.click=()=>helpOpened++;
 const step=()=>tick(now+=16);step();gp.buttons[13]={pressed:true,value:1};step();
 assert.equal(elem('help-brief').dataset.gamepadSelected,'true','D-pad down selects the controls entry');
 gp.buttons[13]={pressed:false,value:0};step();gp.buttons[0]={pressed:true,value:1};step();
 assert.equal(helpOpened,1,'Cross activates the selected controls entry');
 gp.buttons[0]={pressed:false,value:0};step();gp.axes[1]=-1;step();gp.axes[1]=0;step();
 assert.equal(elem('start').dataset.gamepadSelected,'true','Stick up selects the game entry');
 gp.buttons[9]={pressed:true,value:1};step();
 assert.equal(elem('cinematics').hidden,false,'Options activates the selected game entry');
 console.log('Gamepad first-exposure and title navigation tests passed.');
}
