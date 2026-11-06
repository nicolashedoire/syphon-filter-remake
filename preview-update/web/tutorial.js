(function () {
  'use strict';
  const dialog=document.getElementById('controls-dialog'),start=document.getElementById('start'),overlay=document.getElementById('overlay');
  let seen=false,pendingStart=false;
  function openTutorial(){
    if(dialog.open)return;
    if(document.pointerLockElement&&document.exitPointerLock)document.exitPointerLock();
    const quit=document.getElementById('help-save-quit');if(quit)quit.hidden=!overlay.hidden;
    if(typeof window!=='undefined'&&window.SFAudio)window.SFAudio.pauseMusic();
    document.documentElement.dataset.tutorialOpen='true';
    if(typeof dialog.showModal==='function')dialog.showModal();else dialog.setAttribute('open','');
  }
  function closeTutorial(){
    seen=true;document.documentElement.dataset.tutorialOpen='false';
    if(typeof dialog.close==='function')dialog.close();else dialog.removeAttribute('open');
    if(pendingStart){pendingStart=false;start.click();}
    else if(overlay.hidden&&typeof window!=='undefined'&&window.SFAudio)window.SFAudio.startMusic();
  }
  document.getElementById('help-open').addEventListener('click',openTutorial);
  document.getElementById('help-brief').addEventListener('click',openTutorial);
  document.getElementById('help-close').addEventListener('click',closeTutorial);
  document.addEventListener('keydown',event=>{if(event.key.toLowerCase()==='h'&&!dialog.open){event.preventDefault();openTutorial();}});
  dialog.addEventListener('cancel',()=>{pendingStart=false;document.documentElement.dataset.tutorialOpen='false';});
  dialog.addEventListener('close',()=>{document.documentElement.dataset.tutorialOpen='false';});
  start.addEventListener('click',event=>{
    if(overlay.classList.contains('briefing')&&!seen){event.stopImmediatePropagation();pendingStart=true;openTutorial();}
  },true);
})();
