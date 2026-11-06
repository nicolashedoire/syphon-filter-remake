(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('game'), overlay = $('overlay'), start = $('start');
  const ui = {title:$('overlay-title'), text:$('overlay-text'), message:$('message'), health:$('health-hud'), healthSide:$('health-side'), healthBar:$('health-bar'), ammo:$('ammo-hud'), ammoSide:$('ammo-side'), status:$('status-side'), frame:$('frame-state'), objective:$('objective-hud'), remaining:$('remaining-hud'), threats:$('objective-threats'), exit:$('objective-exit')};
  const keys = new Set(), TAU=Math.PI*2, CELL=6, player={x:47.8,y:21.32,z:28.25,angle:Math.PI/2,health:100,ammo:12};
  let renderer, groundGrid, wallGrid, enemies=[], exitPoint=null, running=false, finished=false, last=0, clock=0, reloadUntil=0, lastShot=-10, messageUntil=0, yaw=Math.PI/2, pitch=.28, drag=false, lastX=0, lastY=0, pointerError=false;
  const normAngle = a => Math.atan2(Math.sin(a),Math.cos(a));
  const key=(x,z)=>`${x},${z}`;
  const push=(grid,x,z,value)=>{const k=key(x,z);let a=grid.get(k);if(!a){a=[];grid.set(k,a);}a.push(value);};
  function prepareCollision(positions){
    const floors=new Map(), walls=new Map();
    for(let i=0;i<positions.length;i+=9){
      const ax=positions[i],ay=positions[i+1],az=positions[i+2],bx=positions[i+3],by=positions[i+4],bz=positions[i+5],cx=positions[i+6],cy=positions[i+7],cz=positions[i+8];
      const ux=bx-ax,uy=by-ay,uz=bz-az,vx=cx-ax,vy=cy-ay,vz=cz-az,nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,length=Math.hypot(nx,ny,nz);
      if(length<1e-7)continue;
      const minX=Math.floor(Math.min(ax,bx,cx)/CELL),maxX=Math.floor(Math.max(ax,bx,cx)/CELL),minZ=Math.floor(Math.min(az,bz,cz)/CELL),maxZ=Math.floor(Math.max(az,bz,cz)/CELL);
      if((maxX-minX+1)*(maxZ-minZ+1)>400)continue;
      if(Math.abs(ny)/length>.58){const t={ax,ay,az,bx,by,bz,cx,cy,cz};for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++)push(floors,x,z,t);}
      else if(Math.abs(ny)/length<.30 && Math.max(ay,by,cy)-Math.min(ay,by,cy)>.45){
        const edges=[[ax,az,bx,bz],[bx,bz,cx,cz],[cx,cz,ax,az]];edges.sort((a,b)=>Math.hypot(b[2]-b[0],b[3]-b[1])-Math.hypot(a[2]-a[0],a[3]-a[1]));
        const e=edges[0];if(Math.hypot(e[2]-e[0],e[3]-e[1])<.15)continue;const w={x1:e[0],z1:e[1],x2:e[2],z2:e[3],low:Math.min(ay,by,cy),high:Math.max(ay,by,cy)};
        for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++)push(walls,x,z,w);
      }
    }
    return [floors,walls];
  }
  function heightAt(x,z,reference,up=1.25,down=2.2){
    const list=groundGrid.get(key(Math.floor(x/CELL),Math.floor(z/CELL)))||[];let best=null,bestDiff=Infinity;
    for(const t of list){const den=(t.bz-t.cz)*(t.ax-t.cx)+(t.cx-t.bx)*(t.az-t.cz);if(Math.abs(den)<1e-8)continue;
      const a=((t.bz-t.cz)*(x-t.cx)+(t.cx-t.bx)*(z-t.cz))/den,b=((t.cz-t.az)*(x-t.cx)+(t.ax-t.cx)*(z-t.cz))/den,c=1-a-b;
      if(a < -.001||b < -.001||c < -.001)continue;const y=a*t.ay+b*t.by+c*t.cy,d=y-reference;
      if(d<=up&&d>=-down&&Math.abs(d)<bestDiff){best=y;bestDiff=Math.abs(d);}
    }return best;
  }
  function wallAt(x,y,z){
    const nearby=wallGrid.get(key(Math.floor(x/CELL),Math.floor(z/CELL)))||[];
    for(const w of nearby){if(w.high<y+.3||w.low>y+1.35)continue;const dx=w.x2-w.x1,dz=w.z2-w.z1,l=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((x-w.x1)*dx+(z-w.z1)*dz)/l));if(Math.hypot(x-(w.x1+t*dx),z-(w.z1+t*dz))<.32)return true;}
    return false;
  }
  function moveAxis(p,dx,dz){const x=p.x+dx,z=p.z+dz,y=heightAt(x,z,p.y);if(y!==null&&!wallAt(x,y,z)){p.x=x;p.z=z;p.y=y;return true;}return false;}
  function setMessage(text,seconds=2){ui.message.textContent=text;messageUntil=clock+seconds;}
  function reset(){
    player.x=47.8;player.y=heightAt(47.8,28.25,21.32,3,3)??21.32;player.z=28.25;player.angle=Math.PI/2;player.health=100;player.ammo=12;yaw=Math.PI/2;pitch=.28;clock=0;lastShot=-10;reloadUntil=0;finished=false;keys.clear();
    const exitX=player.x-6, exitY=heightAt(exitX,player.z,player.y,1.5,2);exitPoint=exitY!==null&&!wallAt(exitX,exitY,player.z)?{x:exitX,y:exitY,z:player.z}:{x:player.x,y:player.y,z:player.z};enemies=placeEnemies();ui.threats.classList.remove('done');ui.exit.classList.remove('done');ui.threats.querySelector('b').textContent='01';ui.exit.querySelector('b').textContent='02';setMessage('SÉCURISEZ LA ZONE',4);sync();
  }
  function placeEnemies(){
    const result=[];
    for(const [d,offset] of [[8,-2],[13,2],[18,-1]]){
      let chosen=null;
      for(let radius=0;radius<=8&&!chosen;radius+=1.5)for(let j=0;j<12&&!chosen;j++){
        const a=j*TAU/12,x=player.x-d+Math.cos(a)*radius,z=player.z+offset+Math.sin(a)*radius,y=heightAt(x,z,player.y,1.5,2);
        if(y!==null&&!wallAt(x,y,z)&&Math.hypot(x-player.x,z-player.z)>4&&result.every(e=>Math.hypot(e.x-x,e.z-z)>2.5))chosen={x,y,z,angle:-Math.PI/2,alive:true,health:2,fire:2+d/10};
      }
      if(chosen)result.push(chosen);
    }
    return result;
  }
  function remaining(){return enemies.filter(e=>e.alive).length;}
  function sync(){const left=remaining();ui.health.textContent=Math.ceil(player.health);ui.healthSide.textContent=Math.ceil(player.health)+' %';ui.healthBar.style.width=player.health+'%';ui.ammo.textContent=player.ammo+' / 12';ui.ammoSide.textContent=player.ammo+' / 12';ui.remaining.textContent='MENACES · '+String(left).padStart(2,'0');ui.status.textContent=running?'EN MISSION':finished?'MISSION TERMINÉE':'EN ATTENTE';ui.frame.textContent=running?'EN MISSION':finished?'FIN DE TRANSMISSION':'EN ATTENTE';ui.objective.textContent=left?'SÉCURISEZ LA ZONE':'REJOIGNEZ L’EXTRACTION';if(!left&&enemies.length){ui.threats.classList.add('done');ui.threats.querySelector('b').textContent='✓';}}
  function finish(won){running=false;finished=true;if(document.pointerLockElement===canvas)document.exitPointerLock();ui.title.innerHTML=won?'MISSION<br><em>ACCOMPLIE.</em>':'MISSION<br><em>INTERROMPUE.</em>';ui.text.textContent=won?'Zone sécurisée. Vous avez rejoint le point d’extraction.':'Votre intégrité est épuisée. Reprenez la mission depuis le début.';start.innerHTML='RECOMMENCER LA MISSION <span>↗</span>';overlay.hidden=false;if(won){ui.exit.classList.add('done');ui.exit.querySelector('b').textContent='✓';}sync();}
  function fire(){if(!running||clock<reloadUntil||clock-lastShot<.28)return;if(player.ammo<=0){setMessage('CHARGEUR VIDE · APPUYEZ SUR R');return;}lastShot=clock;player.ammo--;let target=null,best=Infinity;for(const e of enemies){if(!e.alive)continue;const dx=e.x-player.x,dz=e.z-player.z,d=Math.hypot(dx,dz),a=Math.abs(normAngle(Math.atan2(-dx,-dz)-yaw));if(d<45&&a<.20&&d<best){target=e;best=d;}}if(target){target.health--;if(target.health<=0){target.alive=false;setMessage(remaining()?'MENACE NEUTRALISÉE':'ZONE SÉCURISÉE · RETOURNEZ À L’EXTRACTION',4);}else setMessage('CIBLE TOUCHÉE');}else setMessage('TIR EFFECTUÉ');sync();}
  function reload(){if(!running||player.ammo===12||clock<reloadUntil)return;reloadUntil=clock+1.1;setMessage('RECHARGEMENT…',1.1);}
  function advance(dt){
    clock+=dt;if(reloadUntil&&clock>=reloadUntil){reloadUntil=0;player.ammo=12;setMessage('CHARGEUR REMPLI');}
    const strafe=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('q')||keys.has('a')||keys.has('arrowleft')?1:0),forward=(keys.has('z')||keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0),m=Math.hypot(strafe,forward)||1,speed=keys.has('shift')?1.9:5.4;
    const dx=(Math.cos(yaw)*strafe-Math.sin(yaw)*forward)/m*speed*dt,dz=(-Math.sin(yaw)*strafe-Math.cos(yaw)*forward)/m*speed*dt;
    if(dx||dz){if(!moveAxis(player,dx,dz)){moveAxis(player,dx,0);moveAxis(player,0,dz);}player.angle=Math.atan2(-dx,-dz);}
    for(const e of enemies){if(!e.alive)continue;const dx=player.x-e.x,dz=player.z-e.z,d=Math.hypot(dx,dz);e.angle=Math.atan2(-dx,-dz);if(d<20){e.fire-=dt;if(e.fire<=0){e.fire=2.5;player.health=Math.max(0,player.health-7);setMessage('CONTACT ENNEMI · RIPOSTEZ',1.8);}}}
    if(player.health<=0){finish(false);return;}
    if(enemies.length&&remaining()===0&&Math.hypot(player.x-exitPoint.x,player.z-exitPoint.z)<1.7){finish(true);return;}
    if(clock>messageUntil)ui.message.textContent=remaining()?'NEUTRALISEZ LES MENACES':'REJOIGNEZ LE POINT D’EXTRACTION';sync();
  }
  function frame(time){const dt=Math.min((time-last)/1000||0,.05);last=time;if(running)advance(dt);if(renderer)renderer.render({player,cameraYaw:yaw,cameraPitch:pitch,enemies,objective:running&&!remaining()&&enemies.length?exitPoint:null});requestAnimationFrame(frame);}
  function look(dx,dy){yaw=normAngle(yaw-dx*.003);pitch=Math.max(.07,Math.min(.9,pitch+dy*.002));}
  start.addEventListener('click',()=>{if(!renderer)return;reset();if(!enemies.length){ui.text.textContent='Impossible de placer les menaces dans cette zone.';return;}running=true;overlay.hidden=true;canvas.focus();sync();if(canvas.requestPointerLock){const p=canvas.requestPointerLock();if(p&&p.catch)p.catch(()=>{pointerError=true;setMessage('MAINTENEZ LE CLIC POUR TOURNER LA CAMÉRA',5);});}});
  document.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)&&running)e.preventDefault();if(!keys.has(k)&&k==='r')reload();keys.add(k);});document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();drag=false;});
  document.addEventListener('mousemove',e=>{if(!running)return;if(document.pointerLockElement===canvas)look(e.movementX,e.movementY);else if(drag){look(e.clientX-lastX,e.clientY-lastY);lastX=e.clientX;lastY=e.clientY;}});
  canvas.addEventListener('mousedown',e=>{if(!running||e.button!==0)return;if(document.pointerLockElement!==canvas){drag=true;lastX=e.clientX;lastY=e.clientY;if(!pointerError&&canvas.requestPointerLock){const p=canvas.requestPointerLock();if(p&&p.catch)p.catch(()=>{pointerError=true;});}}fire();});window.addEventListener('mouseup',()=>drag=false);canvas.addEventListener('contextmenu',e=>e.preventDefault());
  try{if(!window.SF_SCENE||!window.SFRenderer)throw new Error('Les ressources du jeu sont absentes.');[groundGrid,wallGrid]=prepareCollision(SF_SCENE.positions);renderer=new SFRenderer(canvas,SF_SCENE);reset();requestAnimationFrame(frame);}catch(error){ui.title.innerHTML='CHARGEMENT<br><em>IMPOSSIBLE.</em>';ui.text.textContent='Le navigateur ne peut pas lancer la scène 3D. Vérifiez que WebGL est disponible et que tous les fichiers du projet sont présents.';start.disabled=true;console.error(error);}
})();
