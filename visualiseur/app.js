(() => {
  'use strict';
  const canvas = document.querySelector('#view'), message = document.querySelector('#message'), stats = document.querySelector('#stats');
  const gl = canvas.getContext('webgl', {antialias:true});
  if (!gl) { message.textContent = 'WebGL est indisponible dans ce navigateur.'; return; }
  const shader = (type, source) => { const s=gl.createShader(type); gl.shaderSource(s,source); gl.compileShader(s); if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const program=gl.createProgram();
  gl.attachShader(program,shader(gl.VERTEX_SHADER,`attribute vec3 position; attribute vec3 normal; uniform mat4 matrix; varying vec3 n; void main(){n=normal; gl_Position=matrix*vec4(position,1.0);}`));
  gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`precision mediump float; varying vec3 n; void main(){float l=0.32+0.68*abs(dot(normalize(n),normalize(vec3(0.4,0.8,0.5)))); gl_FragColor=vec4(vec3(0.60,0.72,0.53)*l,1.0);}`));
  gl.linkProgram(program); if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program); gl.enable(gl.DEPTH_TEST);
  const buffer=gl.createBuffer(), pos=gl.getAttribLocation(program,'position'), norm=gl.getAttribLocation(program,'normal'), matrixLoc=gl.getUniformLocation(program,'matrix');
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer); gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos,3,gl.FLOAT,false,24,0); gl.enableVertexAttribArray(norm); gl.vertexAttribPointer(norm,3,gl.FLOAT,false,24,12);
  let data=[], faces=0, yaw=.7, pitch=-.45, distance=3.5, dragging=false, lastX=0,lastY=0;
  function parse(text) {
    const vertices=[], triangles=[]; let count=0;
    for (const line of text.split(/\r?\n/)) {
      const fields=line.trim().split(/\s+/); if(fields[0]==='v' && fields.length>=4){const v=fields.slice(1,4).map(Number);if(v.every(Number.isFinite)) { v[1] = -v[1]; vertices.push(v); }}
      if(fields[0]==='f' && fields.length>=4){const indices=fields.slice(1).map(x=>{const i=Number.parseInt(x.split('/')[0],10);return i<0?vertices.length+i:i-1});if(indices.some(i=>!Number.isInteger(i)||i<0||i>=vertices.length))throw new Error('Une face référence un sommet absent.');for(let k=1;k<indices.length-1;k++){triangles.push(vertices[indices[0]],vertices[indices[k]],vertices[indices[k+1]]);count++;}}
    }
    if(!count)throw new Error('Aucune face lisible dans ce fichier OBJ.');return {triangles,count};
  }
  function setGeometry(objects){
    const verts=objects.flatMap(o=>o.triangles), low=[Infinity,Infinity,Infinity], high=[-Infinity,-Infinity,-Infinity];
    for(const v of verts) for(let i=0;i<3;i++){low[i]=Math.min(low[i],v[i]); high[i]=Math.max(high[i],v[i]);}
    const center=low.map((v,i)=>(v+high[i])/2), scale=2/(Math.max(...high.map((v,i)=>v-low[i]))||1); data=[];
    for(let i=0;i<verts.length;i+=3){const a=verts[i],b=verts[i+1],c=verts[i+2],u=b.map((x,j)=>x-a[j]),v=c.map((x,j)=>x-a[j]);let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]], len=Math.hypot(...n)||1;n=n.map(x=>x/len);for(const p of [a,b,c])data.push(...p.map((x,j)=>(x-center[j])*scale),...n);}
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);faces=verts.length/3;message.textContent='';stats.textContent=`${objects.length} FICHIER(S) · ${faces.toLocaleString('fr-FR')} TRIANGLES`;yaw=.7;pitch=-.45;distance=3.5;draw();
  }
  function mul(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)o[c*4+r]+=a[k*4+r]*b[c*4+k];return o;}
  function draw(){
    const ratio=Math.min(window.devicePixelRatio||1,2), w=Math.max(1,Math.round(canvas.clientWidth*ratio)),h=Math.max(1,Math.round(canvas.clientHeight*ratio));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);gl.clearColor(.045,.075,.06,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(!faces)return;
    const f=1/Math.tan(Math.PI/6),aspect=w/h,near=.01,far=100,p=new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);
    const cy=Math.cos(yaw),sy=Math.sin(yaw),cx=Math.cos(pitch),sx=Math.sin(pitch),ry=new Float32Array([cy,0,-sy,0,0,1,0,0,sy,0,cy,0,0,0,0,1]),rx=new Float32Array([1,0,0,0,0,cx,sx,0,0,-sx,cx,0,0,0,0,1]),t=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,-distance,1]);
    gl.uniformMatrix4fv(matrixLoc,false,mul(p,mul(t,mul(rx,ry))));gl.drawArrays(gl.TRIANGLES,0,faces*3);
  }
  document.querySelector('#files').addEventListener('change',async e=>{try{const selected=[...e.target.files];if(!selected.length)return;message.textContent='Lecture des fichiers…';const objects=await Promise.all(selected.map(async f=>parse(await f.text())));setGeometry(objects);}catch(err){message.textContent='Impossible de lire la géométrie : '+err.message;}});
  canvas.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId)});canvas.addEventListener('pointermove',e=>{if(!dragging)return;yaw+=(e.clientX-lastX)*.01;pitch=Math.max(-1.55,Math.min(1.55,pitch+(e.clientY-lastY)*.01));lastX=e.clientX;lastY=e.clientY;draw()});canvas.addEventListener('pointerup',()=>dragging=false);canvas.addEventListener('pointercancel',()=>dragging=false);canvas.addEventListener('wheel',e=>{e.preventDefault();distance=Math.max(1.3,Math.min(15,distance*Math.exp(e.deltaY*.001)));draw()},{passive:false});canvas.addEventListener('dblclick',()=>{yaw=.7;pitch=-.45;distance=3.5;draw()});window.addEventListener('resize',draw);draw();
})();
