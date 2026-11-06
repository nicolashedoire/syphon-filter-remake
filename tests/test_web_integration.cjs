// Exercise the real scene, renderer camera and shooting logic together with a stubbed GPU.
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'); const elements={},listeners={};let lastState,cam,cb,now=0;
const gl=new Proxy({getShaderParameter(){return true},getProgramParameter(){return true},getAttribLocation(_,n){return {aPosition:0,aNormal:1,aUv:2,aVertexColor:3}[n]},getUniformLocation(_,n){return n},createBuffer(){return {}},createTexture(){return {}},createShader(){return {}},createProgram(){return {}}}, {get(t,p){if(p in t)return t[p];if(typeof p==='string'&&p===p.toUpperCase())return 1;return ()=>{};}});
function el(id){return elements[id]??={clientWidth:1280,clientHeight:720,textContent:'',innerHTML:'',hidden:false,disabled:false,style:{},events:{},classList:{add(){},remove(){}},querySelector(){return {textContent:''}},getContext(){return gl},addEventListener(n,f){this.events[n]=f},focus(){},play(){return Promise.resolve()},pause(){},removeAttribute(n){if(n==='src')this.src=''},load(){}}}
const document={getElementById:el,addEventListener(n,f){(listeners[n]??=[]).push(f)},pointerLockElement:null,exitPointerLock(){this.pointerLockElement=null}};
const c={document,console,Float32Array,Uint8Array,Uint16Array,Map,Set,Math,Array,Number,Image:class{set src(v){this.onload()}},requestAnimationFrame(f){cb=f},addEventListener(){},devicePixelRatio:1};c.window=c;vm.createContext(c);
for(const p of ['web/assets/intro-briefing.js','web/assets/georgia-street.js','web/assets/georgia-textured.js','web/assets/characters.js','web/assets/animations.js','web/assets/props.js','web/ps1-rules.js','web/math.js','web/renderer.js'])vm.runInContext(fs.readFileSync(p,'utf8'),c);
const Base=c.SFRenderer;c.SFRenderer=class extends Base {render(s){lastState=JSON.parse(JSON.stringify(s));return cam=super.render(s)}};
vm.runInContext(fs.readFileSync('web/game.js','utf8'),c);
function frame(n=1){for(let i=0;i<n;i++)cb(now+=16)};function dispatch(name,e){for(const f of listeners[name]||[])f(e)};frame();el('start').events.click();assert.match(el('intro-video').src,/intro-general\.mp4$/);el('skip-intro').events.click();assert.ok(el('overlay-text').textContent.includes(c.SF_BRIEFING.directives[0]));el('start').events.click();document.pointerLockElement=el('game');frame();
// Real scene geometry: move, rotate, then remain inactive for over 60 seconds.
const initialHealth=lastState.player.health,initialArmor=lastState.player.armor;
dispatch('keydown',{key:'z',preventDefault(){}});frame(60);dispatch('keyup',{key:'z'});
dispatch('keydown',{key:'q',preventDefault(){}});frame(10);dispatch('keyup',{key:'q'});
dispatch('mousemove',{movementX:4,movementY:0});frame(4200);
assert.equal(lastState.player.health,initialHealth,'Health remains unchanged before a hostile hit');
assert.equal(lastState.player.armor,initialArmor,'Armor remains unchanged after walking, turning and waiting 67 seconds');
// Restart the same actual scene to independently exercise deliberate combat.
el('start').events.click();document.pointerLockElement=el('game');frame();
for (let round=0;round<3;round++) {let enemy=lastState.enemies.find(x=>x.alive); if(!enemy)break;
 for(let j=0;j<8;j++){const dx=enemy.x-cam.eye[0],dy=enemy.y+1.15-cam.eye[1],dz=enemy.z-cam.eye[2];let yaw=Math.atan2(-dx,-dz),pitch=-Math.atan2(dy,Math.hypot(dx,dz));let dyaw=Math.atan2(Math.sin(lastState.cameraYaw-yaw),Math.cos(lastState.cameraYaw-yaw));dispatch('mousemove',{movementX:dyaw/.003,movementY:(pitch-lastState.cameraPitch)/.002});frame();}
 for(let j=0;j<2;j++){el('game').events.mousedown({button:0,clientX:0,clientY:0});frame(20);assert.match(el('message').textContent,/CIBLE TOUCHÉE|MENACE NEUTRALISÉE|ZONE SÉCURISÉE/);}
}
assert.equal(lastState.enemies.filter(e=>e.alive).length,0);
console.log('Full scene integration test passed: 67 seconds without passive damage, camera input, intro and combat.');
