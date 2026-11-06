/* Audio for the browser prototype. Music: French PS1 title STR. Effects: synthesized. */
(function (global) {
  'use strict';
  let context=null, track=null, active=false, muted=false, noise=null, musicTimer=null;
  const MUSIC_GAP_MS=90000;
  const supported=()=>typeof (global.AudioContext||global.webkitAudioContext)==='function';
  function clearMusicTimer(){if(musicTimer!==null){global.clearTimeout(musicTimer);musicTimer=null;}}
  function scheduleMusic(){
    clearMusicTimer();if(!active||muted||typeof global.setTimeout!=='function')return;
    musicTimer=global.setTimeout(()=>{musicTimer=null;if(active&&!muted&&track){try{track.currentTime=0;}catch(error){}playTrack();}},MUSIC_GAP_MS);
  }
  function init(){
    if(!context&&supported())try{context=new (global.AudioContext||global.webkitAudioContext)();}catch(error){}
    if(!track&&typeof global.Audio==='function')try{
      track=new global.Audio('web/assets/title-audio.mp3');track.loop=false;track.volume=.045;track.muted=muted;
      if(typeof track.addEventListener==='function')track.addEventListener('ended',scheduleMusic);
    }catch(error){}
  }
  function playTrack(){
    if(!active||muted||!track||musicTimer!==null)return;
    try{const request=track.play();if(request&&request.catch)request.catch(()=>{});}catch(error){}
  }
  // Call during a real pointer or keyboard gesture. Browsers may still block
  // gamepad-only autoplay; a pointer/key gesture can then enable sound.
  function unlock(){init();if(context&&context.state==='suspended')try{const p=context.resume();if(p&&p.catch)p.catch(()=>{});}catch(error){}playTrack();}
  function startMusic(){active=true;init();playTrack();}
  function pauseMusic(){active=false;clearMusicTimer();if(track)track.pause();}
  function setMuted(value){muted=!!value;if(track){track.muted=muted;if(muted){clearMusicTimer();track.pause();}else playTrack();}}
  function sound(name){
    if(muted||!context||context.state!=='running')return;
    const preset={shot:[130,.075,.027],enemy:[82,.11,.035],impact:[730,.045,.022],reload:[1250,.04,.016],hurt:[95,.16,.025]}[name];
    if(!preset)return;
    try{
      const now=context.currentTime,[hz,baseDuration,volume]=preset;
      // Small independent pitch, timbre and decay changes avoid a repeated
      // identical sample while keeping the suppressed handgun understated.
      const duration=baseDuration*(.88+Math.random()*.24),pitch=.88+Math.random()*.24;
      if(!noise){noise=context.createBuffer(1,Math.ceil(context.sampleRate*.3),context.sampleRate);const samples=noise.getChannelData(0);for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1;}
      const source=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
      source.buffer=noise;if(source.playbackRate)source.playbackRate.value=pitch;
      filter.type=name==='impact'||name==='reload'?'highpass':'lowpass';filter.frequency.value=hz*4*(.9+Math.random()*.2);
      gain.gain.setValueAtTime(volume,now);gain.gain.exponentialRampToValueAtTime(.001,now+duration);
      source.connect(filter);filter.connect(gain);gain.connect(context.destination);source.start(now,Math.random()*.08);source.stop(now+duration);
    }catch(error){}
  }
  if(typeof global.addEventListener==='function')global.addEventListener('pagehide',pauseMusic);
  global.SFAudio=Object.freeze({unlock,startMusic,pauseMusic,setMuted,sound});
})(window);
