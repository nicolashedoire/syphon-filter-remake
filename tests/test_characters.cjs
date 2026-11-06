// Validate the exported PS1 character meshes used by the offline HTML game.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = {window:{}, Float32Array, Uint8Array, Uint16Array};
vm.runInNewContext(fs.readFileSync('web/assets/characters.js', 'utf8'), context);
for (const [name, minimum] of [['gabe', 500], ['terro', 250]]) {
  const model = context.window.SF_CHARACTERS[name];
  const vertices = model.positions.length / 3;
  assert.equal(vertices % 3, 0, `${name}: complete triangles`);
  assert.ok(vertices / 3 >= minimum, `${name}: expected PS1 mesh`);
  assert.equal(model.parts.length, vertices);
  assert.equal(model.uvs.length, vertices * 2);
  assert.equal(model.cluts.length, vertices);
  assert.equal(model.tpages.length, vertices);
  assert.ok([...model.positions].every(Number.isFinite));
  const heights = [...model.positions].filter((_, i) => i % 3 === 1);
  assert.ok(Math.abs(Math.min(...heights)) < 1e-4, `${name}: feet rest on ground`);
  assert.ok(Math.max(...heights) > 1.7 && Math.max(...heights) < 2.3, `${name}: human scale`);
}
console.log('PS1 character geometry checks passed.');
