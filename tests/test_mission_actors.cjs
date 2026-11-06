// Verify extracted mission roles, source coordinates and the local patrol route.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const sandbox={window:{}};
vm.runInNewContext(fs.readFileSync('web/assets/opening-actors.js','utf8'),sandbox);
const actors=JSON.parse(JSON.stringify(sandbox.window.SF_OPENING_ACTORS));
assert.deepEqual(actors.map(a=>a.source),[172,173,184]);
for(const actor of actors){
  assert.equal(actor.position.length,3);
  assert.ok(actor.position.every(Number.isInteger));
  assert.ok(actor.rooms.length && actor.route.length);
  assert.ok(actor.route.every(point=>point.length===3&&point.every(Number.isInteger)));
}
assert.equal(actors[0].model,'CHEMO.HMD');
assert.equal(actors[1].model,'CHEMO.HMD');
const hostile=actors[2];
assert.equal(hostile.model,'TERRO.HMD');
assert.deepEqual(hostile.position,[3194,2133,5964]);
assert.equal(hostile.health,100);
assert.equal(hostile.aiParameter,1);
assert.ok(hostile.rooms.includes(73));
assert.deepEqual(hostile.route,[[3206,2133,5954],[3512,2133,4553],[4095,2133,3040],[5310,2133,2872],[5466,2133,4340]]);
assert.equal(hostile.routeLoops,false);
// Native positions divide by 100 to match the WebGL world. This authored
// patrol enters the neighborhood of the player's starting point.
assert.ok(hostile.route.some(([x,,z])=>Math.hypot(x/100-47.8,z/100-28.25)<6));
console.log('French-disc mission actors and authored patrol route checks passed.');
