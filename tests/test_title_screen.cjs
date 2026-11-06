// The original title movie should run only while the title screen is visible.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let sync, visibility, plays=0, pauses=0;
const overlay={hidden:false,classList:{contains(){return this.briefing||false;}}};
const video={play(){plays++;return Promise.resolve();},pause(){pauses++;}};
const document={hidden:false,getElementById(id){return id==='overlay'?overlay:video;},addEventListener(name,fn){if(name==='visibilitychange')visibility=fn;}};
class MutationObserver{constructor(fn){sync=fn;}observe(){}}
vm.runInNewContext(fs.readFileSync('web/title-screen.js','utf8'),{document,MutationObserver});
assert.equal(plays,1);
overlay.classList.briefing=true;sync();assert.equal(pauses,1);
overlay.classList.briefing=false;overlay.hidden=true;sync();assert.equal(pauses,2);
overlay.hidden=false;document.hidden=true;visibility();assert.equal(pauses,3);
document.hidden=false;visibility();assert.equal(plays,2);
console.log('Original title video pauses outside the visible title screen.');
