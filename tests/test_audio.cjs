// Audio must stay optional when browser APIs or autoplay are unavailable.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('web/audio.js','utf8');
let plays=0,pauses=0,resumes=0,starts=0,stops=0;
const node=()=>({connect(){},gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},frequency:{value:0},start(){starts++},stop(){stops++}});
class Context{constructor(){this.state='suspended';this.sampleRate=44100;this.currentTime=0;this.destination={}}resume(){resumes++;this.state='running';return Promise.resolve()}createBuffer(){return {getChannelData(){return new Float32Array(13230)}}}createBufferSource(){return node()}createBiquadFilter(){return node()}createGain(){return node()}}
class Audio{constructor(src){assert.equal(src,'web/assets/title-audio.mp3');this.src=src}play(){plays++;return Promise.resolve()}pause(){pauses++}}
const env={AudioContext:Context,Audio,Math,Float32Array};env.window=env;vm.runInNewContext(source,env);
env.SFAudio.startMusic();assert.equal(plays,1);env.SFAudio.unlock();assert.equal(resumes,1);
for(const name of ['shot','enemy','impact','reload','hurt'])env.SFAudio.sound(name);
assert.equal(starts,5);assert.equal(stops,5);env.SFAudio.pauseMusic();assert.equal(pauses,1);
env.SFAudio.startMusic();env.SFAudio.setMuted(true);const before=starts;env.SFAudio.sound('shot');assert.equal(starts,before);env.SFAudio.setMuted(false);assert.ok(plays>=3);
const unsupported={};unsupported.window=unsupported;vm.runInNewContext(source,unsupported);
assert.doesNotThrow(()=>{unsupported.SFAudio.unlock();unsupported.SFAudio.startMusic();unsupported.SFAudio.sound('shot');unsupported.SFAudio.pauseMusic()});
console.log('Audio tests passed: original title music, effects, mute and unsupported browser.');
