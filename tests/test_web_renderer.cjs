// Check renderer initialization, texture binding, room visibility and camera output.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let draws=[], uniforms=[], models=[], bufferUpdates=0;
const gl=new Proxy({
  getShaderParameter(){return true;},getProgramParameter(){return true;},
  getAttribLocation(_,n){return {aPosition:0,aNormal:1,aUv:2,aVertexColor:3}[n];},getUniformLocation(_,n){return n;},
  createBuffer(){return {};},createTexture(){return {};},createShader(){return {};},createProgram(){return {};},
  uniform1f(name,value){uniforms.push([name,value]);},uniformMatrix4fv(name,transpose,value){if(name==='uModel')models.push(Array.from(value));},drawArrays(...args){draws.push(args);},bufferSubData(){bufferUpdates++;},
  getShaderInfoLog(){return '';},getProgramInfoLog(){return '';}
},{get(target,key){if(key in target)return target[key];if(typeof key==='string'&&key===key.toUpperCase())return 1;return ()=>{};}});
const context={console,Float32Array,Uint8Array,Uint16Array,Map,Set,Math,Number,Array,devicePixelRatio:1,Image:class{set src(value){assert.match(value,/^data:image\/png;base64,/);this.onload();}}};
context.window=context;vm.createContext(context);
for(const file of ['web/assets/georgia-street.js','web/assets/georgia-textured.js','web/assets/characters.js','web/assets/animations.js','web/assets/props.js','web/math.js','web/renderer.js'])vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
const scene=context.SF_TEXTURED_SCENE;
assert.equal(scene.positions.length,scene.uvs.length/2*3,'Each scene vertex has a texture coordinate');
assert.equal(scene.rooms.length,91);assert.equal(scene.visibility.length,91);
const canvas={clientWidth:1280,clientHeight:720,getContext(){return gl;}};
const renderer=new context.SFRenderer(canvas,context.SF_SCENE);
assert.ok(renderer.texturedReady,'The embedded texture atlas loads');
assert.ok(renderer.scene.uv,'The terrain has UV coordinates');
assert.ok(renderer.props && renderer.props.uv,'The original level props use the atlas');
assert.ok(renderer.characters.gabe.uv && renderer.characters.terro.uv,'The original characters use the atlas');
const camera=renderer.render({player:{x:47.8,y:21.32,z:28.25,angle:Math.PI/2},cameraYaw:Math.PI/2,cameraPitch:.05,enemies:[{x:39.8,y:21.32,z:26.25,angle:0,alive:true}]});
assert.equal(renderer.currentRoom,73,'The real starting point maps to room 73');
assert.equal(renderer.sceneRanges.length,9,'The starting room and its eight visible rooms are selected');
assert.ok(draws.length>=11,'The terrain rooms, player and enemy are rendered');
assert.ok(uniforms.some(([name,value])=>name==='uUseTexture'&&value===1),'Texturing is enabled');
assert.ok(camera.eye.every(Number.isFinite)&&camera.target.every(Number.isFinite),'The camera reports a valid aim ray');
const characterMatrix=models.find(m=>Math.abs(m[12]-47.8)<.01&&Math.abs(m[13]-21.32)<.01&&Math.abs(m[14]-28.25)<.01);
assert.ok(characterMatrix,'The original character is drawn at the player position');
const direction=[camera.target[0]-camera.eye[0],camera.target[2]-camera.eye[2]];
assert.ok(characterMatrix[8]*direction[0]+characterMatrix[10]*direction[1]>.8,'The character faces away from the camera toward the aim direction');
assert.equal(renderer.characters.gabe.clip,'idle','The original idle animation is used');
renderer.render({player:{x:47.8,y:21.32,z:28.25,angle:Math.PI/2,moving:true,running:true},cameraYaw:Math.PI/2,cameraPitch:.05,time:1});
assert.equal(renderer.characters.gabe.clip,'run','The original running animation is used');
assert.ok(bufferUpdates>=2,'Animation frames update the character mesh');
console.log('Renderer tests passed: PS1 textures, original models, room visibility and aim camera.');
// The camera follows the desired player heading smoothly, without feeding its
// interpolated yaw back into the input target; mouse look stays immediate.
const player={x:47.8,y:21.32,z:28.25,angle:Math.PI};
const beforeYaw=renderer.viewYaw;
let pose=renderer.render({player,cameraYaw:Math.PI,cameraPitch:.05,time:1.016});
const wrappedDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
assert.ok(wrappedDelta(pose.yaw,beforeYaw)>0 && wrappedDelta(pose.yaw,beforeYaw)<Math.PI/2,'Keyboard turning should move the camera gradually');
for(let i=2;i<=75;i++)pose=renderer.render({player,cameraYaw:Math.PI,cameraPitch:.05,time:1+i*.016});
assert.ok(Math.abs(wrappedDelta(pose.yaw,Math.PI))<.01,'The camera settles behind the desired heading');
pose=renderer.render({player,cameraYaw:-1,cameraPitch:.05,cameraImmediate:true,time:2.22});
assert.ok(Math.abs(wrappedDelta(pose.yaw,-1))<1e-6,'Pointer input responds without damping');
assert.ok(Math.abs(wrappedDelta(Math.atan2(-(pose.target[0]-pose.eye[0]),-(pose.target[2]-pose.eye[2])),pose.yaw))<1e-6,'The returned sight ray matches the displayed camera yaw');
renderer.render({player,cameraYaw:3.1,cameraImmediate:true,time:3});
pose=renderer.render({player,cameraYaw:-3.1,time:3.016});
assert.ok(wrappedDelta(pose.yaw,3.1)>0 && wrappedDelta(pose.yaw,3.1)<.1,'Follow takes the short route across the angle wrap');
pose=renderer.render({player,cameraYaw:.25,time:0});
assert.ok(Math.abs(wrappedDelta(pose.yaw,.25))<1e-6,'Restart resets the camera heading');
const wall=new Float32Array([-10,-1,1.5,10,-1,1.5,10,6,1.5,-10,-1,1.5,10,6,1.5,-10,6,1.5]);
const blockedRenderer=new context.SFRenderer(canvas,{positions:wall});
pose=blockedRenderer.render({player:{x:0,y:0,z:0,angle:0},cameraYaw:0,cameraPitch:0,time:0});
assert.ok(pose.eye[2]<1.5,'The following camera stays in front of a wall');
const drawCount=draws.length;
renderer.person({x:0,y:0,z:0,angle:0},false,false);
assert.equal(draws.length-drawCount,1,'No temporary black weapon box follows the character');
console.log('Camera tests passed: smooth follow, instant mouse look, wall clipping and no placeholder box.');
const reversePlayer={x:47.8,y:21.32,z:28.25,angle:0,moving:true,running:false,reverse:true,animationTime:0};
renderer.render({player:reversePlayer,cameraYaw:0,time:4});
assert.equal(renderer.characters.gabe.clip,'walk');
assert.equal(renderer.characters.gabe.frame,context.SF_ANIMATIONS.gabe.walk.frames.length-1,'Walking backwards reverses the animation instead of moonwalking');
reversePlayer.reverse=false;
renderer.render({player:reversePlayer,cameraYaw:0,time:4.016});
assert.equal(renderer.characters.gabe.frame,0,'Walking forwards plays the animation in normal order');
console.log('Backward walk animation test passed.');
vm.runInContext(fs.readFileSync('web/assets/weapon.js','utf8'),context,{filename:'web/assets/weapon.js'});
const armedRenderer=new context.SFRenderer(canvas,context.SF_SCENE);
assert.ok(armedRenderer.weapon && armedRenderer.weapon.textureReady,'The original handgun and its own atlas load');
const beforeArmed=draws.length;
armedRenderer.person({x:0,y:0,z:0,angle:0,moving:true,animationTime:0},false,false);
assert.equal(draws.length-beforeArmed,2,'The original handgun is drawn with Gabe');
const firstGrip=models[models.length-1];
armedRenderer.person({x:0,y:0,z:0,angle:0,moving:true,animationTime:.3},false,false);
const secondGrip=models[models.length-1];
assert.ok(firstGrip.slice(12,15).some((v,i)=>Math.abs(v-secondGrip[12+i])>.001),'The handgun follows the animated hand');
const beforeMarked=draws.length;
armedRenderer.render({player:{x:47.8,y:21.32,z:28.25},enemies:[{x:39.8,y:21.32,z:26.25,alive:true,marked:true}],time:0});
const markedDraws=draws.length-beforeMarked;
const beforeUnmarked=draws.length;
armedRenderer.render({player:{x:47.8,y:21.32,z:28.25},enemies:[{x:39.8,y:21.32,z:26.25,alive:true,marked:false}],time:0});
assert.equal(markedDraws,draws.length-beforeUnmarked+1,'Only visible marked enemies get a diamond');
console.log('Original handgun attachment and enemy marker tests passed.');
