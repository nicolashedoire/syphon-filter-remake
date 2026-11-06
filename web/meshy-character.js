/* Runtime adapter for a skinned Meshy GLB. Does not modify or submit the model. */
(function (global) {
  'use strict';
  const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const formats = {
    5120: ['getInt8', 1], 5121: ['getUint8', 1], 5122: ['getInt16', 2],
    5123: ['getUint16', 2], 5125: ['getUint32', 4], 5126: ['getFloat32', 4]
  };
  const identity = () => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  function multiply(a,b) {
    const out=new Float32Array(16);
    for(let c=0;c<4;c++) for(let r=0;r<4;r++)
      out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];
    return out;
  }
  function matrix(t,q,s) {
    const [x,y,z,w]=q, x2=x+x,y2=y+y,z2=z+z;
    const xx=x*x2, xy=x*y2, xz=x*z2, yy=y*y2, yz=y*z2, zz=z*z2;
    const wx=w*x2, wy=w*y2, wz=w*z2;
    return new Float32Array([
      (1-yy-zz)*s[0],(xy+wz)*s[0],(xz-wy)*s[0],0,
      (xy-wz)*s[1],(1-xx-zz)*s[1],(yz+wx)*s[1],0,
      (xz+wy)*s[2],(yz-wx)*s[2],(1-xx-yy)*s[2],0,
      t[0],t[1],t[2],1
    ]);
  }
  function parseGLB(buffer) {
    const view=new DataView(buffer);
    if(view.byteLength<20||view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==buffer.byteLength)
      throw new Error('Expected a complete glTF 2 binary file');
    let offset=12, json, binary;
    while(offset+8<=view.byteLength){
      const length=view.getUint32(offset,true),type=view.getUint32(offset+4,true);offset+=8;
      if(offset+length>view.byteLength)throw new Error('Truncated GLB chunk');
      if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,offset,length)).replace(/\0+$/,''));
      if(type===0x004e4942)binary=buffer.slice(offset,offset+length);
      offset+=length;
    }
    if(!json||!binary)throw new Error('GLB must contain JSON and binary chunks');
    return {json,binary};
  }
  function accessor(json,binary,index) {
    const a=json.accessors[index],b=a&&json.bufferViews[a.bufferView],f=a&&formats[a.componentType],size=a&&components[a.type];
    if(!a||!b||!f||!size||a.sparse||b.buffer!==0)throw new Error('Unsupported glTF accessor '+index);
    const [method,bytes]=f,stride=b.byteStride||bytes*size,start=(b.byteOffset||0)+(a.byteOffset||0);
    if(start+(a.count?((a.count-1)*stride+bytes*size):0)>binary.byteLength)throw new Error('glTF accessor exceeds buffer');
    const result=new Float32Array(a.count*size),v=new DataView(binary);
    for(let i=0;i<a.count;i++)for(let k=0;k<size;k++){
      let value=v[method](start+i*stride+k*bytes,true);
      if(a.normalized) {
        const divisor=a.componentType===5120?127:a.componentType===5121?255:a.componentType===5122?32767:a.componentType===5123?65535:1;
        value=Math.max(-1,value/divisor);
      }
      result[i*size+k]=value;
    }
    return result;
  }
  // Spherical interpolation avoids distorted joints for rotations approaching 180 degrees.
  function interpolate(values,size,i,j,amount,rotation) {
    const out=new Float32Array(size);let dot=0,sign=1;
    if(rotation){for(let k=0;k<4;k++)dot+=values[i*4+k]*values[j*4+k];if(dot<0){dot=-dot;sign=-1;}}
    let a=1-amount,b=amount*sign;
    if(rotation&&dot<.9995){const theta=Math.acos(Math.max(-1,Math.min(1,dot))),sin=Math.sin(theta);a=Math.sin((1-amount)*theta)/sin;b=sign*Math.sin(amount*theta)/sin;}
    for(let k=0;k<size;k++)out[k]=values[i*size+k]*a+values[j*size+k]*b;
    if(rotation){const l=Math.hypot(...out)||1;for(let k=0;k<4;k++)out[k]/=l;}
    return out;
  }
  class Character {
    constructor(buffer) {
      const {json,binary}=parseGLB(buffer);this.json=json;
      const scene=json.scenes[json.scene||0],nodes=json.nodes||[];
      const meshNode=nodes.find(n=>n.mesh!==undefined&&n.skin!==undefined);
      if(!scene||!meshNode)throw new Error('No skinned character mesh in GLB');
      const primitive=json.meshes[meshNode.mesh].primitives[0],attrs=primitive.attributes,skin=json.skins[meshNode.skin];
      if(primitive.mode!==undefined&&primitive.mode!==4)throw new Error('Expected a triangle mesh');
      this.positions=accessor(json,binary,attrs.POSITION);this.normals=accessor(json,binary,attrs.NORMAL);
      this.joints=accessor(json,binary,attrs.JOINTS_0);this.weights=accessor(json,binary,attrs.WEIGHTS_0);
      this.indices=accessor(json,binary,primitive.indices);const sourceUv=accessor(json,binary,attrs.TEXCOORD_0);
      this.vertices=new Float32Array(this.indices.length*6);this.uv=new Float32Array(this.indices.length*2);
      for(let i=0;i<this.indices.length;i++){const id=this.indices[i];this.uv[i*2]=sourceUv[id*2];this.uv[i*2+1]=sourceUv[id*2+1];}
      this.inverseBind=accessor(json,binary,skin.inverseBindMatrices);this.skin=skin;this.nodes=nodes;this.roots=scene.nodes;
      this.rightHand=nodes.findIndex(n=>n.name==='mixamorig:RightHand');
      this.hips=nodes.findIndex(n=>n.name==='mixamorig:Hips');
      this.upperBody=new Set();
      const upper=nodes.findIndex(n=>n.name==='mixamorig:Spine2');
      const mark=id=>{this.upperBody.add(id);for(const child of nodes[id].children||[])mark(child);};
      if(upper>=0)mark(upper);
      if(this.rightHand<0)throw new Error('Right-hand joint is missing');
      this.texture=null;
      const material=json.materials&&json.materials[primitive.material];
      const tex=material?.pbrMetallicRoughness?.baseColorTexture;
      if(tex){const img=json.images[json.textures[tex.index].source],v=json.bufferViews[img.bufferView];
        if(!v||v.buffer!==0)throw new Error('Unsupported texture source');
        this.texture={mimeType:img.mimeType,bytes:new Uint8Array(binary,v.byteOffset||0,v.byteLength)};
      }
      this.animations={};
      for(const animation of json.animations||[]){let duration=0;const channels=[];
        for(const c of animation.channels){const s=animation.samplers[c.sampler];
          if(s.interpolation&&s.interpolation!=='LINEAR'&&s.interpolation!=='STEP')throw new Error('Unsupported interpolation: '+s.interpolation);
          const times=accessor(json,binary,s.input),values=accessor(json,binary,s.output),size=components[json.accessors[s.output].type];
          duration=Math.max(duration,times[times.length-1]||0);
          channels.push({node:c.target.node,path:c.target.path,times,values,size,step:s.interpolation==='STEP'});
        }
        this.animations[animation.name]={duration,channels};
      }
    }
    pose(name,time,options) {
      const clip=name?this.animations[name]:null;
      if(name&&!clip)throw new Error('Unknown animation: '+name);
      const transforms=this.nodes.map(n=>({translation:n.translation||[0,0,0],rotation:n.rotation||[0,0,0,1],scale:n.scale||[1,1,1]}));
      const apply=(anim,seconds,loop,allowed)=>{
        if(!anim)return;
        seconds=Math.max(0,Number.isFinite(seconds)?seconds:0);
        const t=anim.duration?(loop?seconds%anim.duration:Math.min(seconds,anim.duration)):0;
        for(const c of anim.channels){if(allowed&&!allowed.has(c.node))continue;
          const times=c.times;let lo=0,hi=times.length-1;
          while(lo+1<hi){const mid=(lo+hi)>>1;if(times[mid]<=t)lo=mid;else hi=mid;}
          if(t>=times[hi])lo=hi;
          const amount=lo===hi||c.step?0:(t-times[lo])/(times[hi]-times[lo]);
          const value=interpolate(c.values,c.size,lo,hi,amount,c.path==='rotation');
          // Remove horizontal root motion; gameplay owns the world position.
          if(options?.inPlace&&c.node===this.hips&&c.path==='translation'){
            value[0]=this.nodes[this.hips].translation[0];
            value[2]=this.nodes[this.hips].translation[2];
          }
          transforms[c.node][c.path]=value;
        }
      };
      apply(clip,time,options?.loop!==false,null);
      if(options?.upperBody){const upper=this.animations[options.upperBody.name];
        if(!upper)throw new Error('Unknown animation: '+options.upperBody.name);
        apply(upper,options.upperBody.time,options.upperBody.loop!==false,this.upperBody);
      }
      const worlds=new Array(this.nodes.length);
      const visit=(id,parent)=>{const n=this.nodes[id],tr=transforms[id],local=n.matrix?new Float32Array(n.matrix):matrix(tr.translation,tr.rotation,tr.scale);
        worlds[id]=multiply(parent,local);for(const child of n.children||[])visit(child,worlds[id]);};
      for(const root of this.roots)visit(root,identity());
      const bones=this.skin.joints.map((node,i)=>multiply(worlds[node],this.inverseBind.subarray(i*16,i*16+16)));
      const p=this.positions,n=this.normals,joints=this.joints,weights=this.weights;
      const skinned=new Float32Array(p.length*2);
      for(let i=0;i<p.length/3;i++){
        const x=p[i*3],y=p[i*3+1],z=p[i*3+2],nx=n[i*3],ny=n[i*3+1],nz=n[i*3+2];
        let px=0,py=0,pz=0,nnx=0,nny=0,nnz=0;
        for(let k=0;k<4;k++){const w=weights[i*4+k];if(!w)continue;const m=bones[joints[i*4+k]];
          px+=w*(m[0]*x+m[4]*y+m[8]*z+m[12]);py+=w*(m[1]*x+m[5]*y+m[9]*z+m[13]);pz+=w*(m[2]*x+m[6]*y+m[10]*z+m[14]);
          nnx+=w*(m[0]*nx+m[4]*ny+m[8]*nz);nny+=w*(m[1]*nx+m[5]*ny+m[9]*nz);nnz+=w*(m[2]*nx+m[6]*ny+m[10]*nz);
        }
        const len=Math.hypot(nnx,nny,nnz)||1,off=i*6;skinned[off]=px;skinned[off+1]=py;skinned[off+2]=pz;
        skinned[off+3]=nnx/len;skinned[off+4]=nny/len;skinned[off+5]=nnz/len;
      }
      for(let i=0;i<this.indices.length;i++)this.vertices.set(skinned.subarray(this.indices[i]*6,this.indices[i]*6+6),i*6);
      return {vertices:this.vertices,uv:this.uv,rightHand:worlds[this.rightHand]};
    }
  }
  global.SFMeshyCharacter={Character,parseGLB};
})(typeof window!=='undefined'?window:globalThis);
