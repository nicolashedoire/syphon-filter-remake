// Check the French-disc patrol against the prototype's actual collision grid.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements={};
function element(id){return elements[id]??={textContent:'',innerHTML:'',style:{},hidden:false,disabled:false,events:{},
  classList:{add(){},remove(){}},querySelector(){return {textContent:''};},addEventListener(name,fn){this.events[name]=fn;},focus(){}};}
const document={getElementById:element,addEventListener(){},pointerLockElement:null,exitPointerLock(){}};
const context={console,Float32Array,Uint8Array,Uint16Array,Map,Set,Math,Number,Array,document,requestAnimationFrame(){},addEventListener(){},
  SFRenderer:class{render(){return {eye:[0,0,0]};}}};
context.window=context;vm.createContext(context);
for(const file of ['web/assets/georgia-street.js','web/assets/props.js','web/assets/opening-actors.js','web/ps1-rules.js','web/mission.js'])
  vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file});
const initialization='[groundGrid,wallGrid]=prepareCollision(collisionPositions);';
const game=fs.readFileSync('web/game.js','utf8');
assert.ok(game.includes(initialization),'The actual game prepares its collision grid');
vm.runInContext(game.replace(initialization,initialization+'window.testCollision={moveAxis};'),context,{filename:'web/game.js'});
const actor=context.SF_OPENING_ACTORS.find(item=>item.source===184);
const position={x:actor.position[0]/100,y:actor.position[1]/100,z:actor.position[2]/100};
for(const point of actor.route){
  const destination={x:point[0]/100,z:point[2]/100};
  const steps=Math.ceil(Math.hypot(destination.x-position.x,destination.z-position.z)/.1);
  for(let i=0;i<steps;i++){
    const dx=(destination.x-position.x)/(steps-i),dz=(destination.z-position.z)/(steps-i);
    assert.ok(context.testCollision.moveAxis(position,dx,dz),'The authored path is traversable under current prototype collision rules');
  }
}
assert.ok(Math.hypot(position.x-54.66,position.z-43.4)<.01);
console.log('French-disc patrol traverses the prototype collision grid.');
