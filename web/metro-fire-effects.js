/* Visual-only interpretation of the original CFIRE locations. */
(function (global) {
  'use strict';
  // Two crossed, irregular flame silhouettes stay visible from every angle.
  // Their multiple tips retain the original game's faceted retro appearance.
  const EDGE=[[-.28,0],[.28,0],[.43,.18],[.27,.32],[.39,.52],[.12,.44],
    [.22,.82],[-.01,.68],[-.08,1],[-.16,.60],[-.35,.71],[-.27,.38],[-.43,.24],[-.29,.09]];
  const positions=[];
  for(let plane=0;plane<2;plane++)for(let i=0;i<EDGE.length;i++){
    const a=EDGE[i],b=EDGE[(i+1)%EDGE.length];
    if(!plane)positions.push(0,.23,0,a[0],a[1],0,b[0],b[1],0);
    else positions.push(0,.23,0,0,a[1],a[0],0,b[1],b[0]);
  }
  const SHAPE=new Float32Array(positions);
  function create(gl,makeBuffer,sceneVertices){return makeBuffer(gl,sceneVertices(SHAPE));}
  function draw(renderer,mesh,fires,player,time){
    if(!renderer||!mesh||!Array.isArray(fires)||!player||![player.x,player.y,player.z].every(Number.isFinite))return;
    const M=global.SFMath,roomSet=renderer.visibleRooms;
    const nearest=[];
    for(const f of fires){
      if(!f||![f.x,f.y,f.z].every(Number.isFinite)||!Array.isArray(f.rooms))continue;
      if(roomSet&&!f.rooms.some(id=>roomSet.has(id)))continue;
      const dx=f.x-player.x,dy=f.y-player.y,dz=f.z-player.z,d=dx*dx+dy*dy+dz*dz;
      if(d>18*18)continue;
      nearest.push({f,d});
    }
    nearest.sort((a,b)=>a.d-b.d);
    const now=Number.isFinite(time)?time:0;
    for(const {f} of nearest.slice(0,16)){
      const flicker=.84+.16*Math.sin(now*8+(f.source||0)*1.7);
      const angle=now*.35+(f.source||0)*.27;
      renderer.draw(mesh,M.model(f.x,f.y,f.z,angle,.65,flicker*1.15,.65),[1,.22,.018],false);
      renderer.draw(mesh,M.model(f.x,f.y+.02,f.z,angle+.78,.32,flicker*.72,.32),[1,.72,.10],false);
    }
  }
  global.SFMetroFireEffects={create,draw};
})(window);
