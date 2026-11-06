// Compare the JavaScript Georgia Street state machine with the community US-port scenarios.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={window:{},Map,Math,Object,Number,Array,TypeError,Error};vm.runInNewContext(fs.readFileSync('web/mission.js','utf8'),context);
const Mission=context.window.SFGeorgiaMission, simplify=commands=>JSON.parse(JSON.stringify(commands));
const has=(commands,type,object=0)=>commands.some(c=>c.type===type&&c.object===object);
let m=new Mission();
assert.equal(m.state.initialObjectivesComplete,false);assert.equal(m.state.failed,false);
m.actorKilled(174);assert.equal(m.state.kravitchEliminated,true);assert.deepEqual(simplify(m.update()),[]);
m.objectDestroyed(260);let commands=m.update();assert.ok(has(commands,'capture_checkpoint'));assert.equal(m.state.initialObjectivesComplete,false);
m.objectDestroyed(140);commands=m.update();assert.ok(has(commands,'destroy_object_source',67));assert.equal(m.update().length,0,'Commands are consumed once');
m.actorKilled(172);assert.equal(m.state.failed,true);assert.ok(has(m.update(),'mission_failed'));
m.reset();assert.equal(m.state.failed,false);assert.equal(m.state.kravitchEliminated,false);
m.objectDamaged(28,false);assert.equal(m.state.bombWarningIssued,true);assert.equal(m.state.failed,false);
m.objectDamaged(28,true);assert.equal(m.state.failed,true);assert.ok(has(m.update(),'mission_failed'));
m.reset();m.objectDamaged(30,false);assert.equal(m.state.failed,true,'Any hit to final bomb fails the mission');
m.reset();m.objectDamaged(29,false);assert.equal(m.state.failed,false);m.objectDestroyed(29);assert.equal(m.state.failed,true);

// Recycled bank attackers use the authored slot and the native 30-tick delay.
m=new Mission();m.configureActor(0,175,true,1);
const dead=[{slot:0,hostile:true,alive:false,roomActive:true,visibleFromPlayer:true,playerDistance:500}];
for(let killed=0;killed<5;killed++){
  m.actorKilled(175,0);
  if(killed<4){for(let tick=0;tick<29;tick++)assert.equal(m.update({actors:dead}).length,0);commands=m.update({actors:dead});assert.ok(has(commands,'respawn_actor',0));}
}
assert.equal(m.state.bankAttackersEliminated,5);assert.equal(m.state.cbdcProtected,true);
m.actorKilled(174);m.objectDestroyed(260);commands=m.update();assert.equal(m.state.initialObjectivesComplete,true);
assert.ok(has(commands,'destroy_object_source',238));assert.ok(has(commands,'destroy_object_source',239));assert.ok(has(commands,'capture_checkpoint'));
assert.equal(m.update().length,0,'Door and checkpoint commands do not repeat');

// Native coordinates and interactions mirror the linked switches and ending.
commands=m.update({x:1338,y:-134,z:-1403,interact:true});assert.equal(m.state.upperBombTagged,true);assert.ok(has(commands,'capture_checkpoint'));
commands=m.update({x:-309,y:1118,z:426});assert.equal(m.state.finaleStarted,true);assert.ok(has(commands,'start_finale',30));
commands=m.update({x:-562,y:-259,z:4304,interact:true});assert.equal(m.state.securityBypassed,true);assert.ok(has(commands,'destroy_object_source',317));assert.ok(has(commands,'destroy_object_source',68));assert.ok(has(commands,'capture_checkpoint'));
assert.equal(m.update({x:-562,y:-259,z:4304,interact:true}).filter(c=>c.object===68).length,0);
m.update({x:-75,z:-1544});assert.equal(m.state.scriptedEventsMask&2,2,'Second radio event unlocks after tagging');
m.update({x:-75,z:-8791});assert.equal(m.state.scriptedEventsMask&4,4,'Third radio event unlocks after tagging');
commands=m.update({x:128,y:-2285,z:5131,interact:true});assert.ok(has(commands,'teleport_to_source',316));
commands=m.update({x:429,y:-245,z:4770,interact:true});assert.ok(has(commands,'teleport_to_source',315));
m=new Mission();m.update({x:12616,z:10750});assert.equal(m.state.bankAssaultStarted,true);
m=new Mission();m.update({x:1513,z:4660});assert.equal(m.state.scriptedEventsMask,1);m.update({x:-75,z:-1544});assert.equal(m.state.scriptedEventsMask,1,'Later radio triggers require a tagged bomb');
// Street reinforcements wait until they are distant and not visible.
m=new Mission();m.configureActor(6,184,true,1);m.actorKilled(184,6);
const visible=[{slot:6,hostile:true,alive:false,roomActive:true,visibleFromPlayer:true,playerDistance:2000}];
for(let tick=0;tick<30;tick++)assert.equal(m.update({actors:visible}).length,0);
const nearby=[{...visible[0],visibleFromPlayer:false,playerDistance:1199}];assert.equal(m.update({actors:nearby}).length,0);
const hidden=[{...nearby[0],playerDistance:1200}];assert.ok(has(m.update({actors:hidden}),'respawn_actor',6));
assert.ok(Object.isFrozen(m.state),'Mission state is exposed as a snapshot');
assert.throws(()=>m.objectDestroyed(-1),/unsigned 16-bit/);assert.throws(()=>m.update({x:NaN}),/finite/);
console.log('Georgia Street mission state tests passed: objectives, checkpoints, events, hazards and switches.');
