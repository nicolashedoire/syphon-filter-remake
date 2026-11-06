/* Small, allocation-conscious matrix helpers for the browser renderer. */
(function (global) {
  'use strict';
  function identity() { return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); }
  function multiply(a,b) {
    const out = new Float32Array(16);
    for (let col=0;col<4;col++) for(let row=0;row<4;row++)
      out[col*4+row] = a[row]*b[col*4]+a[4+row]*b[col*4+1]+a[8+row]*b[col*4+2]+a[12+row]*b[col*4+3];
    return out;
  }
  function perspective(fov,aspect,near,far) {
    const f=1/Math.tan(fov/2), nf=1/(near-far);
    return new Float32Array([f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,2*far*near*nf,0]);
  }
  function lookAt(eye,center,up) {
    let zx=eye[0]-center[0],zy=eye[1]-center[1],zz=eye[2]-center[2];
    let n=Math.hypot(zx,zy,zz)||1;zx/=n;zy/=n;zz/=n;
    let xx=up[1]*zz-up[2]*zy,xy=up[2]*zx-up[0]*zz,xz=up[0]*zy-up[1]*zx;
    n=Math.hypot(xx,xy,xz)||1;xx/=n;xy/=n;xz/=n;
    const yx=zy*xz-zz*xy, yy=zz*xx-zx*xz, yz=zx*xy-zy*xx;
    return new Float32Array([xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0,
      -(xx*eye[0]+xy*eye[1]+xz*eye[2]),-(yx*eye[0]+yy*eye[1]+yz*eye[2]),-(zx*eye[0]+zy*eye[1]+zz*eye[2]),1]);
  }
  function model(x,y,z,angle,sx,sy,sz) {
    const c=Math.cos(angle),s=Math.sin(angle);
    return new Float32Array([c*sx,0,-s*sx,0, 0,sy,0,0, s*sz,0,c*sz,0, x,y,z,1]);
  }
  global.SFMath={identity,multiply,perspective,lookAt,model};
})(window);
