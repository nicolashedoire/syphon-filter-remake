// Check the original videos and French briefing are presented before gameplay.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
function setup(){
  const elements={},events={};let nextFrame;
  function el(id){return elements[id]??={textContent:'',innerHTML:'',hidden:false,style:{},disabled:false,events:{},classList:{add(){},remove(){}},querySelector(){return {textContent:''}},addEventListener(n,f){this.events[n]=f;},focus(){},play(){this.played=(this.played||0)+1;return Promise.resolve();},pause(){},removeAttribute(name){if(name==='src')this.src='';},load(){}};}
  const document={getElementById:el,addEventListener(n,f){(events[n]??=[]).push(f)},pointerLockElement:null,exitPointerLock(){}};
  const c={console,Float32Array,Map,Set,Math,Number,Array,document,requestAnimationFrame(f){nextFrame=f;},addEventListener(){},SFRenderer:class{render(){return {eye:[0,0,1],target:[0,0,0]};}}};c.window=c;vm.createContext(c);
  for(const file of ['web/assets/intro-briefing.js','web/assets/georgia-street.js','web/game.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c,{filename:file});
  assert.ok(nextFrame);return {el,c};
}
const first=setup();first.el('start').events.click();
assert.equal(first.el('cinematics').hidden,false);assert.match(first.el('intro-video').src,/intro-general\.mp4$/);
first.el('intro-video').events.ended();assert.match(first.el('intro-video').src,/intro-georgia\.mp4$/);
first.el('intro-video').events.ended();assert.equal(first.el('cinematics').hidden,true);assert.equal(first.el('overlay').hidden,false);
assert.ok(first.el('overlay-text').textContent.includes(first.c.SF_BRIEFING.directives[0]),'The original French briefing is displayed');
assert.ok(first.el('overlay-text').textContent.includes(first.c.SF_BRIEFING.objectives[0]),'The original objectives are displayed');
first.el('start').events.click();assert.equal(first.el('overlay').hidden,true,'The player can start the mission after the briefing');
const second=setup();second.el('start').events.click();second.el('skip-intro').events.click();assert.equal(second.el('cinematics').hidden,true);assert.ok(second.el('overlay-text').textContent.includes(second.c.SF_BRIEFING.directives[0]));
console.log('Intro tests passed: both original videos, French briefing, skip and mission start.');
