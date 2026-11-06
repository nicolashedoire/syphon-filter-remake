// Verify the small rules port against the US reference implementation.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const c={window:{},Math,Object};vm.runInNewContext(fs.readFileSync('web/ps1-rules.js','utf8'),c);
const r=c.window.SFPS1Rules,p={health:r.initialHealth,armor:r.initialArmor,ammo:r.magazineCapacity,reserve:r.initialReserve};
assert.deepEqual([p.health,p.armor,p.ammo,p.reserve],[150,600,15,45]);
r.applyPlayerDamage(p,650);assert.deepEqual([p.health,p.armor],[150,0],'The hit that empties armor does not spill into health');
r.applyPlayerDamage(p,20);assert.deepEqual([p.health,p.armor],[130,0]);
r.applyPlayerDamage(p,999);assert.equal(p.health,0,'Health cannot become negative');
p.ammo=7;p.reserve=5;assert.equal(r.reload(p),5);assert.deepEqual([p.ammo,p.reserve],[12,0],'Reloads cannot exceed the remaining reserve');
p.ammo=7;p.reserve=45;assert.equal(r.reload(p),8);assert.deepEqual([p.ammo,p.reserve],[15,37]);
assert.equal(r.walkSpeed,1.908);assert.equal(r.runSpeed,6.5786);
console.log('PS1 rules tests passed: armor, health, magazine, reserve and movement rates.');
