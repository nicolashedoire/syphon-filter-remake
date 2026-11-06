(function () {
  'use strict';
  const overlay=document.getElementById('overlay'),video=document.getElementById('title-background');
  if(!overlay||!video)return;
  function sync(){
    const active=!overlay.hidden&&!overlay.classList.contains('briefing')&&!document.hidden;
    if(active){const promise=video.play();if(promise&&promise.catch)promise.catch(()=>{});}
    else video.pause();
  }
  new MutationObserver(sync).observe(overlay,{attributes:true,attributeFilter:['hidden','class']});
  document.addEventListener('visibilitychange',sync);
  sync();
})();
