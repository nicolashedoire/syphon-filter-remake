/* Versioned local save data for the Georgia Street browser prototype. */
(function (global) {
  'use strict';
  const MISSION=global.SF_METRO_ACTIVE?'destroyed-subway':'georgia-street';
  const KEY='syphon-filter:'+MISSION+':save', VERSION=1;
  const number=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
  const integer=(v,min,max)=>Number.isInteger(v)&&number(v,min,max);
  const point=p=>p&&typeof p==='object'&&number(p.x,-5000,5000)&&number(p.y,-5000,5000)&&number(p.z,-5000,5000);
  const position=p=>({x:p.x,y:p.y,z:p.z});
  // Return only validated primitive fields. Do not persist meshes, routes,
  // callbacks, transient locks, or arbitrary objects from localStorage.
  function clean(state){
    if(!state||typeof state!=='object'||!point(state.player)||!point(state.exitPoint))return null;
    const p=state.player,c=state.camera;
    if(!number(p.angle,-Math.PI*2,Math.PI*2)||!integer(p.health,1,150)||!integer(p.armor,0,600)||!integer(p.ammo,0,15)||!integer(p.reserve,0,45))return null;
    if(!c||!number(c.yaw,-Math.PI*2,Math.PI*2)||!number(c.pitch,-.7,.8))return null;
    if(!number(state.clock,0,315360000)||typeof state.combatActive!=='boolean'||!number(state.combatStartsAt,0,state.clock+4)||!number(state.reloadUntil,0,state.clock+2)||!number(state.lastShot,-10,state.clock))return null;
    if(!Array.isArray(state.enemies)||state.enemies.length<1||state.enemies.length>(MISSION==='destroyed-subway'?12:3))return null;
    const enemies=[];let authored=0;
    for(const e of state.enemies){
      if(!point(e)||!number(e.angle,-Math.PI*2,Math.PI*2)||typeof e.alive!=='boolean'||!integer(e.health,0,2)||!number(e.fire,0,30))return null;
      if((e.alive&&e.health===0)||(!e.alive&&e.health!==0))return null;
      if(MISSION==='destroyed-subway'){if(!integer(e.source,210,221)||!integer(e.routeIndex,0,16))return null;}
      else {if(e.source!==null&&e.source!==184)return null;if(!integer(e.routeIndex,0,e.source===184?5:0))return null;}
      if(e.source===184&&++authored>1)return null;
      enemies.push({...position(e),angle:e.angle,alive:e.alive,health:e.health,fire:e.fire,source:e.source,routeIndex:e.routeIndex});
    }
    if(MISSION==='destroyed-subway'&&(typeof state.hasC4!=='boolean'||typeof state.allyContact!=='boolean'||typeof state.crossedTrain!=='boolean'||!integer(state.allyHealth,1,3)))return null;
    return {...(MISSION==='destroyed-subway'?{hasC4:state.hasC4,allyContact:state.allyContact,crossedTrain:state.crossedTrain,allyHealth:state.allyHealth}:{}),player:{...position(p),angle:p.angle,health:p.health,armor:p.armor,ammo:p.ammo,reserve:p.reserve},
      camera:{yaw:c.yaw,pitch:c.pitch},enemies,exitPoint:position(state.exitPoint),clock:state.clock,
      combatActive:state.combatActive,combatStartsAt:state.combatStartsAt,reloadUntil:state.reloadUntil,lastShot:state.lastShot};
  }
  function save(snapshot){
    try{const state=clean(snapshot);if(!state)return false;global.localStorage.setItem(KEY,JSON.stringify({version:VERSION,mission:MISSION,state}));return true;}catch(error){return false;}
  }
  function load(){
    try{const raw=global.localStorage.getItem(KEY);if(typeof raw!=='string'||raw.length>100000)return null;
      const data=JSON.parse(raw);if(!data||data.version!==VERSION||data.mission!==MISSION)return null;
      return clean(data.state);
    }catch(error){return null;}
  }
  function clear(){try{global.localStorage.removeItem(KEY);return true;}catch(error){return false;}}
  global.SFSave=Object.freeze({save,load,clear});
})(window);
