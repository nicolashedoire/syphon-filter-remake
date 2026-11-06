// Audio must stay optional when browser APIs or autoplay are unavailable.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('web/audio.js','utf8');
let plays=0,pauses=0,resumes=0,starts=0,stops=0,instance,timer=null,delay,offsets=[],volumes=[];
const node=()=>({connect(){},gain:{setValueAtTime(value){volumes.push(value)},exponentialRampToValueAtTime(){}},frequency:{value:0},playbackRate:{value:0},start(time,offset){starts++;offsets.push(offset)},stop(){stops++}});
class Context{constructor(){this.state='suspended';this.sampleRate=44100;this.currentTime=0;this.destination={}}resume(){resumes++;this.state='running';return Promise.resolve()}createBuffer(){return {getChannelData(){return new Float32Array(13230)}}}createBufferSource(){return node()}createBiquadFilter(){return node()}createGain(){return node()}}
class Audio{constructor(src){assert.equal(src,'web/assets/title-audio.mp3');this.src=src;this.events={};instance=this}play(){plays++;return Promise.resolve()}pause(){pauses++}addEventListener(name,fn){this.events[name]=fn}}
let randomStep=0;const randomMath=Object.create(Math);randomMath.random=()=>((randomStep++%17)+1)/18;
const events={};const env={AudioContext:Context,Audio,Math:randomMath,Float32Array,setTimeout(fn,ms){timer=fn;delay=ms;return 1},clearTimeout(){timer=null},addEventListener(name,fn){events[name]=fn}};env.window=env;vm.runInNewContext(source,env);
env.SFAudio.startMusic();assert.equal(plays,1);env.SFAudio.unlock();assert.equal(resumes,1);
assert.equal(instance.loop,false,'The title music must not loop continuously');assert.ok(instance.volume<=.05,'Music starts at a quiet level');
for(const name of ['shot','enemy','impact','reload','hurt'])env.SFAudio.sound(name);
assert.equal(starts,5);assert.equal(stops,5);assert.ok(volumes.every(v=>v<=.035),'Effects start at a quiet level');
env.SFAudio.sound('shot');env.SFAudio.sound('shot');assert.notEqual(offsets.at(-1),offsets.at(-2),'Shots use varied offsets into the noise sample');
instance.events.ended();assert.equal(delay,90000,'Music rests for 90 seconds after playing');const beforeGap=plays;env.SFAudio.unlock();assert.equal(plays,beforeGap,'Unlocking does not skip the silent gap');
env.SFAudio.pauseMusic();assert.equal(timer,null,'Pausing cancels the pending music timer');assert.equal(pauses,1);
env.SFAudio.startMusic();env.SFAudio.setMuted(true);const before=starts;env.SFAudio.sound('shot');assert.equal(starts,before);env.SFAudio.setMuted(false);assert.ok(plays>=3);
instance.events.ended();assert.ok(timer);events.pagehide();assert.equal(timer,null,'Leaving the page cancels the pending music timer');
const unsupported={};unsupported.window=unsupported;vm.runInNewContext(source,unsupported);
assert.doesNotThrow(()=>{unsupported.SFAudio.unlock();unsupported.SFAudio.startMusic();unsupported.SFAudio.sound('shot');unsupported.SFAudio.pauseMusic()});
console.log('Audio tests passed: original title music, effects, mute and unsupported browser.');
