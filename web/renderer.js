/* Minimal WebGL 1 renderer. World coordinates are meters with Y pointing up. */
(function (global) {
  'use strict';
  const M = global.SFMath;
  const VS = `attribute vec3 aPosition;
attribute vec3 aNormal;
uniform mat4 uViewProjection;
uniform mat4 uModel;
uniform vec3 uCamera;
varying vec3 vNormal;
varying float vDistance;
varying vec3 vWorld;
void main(){
  vec4 world=uModel*vec4(aPosition,1.0);
  vNormal=mat3(uModel)*aNormal;
  vWorld=world.xyz;
  vDistance=distance(world.xyz,uCamera);
  gl_Position=uViewProjection*world;
}`;
  const FS = `precision mediump float;
uniform vec3 uColor;
uniform float uScene;
varying vec3 vNormal;
varying float vDistance;
varying vec3 vWorld;
void main(){
  vec3 n=normalize(vNormal);
  float light=0.44+0.48*abs(dot(n,normalize(vec3(0.36,0.84,0.40))));
  float grain=0.97+0.03*sin(vWorld.x*0.7)*sin(vWorld.z*0.6);
  float floorShade=mix(0.90,1.04,abs(n.y));
  vec3 base=uColor*light*mix(1.0,grain*floorShade,uScene);
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
      this.locations={position:gl.getAttribLocation(p,'aPosition'),normal:gl.getAttribLocation(p,'aNormal'),viewProjection:gl.getUniformLocation(p,'uViewProjection'),model:gl.getUniformLocation(p,'uModel'),camera:gl.getUniformLocation(p,'uCamera'),color:gl.getUniformLocation(p,'uColor'),scene:gl.getUniformLocation(p,'uScene')};
      this.scene=makeBuffer(gl,sceneVertices(scene.positions));this.cube=makeBuffer(gl,cubeVertices());
      this.cameraWalls=cameraCollisionGrid(scene.positions);
      gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);
    }
    bind(mesh) {
      const gl=this.gl,loc=this.locations;gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);
      gl.enableVertexAttribArray(loc.position);gl.vertexAttribPointer(loc.position,3,gl.FLOAT,false,24,0);
      gl.enableVertexAttribArray(loc.normal);gl.vertexAttribPointer(loc.normal,3,gl.FLOAT,false,24,12);
    }
    draw(mesh,transform,color,isScene) {
      const gl=this.gl,loc=this.locations;this.bind(mesh);gl.uniformMatrix4fv(loc.model,false,transform);
      gl.uniform3fv(loc.color,color);gl.uniform1f(loc.scene,isScene?1:0);gl.drawArrays(gl.TRIANGLES,0,mesh.count);
    }
    box(x,y,z,angle,sx,sy,sz,color) {this.draw(this.cube,M.model(x,y,z,angle,sx,sy,sz),color,false);}
    person(person,enemy) {
      const x=person.x||0,y=person.y||0,z=person.z||0,a=person.angle||0,c=Math.cos(a),s=Math.sin(a);
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
      const dpr=Math.min(global.devicePixelRatio||1,2),w=Math.max(1,Math.round(this.canvas.clientWidth*dpr)),h=Math.max(1,Math.round(this.canvas.clientHeight*dpr));
      if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
      gl.viewport(0,0,w,h);gl.clearColor(.055,.077,.074,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
      const yaw=Number.isFinite(state.cameraYaw)?state.cameraYaw:0,pitch=Math.max(.06,Math.min(1.15,Number.isFinite(state.cameraPitch)?state.cameraPitch:.28)),distance=Math.max(1,Math.min(15,state.cameraDistance||4.3));
      const target=[p.x,p.y+1.15,p.z],eye=[target[0]+Math.sin(yaw)*Math.cos(pitch)*distance,target[1]+Math.sin(pitch)*distance,target[2]+Math.cos(yaw)*Math.cos(pitch)*distance];
      const fraction=cameraFraction(this.cameraWalls,target,eye);for(let i=0;i<3;i++)eye[i]=target[i]+(eye[i]-target[i])*fraction;
      const view=M.lookAt(eye,target,[0,1,0]),projection=M.perspective(Math.PI/3,w/h,.08,300),vp=M.multiply(projection,view);
      gl.uniformMatrix4fv(loc.viewProjection,false,vp);gl.uniform3fv(loc.camera,eye);
      this.draw(this.scene,M.identity(),[.45,.49,.46],true);
      if(state.objective){const o=state.objective;this.box(o.x,o.y+.1,o.z,0,.55,.2,.55,[.80,.82,.24]);this.box(o.x,o.y+.7,o.z,0,.12,1.2,.12,[.92,.82,.21]);}
      this.person(p,false);
      if(Array.isArray(state.enemies)) for(const enemy of state.enemies) if(enemy.alive!==false) this.person(enemy,true);
      return {eye,target};
    }
  }
  global.SFRenderer=SFRenderer;
})(window);
