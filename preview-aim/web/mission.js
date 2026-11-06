/*
 * Georgia Street mission-state subset adapted from the community SF-pc-port:
 * references/sf-pc-port/src/game/mission_scripts.cpp (MIT).
 * This port models the community US runtime; equivalence with the French PS1
 * executable has not been fully verified. It does not create actors or make
 * the mission playable by itself: callers must supply real scene events.
 *
 * API: new SFGeorgiaMission(); actorKilled(sourceId, optionalSlotId);
 * objectDamaged(sourceId, destroyed); objectDestroyed(sourceId);
 * update({x,y,z,interact,actors}) returns commands; state exposes a snapshot.
 * Coordinates are native PS1 units in the community port's coordinate system,
 * not the web renderer's scaled/inverted coordinates. Each update is one tick.
 * Optional actors are {slot,hostile,alive,roomActive,visibleFromPlayer,
 * playerDistance}; slots may be registered with configureActor(slot,source,
 * hostile,aiParameter). Command `object` is a slot for respawns, otherwise an
 * authored source index. No copyrighted game assets are included in this file.
 */
(function (global) {
  'use strict';
  const REINFORCEMENT_DELAY=30, REINFORCEMENT_SPACING=7, HOSTILE_CAP=6;
  const horiz=(x,z,tx,tz)=>Math.hypot(x-tx,z-tz);
  const spatial=(x,y,z,tx,ty,tz)=>Math.hypot(x-tx,y-ty,z-tz);
  const validId=(id)=>Number.isInteger(id)&&id>=0&&id<=65535;
  const freshState=()=>({bankAssaultStarted:false,cbdcProtected:false,securityBypassed:false,
    kravitchEliminated:false,communicationsDestroyed:false,upperBombTagged:false,
    initialObjectivesComplete:false,finaleStarted:false,failed:false,bombWarningIssued:false,
    bankAttackersEliminated:0,scriptedEventsMask:0});
  class SFGeorgiaMission {
    constructor(){this.slots=new Map();this.reset();}
    get state(){return Object.freeze({...this._state});}
    configureActor(slot,source,hostile,aiParameter){
      if(!validId(slot)||!validId(source))throw new TypeError('Actor slot and source must be unsigned 16-bit integers');
      this.slots.set(slot,{source,recyclable:!!hostile&&aiParameter===1,pending:false,cooldown:0});
    }
    reset(){
      this._state=freshState();this.globalSpawnCooldown=0;
      this.gatePending=false;this.doorsPending=false;this.checkpointPending=false;this.failedPending=false;
      for(const slot of this.slots.values()){slot.pending=false;slot.cooldown=0;}
    }
    _completeInitial(){const s=this._state;if(s.cbdcProtected&&s.kravitchEliminated&&s.communicationsDestroyed&&!s.initialObjectivesComplete){s.initialObjectivesComplete=true;this.doorsPending=true;this.checkpointPending=true;}}
    actorKilled(sourceId,slotId=sourceId){
      if(!validId(sourceId)||!validId(slotId))throw new TypeError('Actor source and slot must be unsigned 16-bit integers');
      let slot=this.slots.get(slotId);
      if(slot&&slot.source!==sourceId)throw new Error('Actor slot does not match its registered source');
      if(!slot){slot={source:sourceId,recyclable:sourceId===175,pending:false,cooldown:0};this.slots.set(slotId,slot);}
      const s=this._state;
      if(sourceId===175){
        s.bankAssaultStarted=true;s.bankAttackersEliminated=Math.min(5,s.bankAttackersEliminated+1);
        if(s.bankAttackersEliminated<5){slot.pending=true;slot.cooldown=REINFORCEMENT_DELAY;}
        else{slot.pending=false;slot.cooldown=0;s.cbdcProtected=true;this.checkpointPending=true;this._completeInitial();}
      }else if(slot.recyclable){slot.pending=true;slot.cooldown=REINFORCEMENT_DELAY;}
      if(sourceId===174){s.kravitchEliminated=true;if(s.communicationsDestroyed)this.checkpointPending=true;this._completeInitial();}
      else if(sourceId===172||sourceId===173){s.failed=true;this.failedPending=true;}
    }
    objectDamaged(sourceId,destroyed=false){
      if(!validId(sourceId))throw new TypeError('Object source must be an unsigned 16-bit integer');
      if(sourceId===30||(destroyed&&(sourceId===28||sourceId===29))){this._state.failed=true;this.failedPending=true;return;}
      if(sourceId===28||sourceId===29)this._state.bombWarningIssued=true;
    }
    objectDestroyed(sourceId){
      if(!validId(sourceId))throw new TypeError('Object source must be an unsigned 16-bit integer');
      if(sourceId===140)this.gatePending=true;
      if(sourceId===260){this._state.communicationsDestroyed=true;if(this._state.kravitchEliminated)this.checkpointPending=true;this._completeInitial();}
      this.objectDamaged(sourceId,true);
    }
    update(context={}){
      const {x=0,y=0,z=0,interact=false,actors=[]}=context;
      if(![x,y,z].every(Number.isFinite)||!Array.isArray(actors))throw new TypeError('Expected finite native PS1 coordinates and an actor array');
      if(this.globalSpawnCooldown>0)this.globalSpawnCooldown--;
      for(const slot of this.slots.values())if(slot.pending&&slot.cooldown>0)slot.cooldown--;
      const s=this._state,commands=[];
      if(!s.bankAssaultStarted&&horiz(x,z,12616,10750)<=2800)s.bankAssaultStarted=true;
      const emit=(type,object=0)=>commands.push({type,object});
      if(this.gatePending){emit('destroy_object_source',67);this.gatePending=false;}
      if(this.doorsPending){emit('destroy_object_source',238);emit('destroy_object_source',239);this.doorsPending=false;}
      if(interact&&!s.securityBypassed&&spatial(x,y,z,-562,-259,4304)<=520){s.securityBypassed=true;emit('destroy_object_source',317);emit('destroy_object_source',68);this.checkpointPending=true;}
      if(interact){
        const switches=[[128,-2285,5131,316],[429,-245,4770,315],[-2236,989,-9937,319],[-1927,-252,-9550,318]];
        for(const [sx,sy,sz,id] of switches)if(spatial(x,y,z,sx,sy,sz)<=520){emit('teleport_to_source',id);break;}
      }
      if(interact&&!s.upperBombTagged&&s.initialObjectivesComplete&&horiz(x,z,1338,-1403)<=650){s.upperBombTagged=true;this.checkpointPending=true;}
      if(!s.finaleStarted&&s.upperBombTagged&&horiz(x,z,-309,426)<=900){s.finaleStarted=true;emit('start_finale',30);}
      const radio=[[1513,4660],[-75,-1544],[-75,-8791]];
      for(let i=0;i<radio.length;i++){
        const mask=1<<i;if((s.scriptedEventsMask&mask)||(i!==0&&!s.upperBombTagged)||horiz(x,z,...radio[i])>760)continue;
        s.scriptedEventsMask|=mask;break;
      }
      if(this.checkpointPending){emit('capture_checkpoint');this.checkpointPending=false;}
      if(this.failedPending){emit('mission_failed');this.failedPending=false;}
      if(this.globalSpawnCooldown!==0)return commands;
      const live=actors.filter(a=>a.hostile&&a.alive&&a.roomActive).length;
      const candidate=actors.find(a=>{
        const slot=this.slots.get(a.slot);
        if(!slot||!slot.recyclable||!slot.pending||slot.cooldown!==0||a.alive||!a.roomActive||(live>=HOSTILE_CAP&&slot.source!==175))return false;
        if(slot.source===175)return a.playerDistance>=480;
        return !a.visibleFromPlayer&&a.playerDistance>=1200;
      });
      if(candidate){this.slots.get(candidate.slot).pending=false;this.globalSpawnCooldown=REINFORCEMENT_SPACING;emit('respawn_actor',candidate.slot);}
      return commands;
    }
  }
  global.SFGeorgiaMission=SFGeorgiaMission;
})(window);
