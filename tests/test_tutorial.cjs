// Verify that the PC controls guide pauses the game and precedes first deployment.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements={};let launches=0;
function element(id){return elements[id]??={listeners:{},classList:{contains(name){return id==='overlay'&&name==='briefing'}},addEventListener(n,f){this.listeners[n]=f},click(){const e={stopped:false,stopImmediatePropagation(){this.stopped=true}};this.listeners.click?.(e);if(id==='start'&&!e.stopped)launches++;},showModal(){this.open=true},close(){this.open=false;this.listeners.close?.()},setAttribute(){this.open=true},removeAttribute(){this.open=false}};}
const document={getElementById:element,documentElement:{dataset:{}},listeners:{},addEventListener(n,f){this.listeners[n]=f;},pointerLockElement:null,exitPointerLock(){this.pointerLockElement=null}};
const context={document};vm.createContext(context);vm.runInContext(fs.readFileSync('web/tutorial.js','utf8'),context);
element('start').click();assert.equal(element('controls-dialog').open,true);assert.equal(launches,0);assert.equal(document.documentElement.dataset.tutorialOpen,'true');
element('help-close').click();assert.equal(element('controls-dialog').open,false);assert.equal(launches,1);assert.equal(document.documentElement.dataset.tutorialOpen,'false');
document.listeners.keydown({key:'h',preventDefault(){}});assert.equal(element('controls-dialog').open,true);assert.equal(document.documentElement.dataset.tutorialOpen,'true');element('help-close').click();assert.equal(launches,1);assert.equal(document.documentElement.dataset.tutorialOpen,'false');
console.log('PC tutorial tests passed: first launch, pause, resume and later access.');
