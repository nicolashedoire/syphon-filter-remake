/* Decode the simple, uncompressed, single-mesh GLB used by static props. */
(function(global){
  'use strict';
  function decode(buffer){
    if(!global.SFMeshyCharacter)throw new Error('GLB decoder unavailable');
    const {json,binary}=global.SFMeshyCharacter.parseGLB(buffer);
    if((json.meshes||[]).length!==1||json.meshes[0].primitives.length!==1)throw new Error('Expected one static mesh');
    const node=(json.nodes||[]).find(n=>n.mesh===0),p=json.meshes[0].primitives[0];
    if(!node||node.matrix||node.translation||node.rotation||node.scale||node.skin!==undefined||p.mode!==4)throw new Error('Unsupported static mesh transform');
    function read(index,type,component){
      const a=json.accessors[index],v=a&&json.bufferViews[a.bufferView];
      if(!a||!v||v.buffer!==0||a.type!==type||a.componentType!==component||a.sparse)throw new Error('Unsupported static mesh accessor');
      const count={SCALAR:1,VEC2:2,VEC3:3}[type],width=4,stride=v.byteStride||count*width,start=(v.byteOffset||0)+(a.byteOffset||0),end=start+(a.count?((a.count-1)*stride+count*width):0);
      if(end>binary.byteLength)throw new Error('Static mesh accessor exceeds buffer');
      const dv=new DataView(binary),out=new Float32Array(a.count*count);
      for(let i=0;i<a.count;i++)for(let k=0;k<count;k++)out[i*count+k]=component===5125?dv.getUint32(start+i*stride+k*width,true):dv.getFloat32(start+i*stride+k*width,true);
      return out;
    }
    const positions=read(p.attributes.POSITION,'VEC3',5126),normals=read(p.attributes.NORMAL,'VEC3',5126),texcoords=read(p.attributes.TEXCOORD_0,'VEC2',5126),indices=read(p.indices,'SCALAR',5125);
    if(normals.length!==positions.length||texcoords.length*3!==positions.length*2||indices.length%3)throw new Error('Invalid static mesh geometry');
    const vertices=new Float32Array(indices.length*6),uv=new Float32Array(indices.length*2),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let i=0;i<indices.length;i++){
      const n=indices[i];if(!Number.isInteger(n)||n<0||n*3+2>=positions.length)throw new Error('Static mesh index out of bounds');
      for(let k=0;k<3;k++){const val=positions[n*3+k],normal=normals[n*3+k];if(!Number.isFinite(val)||!Number.isFinite(normal))throw new Error('Invalid static mesh vertex');vertices[i*6+k]=val;vertices[i*6+3+k]=normal;min[k]=Math.min(min[k],val);max[k]=Math.max(max[k],val);}
      uv[i*2]=texcoords[n*2];uv[i*2+1]=texcoords[n*2+1];
    }
    const material=json.materials?.[p.material],texture=material?.pbrMetallicRoughness?.baseColorTexture,img=json.images?.[json.textures?.[texture?.index]?.source],view=json.bufferViews?.[img?.bufferView];
    if(!img||!view||view.buffer!==0||!img.mimeType)throw new Error('Embedded color texture missing');
    return {vertices,uv,min,max,texture:{mimeType:img.mimeType,bytes:new Uint8Array(binary,view.byteOffset||0,view.byteLength)}};
  }
  function policePlacement(data,props){
    const car=props?.objects?.find(o=>o.name==='CP'&&o.id===57);if(!car)throw new Error('Original police car missing');
    let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity,y0=Infinity;
    for(let i=car.start*3;i<(car.start+car.count)*3;i+=3){const a=props.positions;x0=Math.min(x0,a[i]);x1=Math.max(x1,a[i]);y0=Math.min(y0,a[i+1]);z0=Math.min(z0,a[i+2]);z1=Math.max(z1,a[i+2]);}
    const length=data.max[0]-data.min[0];if(!Number.isFinite(length)||length<=0)throw new Error('Invalid car dimensions');
    const scale=6.3/length;
    return {x:(x0+x1)/2,y:y0-data.min[1]*scale,z:(z0+z1)/2,angle:-.473,scale};
  }
  global.SFMeshyStatic={decode,policePlacement};
})(typeof window!=='undefined'?window:globalThis);
