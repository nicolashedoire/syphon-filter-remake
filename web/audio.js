/* Audio for the browser prototype. Music: French PS1 title STR. Effects: synthesized. */
(function (global) {
  'use strict';
  let context=null, track=null, active=false, muted=false, noise=null;
  const supported=()=>typeof (global.AudioContext||global.webkitAudioContext)==='function';
  function init(){
    if(!context&&supported())try{context=new (global.AudioContext||global.webkitAudioContext)();}catch(error){}
    if(!track&&typeof global.Audio==='function')try{
      track=new global.Audio('web/assets/title-audio.mp3');track.loop=true;track.volume=.18;track.muted=muted;
    }catch(error){}
  }
  function playTrack(){
    if(!active||muted||!track)return;
    try{const request=track.play();if(request&&request.catch)request.catch(()=>{});}catch(error){}
  }
  // Call during a real pointer or keyboard gesture. Browsers may still block
  // gamepad-only autoplay; a pointer/key gesture can then enable sound.
  function unlock(){init();if(context&&context.state==='suspended')try{const p=context.resume();if(p&&p.catch)p.catch(()=>{});}catch(error){}playTrack();}
  function startMusic(){active=true;init();playTrack();}
  function pauseMusic(){active=false;if(track)track.pause();}
  function setMuted(value){muted=!!value;if(track){track.muted=muted;if(muted)track.pause();else playTrack();}}
  function sound(name){
    if(muted||!context||context.state!=='running')return;
    const preset={shot:[130,.10,.10],enemy:[82,.16,.13],impact:[730,.07,.07],reload:[1250,.055,.04],hurt:[95,.25,.08]}[name];
    if(!preset)return;
    try{
      const now=context.currentTime,[hz,duration,volume]=preset;
      if(!noise){noise=context.createBuffer(1,Math.ceil(context.sampleRate*.3),context.sampleRate);const samples=noise.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;}
      const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
      source.buffer=noise;filter.type=name==='impact'||name==='reload'?'highpass':'lowpass';filter.frequency.value=hz*4;
      gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.001,now+duration);
      source.connect(filter);filter.connect(gain);gain.connect(context.destination);source.start(now);source.stop(now+duration);
    }catch(error){}
  }
  global.SFAudio=Object.freeze({unlock,startMusic,pauseMusic,setMuted,sound});
})(window);
