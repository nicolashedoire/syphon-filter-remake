// Check renderer initialization, texture binding, room visibility and camera output.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let draws=[], uniforms=[], bufferUpdates=0;
const gl=new Proxy({
  getShaderParameter(){return true;},getProgramParameter(){return true;},
  getAttribLocation(_,n){return {aPosition:0,aNormal:1,aUv:2,aVertexColor:3}[n];},getUniformLocation(_,n){return n;},
  createBuffer(){return {};},createTexture(){return {};},createShader(){return {};},createProgram(){return {};},
  uniform1f(name,value){uniforms.push([name,value]);},drawArrays(...args){draws.push(args);},bufferSubData(){bufferUpdates++;},
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
assert.equal(renderer.characters.gabe.clip,'idle','The original idle animation is used');
renderer.render({player:{x:47.8,y:21.32,z:28.25,angle:Math.PI/2,moving:true,running:true},cameraYaw:Math.PI/2,cameraPitch:.05,time:1});
assert.equal(renderer.characters.gabe.clip,'run','The original running animation is used');
assert.ok(bufferUpdates>=2,'Animation frames update the character mesh');
console.log('Renderer tests passed: PS1 textures, original models, room visibility and aim camera.');
