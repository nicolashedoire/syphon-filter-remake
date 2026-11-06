/* Minimal WebGL 1 renderer. World coordinates are meters with Y pointing up. */
(function (global) {
  'use strict';
  const M = global.SFMath;
  const VS = `attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUv;
attribute vec3 aVertexColor;
uniform mat4 uViewProjection;
uniform mat4 uModel;
uniform vec3 uCamera;
varying vec3 vNormal;
varying float vDistance;
varying vec3 vWorld;
varying vec2 vUv;
varying vec3 vColor;
void main(){
  vUv=aUv;
  vColor=aVertexColor;
  vec4 world=uModel*vec4(aPosition,1.0);
  vNormal=mat3(uModel)*aNormal;
  vWorld=world.xyz;
  vDistance=distance(world.xyz,uCamera);
  gl_Position=uViewProjection*world;
}`;
  const FS = `precision mediump float;
uniform vec3 uColor;
uniform float uScene;
uniform float uUseTexture;
uniform float uUseVertexColor;
uniform sampler2D uAtlas;
varying vec3 vNormal;
varying float vDistance;
varying vec3 vWorld;
varying vec2 vUv;
varying vec3 vColor;
void main(){
  vec3 n=normalize(vNormal);
  float light=0.44+0.48*abs(dot(n,normalize(vec3(0.36,0.84,0.40))));
  float grain=0.97+0.03*sin(vWorld.x*0.7)*sin(vWorld.z*0.6);
  float floorShade=mix(0.90,1.04,abs(n.y));
  vec4 tex=texture2D(uAtlas,vUv);
  if(uUseTexture>0.5 && tex.a<0.05) discard;
  vec3 material=mix(mix(uColor,vColor,uUseVertexColor),tex.rgb,uUseTexture);
  vec3 base=material*light*mix(1.0,grain*floorShade,uScene);
  float fog=smoothstep(32.0,125.0,vDistance);
  gl_FragColor=vec4(mix(base,vec3(0.055,0.077,0.074),fog),1.0);
}`;
  function compile(gl,type,source) {
    const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error('WebGL shader: '+gl.getShaderInfoLog(shader));
    return shader;
  }
  function makeBuffer(gl,vertices) {
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.STATIC_DRAW);
    return {buffer,count:vertices.length/6};
  }
  // Expand flat triangles into an interleaved position / per-face normal buffer.
  function sceneVertices(positions) {
    if (!positions || positions.length % 9) throw new Error('Invalid scene triangle positions');
    const output=new Float32Array(positions.length*2);
    for(let i=0,j=0;i<positions.length;i+=9,j+=18){
      const ax=positions[i],ay=positions[i+1],az=positions[i+2];
      const ux=positions[i+3]-ax,uy=positions[i+4]-ay,uz=positions[i+5]-az;
      const vx=positions[i+6]-ax,vy=positions[i+7]-ay,vz=positions[i+8]-az;
      let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
      const len=Math.hypot(nx,ny,nz)||1;nx/=len;ny/=len;nz/=len;
      for(let k=0;k<3;k++){const d=j+k*6,s=i+k*3;output[d]=positions[s];output[d+1]=positions[s+1];output[d+2]=positions[s+2];output[d+3]=nx;output[d+4]=ny;output[d+5]=nz;}
    }
    return output;
  }
  // Index nearly vertical triangles so the third-person camera does not pass
  // through surrounding walls. Large triangles are checked separately.
  function cameraCollisionGrid(positions) {
    const cells = new Map(), large = [], cellSize = 5;
    for (let i=0;i<positions.length;i+=9) {
      const ax=positions[i],ay=positions[i+1],az=positions[i+2];
      const ux=positions[i+3]-ax,uy=positions[i+4]-ay,uz=positions[i+5]-az;
      const vx=positions[i+6]-ax,vy=positions[i+7]-ay,vz=positions[i+8]-az;
      const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx, length=Math.hypot(nx,ny,nz);
      if (!length || Math.abs(ny/length)>.72) continue;
      const x0=Math.floor(Math.min(ax,positions[i+3],positions[i+6])/cellSize),x1=Math.floor(Math.max(ax,positions[i+3],positions[i+6])/cellSize);
      const z0=Math.floor(Math.min(az,positions[i+5],positions[i+8])/cellSize),z1=Math.floor(Math.max(az,positions[i+5],positions[i+8])/cellSize);
      if ((x1-x0+1)*(z1-z0+1)>100) { large.push(i); continue; }
      for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){
        const key=x+','+z;let bucket=cells.get(key);if(!bucket){bucket=[];cells.set(key,bucket);}bucket.push(i);
      }
    }
    return {positions,cells,large,cellSize};
  }
  function cameraFraction(grid,origin,eye) {
    const dx=eye[0]-origin[0],dy=eye[1]-origin[1],dz=eye[2]-origin[2], cs=grid.cellSize;
    const x0=Math.floor(Math.min(origin[0],eye[0])/cs),x1=Math.floor(Math.max(origin[0],eye[0])/cs);
    const z0=Math.floor(Math.min(origin[2],eye[2])/cs),z1=Math.floor(Math.max(origin[2],eye[2])/cs);
    const candidates=new Set(grid.large);
    for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const bucket=grid.cells.get(x+','+z);if(bucket)for(const i of bucket)candidates.add(i);}
    const p=grid.positions;let nearest=1;
    for(const i of candidates){
      const ax=p[i],ay=p[i+1],az=p[i+2],e1x=p[i+3]-ax,e1y=p[i+4]-ay,e1z=p[i+5]-az,e2x=p[i+6]-ax,e2y=p[i+7]-ay,e2z=p[i+8]-az;
      const hx=dy*e2z-dz*e2y,hy=dz*e2x-dx*e2z,hz=dx*e2y-dy*e2x,det=e1x*hx+e1y*hy+e1z*hz;
      if(Math.abs(det)<1e-8)continue;
      const inv=1/det,sx=origin[0]-ax,sy=origin[1]-ay,sz=origin[2]-az,u=inv*(sx*hx+sy*hy+sz*hz);
      if(u<0||u>1)continue;
      const qx=sy*e1z-sz*e1y,qy=sz*e1x-sx*e1z,qz=sx*e1y-sy*e1x,v=inv*(dx*qx+dy*qy+dz*qz);
      if(v<0||u+v>1)continue;
      const t=inv*(e2x*qx+e2y*qy+e2z*qz);if(t>.035&&t<nearest)nearest=t;
    }
    // Keep a small gap to avoid clipping against the camera's near plane.
    return Math.max(.08,Math.min(1,nearest-.06));
  }
  function cubeVertices() {
    const faces=[
      [[0,0,1],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]],
      [[0,0,-1],[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]],
      [[1,0,0],[.5,-.5,.5],[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5]],
      [[-1,0,0],[-.5,-.5,-.5],[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5]],
      [[0,1,0],[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]],
      [[0,-1,0],[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]]
    ];
    const data=[];for(const face of faces) for(const index of [1,2,3,1,3,4]) data.push(...face[index],...face[0]);
    return new Float32Array(data);
  }
  class SFRenderer {
    constructor(canvas,scene) {
      if (!M) throw new Error('SFMath was not loaded');
      this.canvas=canvas;
      const gl=canvas.getContext('webgl',{antialias:true,alpha:false})||canvas.getContext('experimental-webgl');
      if(!gl) throw new Error('WebGL is not available');
      this.gl=gl;
      const p=gl.createProgram();gl.attachShader(p,compile(gl,gl.VERTEX_SHADER,VS));gl.attachShader(p,compile(gl,gl.FRAGMENT_SHADER,FS));gl.linkProgram(p);
      if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error('WebGL program: '+gl.getProgramInfoLog(p));
      this.program=p;gl.useProgram(p);
      this.locations={position:gl.getAttribLocation(p,'aPosition'),normal:gl.getAttribLocation(p,'aNormal'),uv:gl.getAttribLocation(p,'aUv'),vertexColor:gl.getAttribLocation(p,'aVertexColor'),useVertexColor:gl.getUniformLocation(p,'uUseVertexColor'),useTexture:gl.getUniformLocation(p,'uUseTexture'),atlas:gl.getUniformLocation(p,'uAtlas'),viewProjection:gl.getUniformLocation(p,'uViewProjection'),model:gl.getUniformLocation(p,'uModel'),camera:gl.getUniformLocation(p,'uCamera'),color:gl.getUniformLocation(p,'uColor'),scene:gl.getUniformLocation(p,'uScene')};
      const textured=global.SF_TEXTURED_SCENE;
      const data=textured && textured.positions && textured.uvs ? textured : scene;
      this.scene=makeBuffer(gl,sceneVertices(data.positions));this.cube=makeBuffer(gl,cubeVertices());
      // A small diamond makes visible enemies distinguishable from the scenery.
      this.enemyMarker=makeBuffer(gl,sceneVertices(new Float32Array([
        0,1,0, -1,0,0, 0,0,1, 0,1,0, 0,0,1, 1,0,0,
        0,1,0, 1,0,0, 0,0,-1, 0,1,0, 0,0,-1, -1,0,0,
        0,-1,0, 0,0,1, -1,0,0, 0,-1,0, 1,0,0, 0,0,1,
        0,-1,0, 0,0,-1, 1,0,0, 0,-1,0, -1,0,0, 0,0,-1
      ])));
      this.rooms=Array.isArray(data.rooms)?data.rooms:null;this.visibility=Array.isArray(data.visibility)?data.visibility:null;
      this.currentRoom=73;this.sceneRanges=null;
      this.texturedReady=false;this.atlasTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.atlasTexture);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
      if(data.uvs && data.uvs.length===data.positions.length/3*2 && data.atlas){
        this.scene.uv=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.scene.uv);gl.bufferData(gl.ARRAY_BUFFER,data.uvs,gl.STATIC_DRAW);
        const image=new Image();image.onload=()=>{gl.bindTexture(gl.TEXTURE_2D,this.atlasTexture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);this.texturedReady=true;};image.src=data.atlas;
      }
      this.props=null;this.propObjects=[];
      if(global.SF_PROPS&&data.materials){const source=global.SF_PROPS,uv=new Float32Array(source.positions.length/3*2);let valid=true;
        for(let i=0;i<source.positions.length/3;i++){const slot=data.materials[source.pages[i]+':0:'+source.cluts[i]];if(!slot){valid=false;break;}
          uv[i*2]=(slot[0]+Math.min(source.uvs[i*2],127)+.5)/1024;uv[i*2+1]=(slot[1]+source.uvs[i*2+1]+.5)/2048;}
        if(valid){this.props=makeBuffer(gl,sceneVertices(source.positions));this.props.uv=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.props.uv);gl.bufferData(gl.ARRAY_BUFFER,uv,gl.STATIC_DRAW);this.propObjects=source.objects||[];}}
      this.characters={};
      if(global.SF_CHARACTERS){for(const name of ['gabe','terro']){
        const source=global.SF_CHARACTERS[name];if(!source||!source.positions||!source.parts||source.parts.length!==source.positions.length/3)continue;
        const mesh=makeBuffer(gl,sceneVertices(source.positions));const colors=new Float32Array(source.parts.length*3);
        for(let i=0;i<source.parts.length;i++){const part=source.parts[i],skin=part===0||part===2||part===8,feet=part===1||part===7;
          const color=skin?(name==='gabe'?[.68,.49,.35]:[.62,.43,.31]):feet?[.09,.09,.085]:name==='gabe'?[.16,.20,.23]:[.34,.27,.20];colors.set(color,i*3);}
        mesh.colors=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,mesh.colors);gl.bufferData(gl.ARRAY_BUFFER,colors,gl.STATIC_DRAW);
        if(data.materials && source.uvs && source.cluts && source.tpages){
          const uv=new Float32Array(source.parts.length*2);let valid=true;
          for(let i=0;i<source.parts.length;i++){const page=source.tpages[i]&31,clut=source.cluts[i],slot=data.materials[page+':0:'+clut];
            if(!slot){valid=false;break;}uv[i*2]=(slot[0]+Math.min(source.uvs[i*2],127)+.5)/1024;uv[i*2+1]=(slot[1]+source.uvs[i*2+1]+.5)/2048;}
          if(valid){mesh.uv=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,mesh.uv);gl.bufferData(gl.ARRAY_BUFFER,uv,gl.STATIC_DRAW);}
        }
        this.characters[name]=mesh;
      }}
      const weapon=global.SF_WEAPON;
      if(weapon&&weapon.positions&&weapon.uvs&&weapon.atlas){
        const mesh=makeBuffer(gl,sceneVertices(weapon.positions));
        mesh.uv=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,mesh.uv);gl.bufferData(gl.ARRAY_BUFFER,weapon.uvs,gl.STATIC_DRAW);
        mesh.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,mesh.texture);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([255,255,255,255]));
        const image=new Image();image.onload=()=>{gl.bindTexture(gl.TEXTURE_2D,mesh.texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);mesh.textureReady=true;};image.src=weapon.atlas;
        this.weapon=mesh;
      }
      const extra=global.SF_PROPS&&global.SF_PROPS.positions;
      const collisionData=new Float32Array(scene.positions.length+(extra?extra.length:0));collisionData.set(scene.positions);if(extra)collisionData.set(extra,scene.positions.length);
      this.cameraWalls=cameraCollisionGrid(collisionData);
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
    }
    bind(mesh) {
      const gl=this.gl,loc=this.locations;gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
      gl.enableVertexAttribArray(loc.position);gl.vertexAttribPointer(loc.position,3,gl.FLOAT,false,24,0);
      gl.enableVertexAttribArray(loc.normal);gl.vertexAttribPointer(loc.normal,3,gl.FLOAT,false,24,12);
      if(mesh.uv){gl.bindBuffer(gl.ARRAY_BUFFER,mesh.uv);gl.enableVertexAttribArray(loc.uv);gl.vertexAttribPointer(loc.uv,2,gl.FLOAT,false,0,0);}
      else {gl.disableVertexAttribArray(loc.uv);gl.vertexAttrib2f(loc.uv,0,0);}
      if(mesh.colors){gl.bindBuffer(gl.ARRAY_BUFFER,mesh.colors);gl.enableVertexAttribArray(loc.vertexColor);gl.vertexAttribPointer(loc.vertexColor,3,gl.FLOAT,false,0,0);}
      else {gl.disableVertexAttribArray(loc.vertexColor);gl.vertexAttrib3f(loc.vertexColor,1,1,1);}
    }
    draw(mesh,transform,color,isScene,ranges) {
      const gl=this.gl,loc=this.locations;this.bind(mesh);gl.uniformMatrix4fv(loc.model,false,transform);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,mesh.texture||this.atlasTexture);gl.uniform1i(loc.atlas,0);
      gl.uniform1f(loc.useTexture,mesh.uv && (mesh.texture?mesh.textureReady:this.texturedReady) ? 1 : 0);
      gl.uniform1f(loc.useVertexColor,mesh.colors ? 1 : 0);
      gl.uniform3fv(loc.color,color);gl.uniform1f(loc.scene,isScene?1:0);
      if(ranges){for(const range of ranges)gl.drawArrays(gl.TRIANGLES,range.start,range.count);}
      else if(isScene&&this.sceneRanges){for(const range of this.sceneRanges)gl.drawArrays(gl.TRIANGLES,range.start,range.count);}
      else gl.drawArrays(gl.TRIANGLES,0,mesh.count);
    }
    updateRooms(player){
      if(!this.rooms||!this.visibility)return;
      const contains=r=>r&&player.x>=r.min[0]-.05&&player.x<=r.max[0]+.05&&player.z>=r.min[2]-.05&&player.z<=r.max[2]+.05&&player.y>=r.min[1]-.3&&player.y<=r.max[1]+.3;
      if(!contains(this.rooms[this.currentRoom])){
        let best=-1,bestArea=Infinity;
        for(let i=0;i<this.rooms.length;i++){const r=this.rooms[i];if(!contains(r))continue;const area=(r.max[0]-r.min[0])*(r.max[2]-r.min[2]);if(area<bestArea){bestArea=area;best=i;}}
        if(best>=0)this.currentRoom=best;
      }
      const ids=[this.currentRoom,...(this.visibility[this.currentRoom]||[])];
      this.visibleRooms=new Set(ids);
      this.sceneRanges=[...this.visibleRooms].map(i=>this.rooms[i]).filter(r=>r&&r.count>0);
    }
    box(x,y,z,angle,sx,sy,sz,color) {this.draw(this.cube,M.model(x,y,z,angle,sx,sy,sz),color,false);}
    person(person,enemy,firing) {
      const x=person.x||0,y=person.y||0,z=person.z||0,a=person.angle||0,c=Math.cos(a),s=Math.sin(a);
      const original=this.characters[enemy?'terro':'gabe'];
      if(original){
        let pose=global.SF_CHARACTERS[enemy?'terro':'gabe'].positions;
        if(!enemy && global.SF_ANIMATIONS && global.SF_ANIMATIONS.gabe){
          const name=person.moving?(person.running?'run':'walk'):'idle';
          const clip=global.SF_ANIMATIONS.gabe[name];
          if(clip&&clip.frames&&clip.frames.length){
            const phase=Math.floor((Number.isFinite(person.animationTime)?person.animationTime:this.animationTime||0)*clip.fps)%clip.frames.length;
            const frame=person.reverse&&name!=='idle'?clip.frames.length-1-phase:phase;
            pose=clip.frames[frame];
            if(original.clip!==name||original.frame!==frame){
              this.gl.bindBuffer(this.gl.ARRAY_BUFFER,original.buffer);
              this.gl.bufferSubData(this.gl.ARRAY_BUFFER,0,sceneVertices(clip.frames[frame]));
              original.clip=name;original.frame=frame;
            }
          }
        }
        // The exported HMD's visible front faces the reverse of the game heading.
        const characterModel=M.model(x,y,z,a+Math.PI,1,1,1);
        this.draw(original,characterModel,[1,1,1],false);
        if(!enemy&&this.weapon){
          // The original attaches GLOKSIL to RightHan. Our baked frames retain
          // hand vertices but not their joint matrices, so use their centroid.
          const parts=global.SF_CHARACTERS.gabe.parts;let hx=0,hy=0,hz=0,count=0;
          for(let i=0;i<parts.length;i++)if(parts[i]===8){hx+=pose[i*3];hy+=pose[i*3+1];hz+=pose[i*3+2];count++;}
          // Turn the approximate wrist slightly outward so the barrel remains
          // visible from the third-person camera until joint rotations are recovered.
          if(count){const grip=M.model(hx/count,hy/count,hz/count,Math.PI+.55,1,1,1);this.draw(this.weapon,M.multiply(characterModel,grip),[.3,.3,.3],false);}
        }
        return;
      }
      const part=(dx,dy,dz,sx,sy,sz,color) => this.box(x+c*dx+s*dz,y+dy,z-s*dx+c*dz,a,sx,sy,sz,color);
      const cloth=enemy?[.30,.23,.20]:[.13,.18,.20], pants=enemy?[.22,.20,.18]:[.14,.15,.16];
      part(-.14,.43,0,.22,.77,.25,pants);part(.14,.43,0,.22,.77,.25,pants);
      part(-.14,.06,-.06,.23,.12,.38,[.08,.09,.09]);part(.14,.06,-.06,.23,.12,.38,[.08,.09,.09]);
      part(0,1.07,0,.58,.67,.29,cloth);part(0,1.17,.16,.48,.36,.06,[.20,.24,.23]);
      part(0,1.58,0,.28,.32,.25,[.59,.48,.37]);part(0,1.76,.01,.29,.09,.26,[.11,.11,.10]);
      part(-.36,1.09,0,.16,.58,.19,cloth);part(.36,1.10,-.07,.16,.56,.18,cloth);
      part(.37,.98,-.23,.13,.13,.35,[.12,.13,.13]);
    }
    render(state) {
      const gl=this.gl,loc=this.locations,p=state.player||{x:0,y:0,z:0,angle:0};
      this.animationTime=Number.isFinite(state.time)?state.time:0;
      const dpr=Math.min(global.devicePixelRatio||1,2),w=Math.max(1,Math.round(this.canvas.clientWidth*dpr)),h=Math.max(1,Math.round(this.canvas.clientHeight*dpr));
      if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
      gl.viewport(0,0,w,h);gl.clearColor(.055,.077,.074,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
      const desiredYaw=Number.isFinite(state.cameraYaw)?state.cameraYaw:0;
      const frameDelta=this.animationTime-(this.yawTime??this.animationTime);
      if(!Number.isFinite(this.viewYaw)||frameDelta<0||state.cameraImmediate)this.viewYaw=desiredYaw;
      else if(frameDelta>0){
        const delta=Math.atan2(Math.sin(desiredYaw-this.viewYaw),Math.cos(desiredYaw-this.viewYaw));
        const next=this.viewYaw+delta*(1-Math.exp(-12*Math.min(.1,frameDelta)));
        this.viewYaw=Math.atan2(Math.sin(next),Math.cos(next));
      }
      this.yawTime=this.animationTime;
      const yaw=this.viewYaw,pitch=Math.max(-.7,Math.min(.8,Number.isFinite(state.cameraPitch)?state.cameraPitch:.1)),distance=Math.max(1,Math.min(15,state.cameraDistance||3.8));
      const anchor=[p.x,p.y+1.45,p.z],sy=Math.sin(yaw),cy=Math.cos(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
      const eye=[anchor[0]+sy*cp*distance+cy*.65,anchor[1]+sp*distance+.25,anchor[2]+cy*cp*distance-sy*.65];
      const desiredFraction=cameraFraction(this.cameraWalls,anchor,eye);
      const elapsed=this.animationTime-(this.cameraTime??this.animationTime);
      if(!Number.isFinite(this.cameraDistanceFraction)||elapsed<0)this.cameraDistanceFraction=desiredFraction;
      else if(desiredFraction<this.cameraDistanceFraction)this.cameraDistanceFraction=desiredFraction;
      else this.cameraDistanceFraction+=(desiredFraction-this.cameraDistanceFraction)*(1-Math.exp(-8*Math.min(.1,Math.max(1/60,elapsed))));
      this.cameraTime=this.animationTime;
      for(let i=0;i<3;i++)eye[i]=anchor[i]+(eye[i]-anchor[i])*this.cameraDistanceFraction;
      const target=[eye[0]-sy*cp,eye[1]-sp,eye[2]-cy*cp];
      const view=M.lookAt(eye,target,[0,1,0]),projection=M.perspective(Math.PI/3,w/h,.08,300),vp=M.multiply(projection,view);
      gl.uniformMatrix4fv(loc.viewProjection,false,vp);gl.uniform3fv(loc.camera,eye);
      this.updateRooms(p);
      this.draw(this.scene,M.identity(),[.45,.49,.46],true);
      if(this.props){const visible=this.propObjects.filter(o=>!this.visibleRooms||o.rooms.some(r=>this.visibleRooms.has(r)));this.draw(this.props,M.identity(),[1,1,1],false,visible);}
      if(state.objective){const o=state.objective;this.box(o.x,o.y+.1,o.z,0,.55,.2,.55,[.80,.82,.24]);this.box(o.x,o.y+.7,o.z,0,.12,1.2,.12,[.92,.82,.21]);}
      if(state.impact){const i=state.impact;this.box(i.x,i.y,i.z,0,.17,.17,.17,i.hit?[1,.72,.18]:[.9,.85,.55]);}
      this.person(p,false,!!state.impact);
      if(Array.isArray(state.enemies)) for(const enemy of state.enemies) if(enemy.alive!==false) {
        this.person(enemy,true);
        if(enemy.marked) this.draw(this.enemyMarker,M.model(enemy.x,enemy.y+2.12,enemy.z,0,.13,.19,.13),[1,.13,.08],false);
      }
      return {eye,target,yaw};
    }
  }
  global.SFRenderer=SFRenderer;
})(window);
