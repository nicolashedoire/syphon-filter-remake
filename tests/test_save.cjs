// Local saves must round-trip gameplay state without trusting stored JSON.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const values=new Map();
const storage={getItem(k){return values.has(k)?values.get(k):null},setItem(k,v){values.set(k,v)},removeItem(k){values.delete(k)}};
const context={window:{localStorage:storage}};
vm.runInNewContext(fs.readFileSync('web/save.js','utf8'),context,{filename:'web/save.js'});
const save=context.window.SFSave;
const snapshot={player:{x:45.5,y:21.33,z:28.3,angle:-1.2,health:140,armor:584,ammo:8,reserve:39,unused:'ignored'},
  camera:{yaw:-1.2,pitch:.1},enemies:[{x:39,y:21.3,z:26,angle:1,alive:false,health:0,fire:2.5,source:null,routeIndex:0},
    {x:35,y:21.33,z:45,angle:-1.5,alive:true,health:1,fire:1.2,source:184,routeIndex:2,route:[[99,99,99]]}],
  exitPoint:{x:42,y:21.33,z:28},clock:42,combatActive:true,combatStartsAt:10,reloadUntil:42.5,lastShot:41.8,untrusted:'ignored'};
assert.equal(save.load(),null,'A missing save is not a valid resume');
assert.equal(save.save(snapshot),true,'Valid gameplay state is stored');
const key=[...values.keys()][0],encoded=values.get(key),roundtrip=save.load();
assert.equal(roundtrip.player.health,140);assert.equal(roundtrip.enemies[0].alive,false);
assert.equal(roundtrip.enemies[1].source,184);assert.equal(roundtrip.enemies[1].routeIndex,2);
assert.equal(roundtrip.camera.yaw,-1.2);assert.equal(roundtrip.combatStartsAt,10);
assert.equal(roundtrip.player.unused,undefined);assert.equal(roundtrip.enemies[1].route,undefined);
roundtrip.player.health=1;snapshot.enemies[1].x=100;
assert.equal(save.load().player.health,140,'Returned state is independent of storage and caller objects');
assert.equal(save.load().enemies[1].x,35);
assert.equal(save.save({...snapshot,player:{...snapshot.player,health:0}}),false,'Do not overwrite a save with a dead player');
assert.equal(values.get(key),encoded,'Invalid state never replaces the last good save');
for(const bad of ['{','null','x'.repeat(100001),JSON.stringify({version:2,mission:'georgia-street',state:snapshot}),
  JSON.stringify({version:1,mission:'other',state:snapshot}),JSON.stringify({version:1,mission:'georgia-street',state:{...snapshot,enemies:[]}}),
  JSON.stringify({version:1,mission:'georgia-street',state:{...snapshot,player:{...snapshot.player,x:null}}}),
  JSON.stringify({version:1,mission:'georgia-street',state:{...snapshot,enemies:[{...snapshot.enemies[1],source:173}]}}),
  JSON.stringify({version:1,mission:'georgia-street',state:{...snapshot,enemies:[{...snapshot.enemies[1],routeIndex:999}]}})]){
  values.set(key,bad);assert.equal(save.load(),null,'Invalid or incompatible stored data is rejected');
}
values.set(key,encoded);assert.equal(save.clear(),true);assert.equal(save.load(),null);
const blocked={window:{get localStorage(){throw new Error('blocked')}}};
vm.runInNewContext(fs.readFileSync('web/save.js','utf8'),blocked);
assert.equal(blocked.window.SFSave.load(),null);assert.equal(blocked.window.SFSave.save(snapshot),false);assert.equal(blocked.window.SFSave.clear(),false);
console.log('Save tests passed: round trip, validation, incompatible data and unavailable storage.');
