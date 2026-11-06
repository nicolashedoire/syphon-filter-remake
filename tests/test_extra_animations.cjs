// Ensure extracted French-disc poses preserve each model's triangle ordering.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context={window:{},Float32Array,Uint8Array,Uint16Array};
for(const file of ['web/assets/characters.js','web/assets/animations-extra.js'])
  vm.runInNewContext(fs.readFileSync(file,'utf8'),context,{filename:file});
const {SF_EXTRA_ANIMATIONS:clips,SF_CHARACTERS:characters}=context.window;
for(const [character,name,expected] of [['gabe','aim',1],['gabe','reload',7],['terro','idle',20],['terro','walk',25],['terro','run',14]]){
  const clip=clips[character][name];
  assert.equal(clip.frames.length,expected,`${character}.${name} frame count`);
  for(const frame of clip.frames){
    assert.equal(frame.length,characters[character].positions.length,`${character}.${name} vertex ordering`);
    let minY=Infinity,maxY=-Infinity,maxXZ=0;
    for(let i=0;i<frame.length;i+=3){
      assert.ok(Number.isFinite(frame[i])&&Number.isFinite(frame[i+1])&&Number.isFinite(frame[i+2]));
      minY=Math.min(minY,frame[i+1]);maxY=Math.max(maxY,frame[i+1]);maxXZ=Math.max(maxXZ,Math.abs(frame[i]),Math.abs(frame[i+2]));
    }
    assert.ok(Math.abs(minY)<.001&&maxY>1.2&&maxY<2.5&&maxXZ<2,`${character}.${name} remains locally grounded`);
  }
  if(clip.frames.length>1)assert.ok(clip.frames[0].some((value,index)=>value!==clip.frames.at(-1)[index]),`${character}.${name} changes pose`);
}
console.log('French PS1 sidearm and terrorist animation poses are valid.');
