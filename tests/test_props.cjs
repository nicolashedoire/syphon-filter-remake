// Verify the locally generated static prop geometry and room metadata.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const c={window:{},Float32Array,Uint8Array,Uint16Array};vm.createContext(c);
vm.runInContext(fs.readFileSync('web/assets/props.js','utf8'),c);
const p=c.window.SF_PROPS,n=p.positions.length/3;
assert.equal(p.uvs.length,n*2);assert.equal(p.pages.length,n);assert.equal(p.cluts.length,n);
assert.equal(n%3,0);assert.ok(p.positions.every(Number.isFinite));
assert.ok(p.objects.every(o=>o.start>=0 && o.count>0 && o.count%3===0 && o.start+o.count<=n && o.rooms.every(r=>r>=0&&r<91)));
const car=p.objects.find(o=>o.name==='CP');assert.ok(car);assert.ok(car.rooms.includes(74));
let xs=[];for(let i=car.start;i<car.start+car.count;i++)xs.push(p.positions[i*3]);
assert.ok(Math.min(...xs)>30&&Math.max(...xs)<40,'The police car occupies its original street location');
console.log(`Prop tests passed: ${p.objects.length} original objects and ${n/3} triangles.`);
