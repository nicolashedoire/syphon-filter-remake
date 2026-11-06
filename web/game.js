(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const canvas = $('game'), overlay = $('overlay'), start = $('start'), reticle=$('reticle'), continueGame=$('continue-game');
  const rules=window.SFPS1Rules;
  const cinematics=$('cinematics'), introVideo=$('intro-video'), skipIntro=$('skip-intro');
  let phase='introduction',introIndex=0;
  const ui = {title:$('overlay-title'), text:$('overlay-text'), message:$('message'), health:$('health-hud'), healthSide:$('health-side'), healthBar:$('health-bar'), ammo:$('ammo-hud'), ammoSide:$('ammo-side'), status:$('status-side'), frame:$('frame-state'), objective:$('objective-hud'), remaining:$('remaining-hud'), threats:$('objective-threats'), exit:$('objective-exit')};
  const keys = new Set(), TAU=Math.PI*2, CELL=6, player={x:47.8,y:21.32,z:28.25,angle:Math.PI/2,health:150,armor:600,ammo:15,reserve:45};
  let renderer, groundGrid, wallGrid, collisionPositions, enemies=[], exitPoint=null, running=false, finished=false, last=0, clock=0, reloadUntil=0, lastShot=-10, messageUntil=0, yaw=Math.PI/2, pitch=.05, drag=false, lastX=0, lastY=0, pointerError=false, fallbackPositionKnown=false, camera=null, cameraImmediate=false, impact=null, impactUntil=0, combatActive=false, combatStartsAt=0, nextMarkerUpdate=0;
  let gamepadIndex=null, gamepadButtons=[], gamepadNeedsRelease=false, inputFocused=true, usingGamepad=false, gamepadMenuSelection=0, gamepadMenuAxis=0, pauseMenuSelection=0;
  let nextSaveAt=0;
  let enemyShots=[];
  let gamepadAxes={turn:0,forward:0,lookX:0,lookY:0};
  // Screen-space coordinates use -1..1 for the full viewport, with Y down.
  let aimX=0,aimY=0,lockHeld=false,lockedEnemy=null,nextLockCheck=0;
  function displayReticle(x,y){if(reticle&&reticle.style){reticle.style.left=(50+x*50)+'%';reticle.style.top=(50+y*50)+'%';}}
  function moveReticle(x,y){
    aimX=Math.max(-.9,Math.min(.9,x));aimY=Math.max(-.9,Math.min(.9,y));
    if(!lockHeld)displayReticle(aimX,aimY);
  }
  function shotDirection(view){
    const delta=view.target.map((v,i)=>v-view.eye[i]),length=Math.hypot(...delta);if(length<1e-6)return null;
    const f=delta.map(v=>v/length),horizontal=Math.hypot(f[0],f[2]);
    if(horizontal<1e-6)return f;
    const right=[-f[2]/horizontal,0,f[0]/horizontal];
    const up=[-right[2]*f[1],right[2]*f[0]-right[0]*f[2],right[0]*f[1]];
    // Must match the WebGL renderer's 60° vertical FOV and viewport aspect.
    const width=canvas.clientWidth||canvas.width||1,height=canvas.clientHeight||canvas.height||1;
    const tangent=Math.tan(Math.PI/6),horizontalOffset=aimX*tangent*width/height,verticalOffset=-aimY*tangent;
    const ray=f.map((v,i)=>v+right[i]*horizontalOffset+up[i]*verticalOffset),n=Math.hypot(...ray);
    return ray.map(v=>v/n);
  }
  const normAngle = a => Math.atan2(Math.sin(a),Math.cos(a));
  const tutorialOpen = () => document.documentElement?.dataset?.tutorialOpen === 'true';
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
  function refreshContinue(){if(continueGame)continueGame.hidden=!(window.SFSave&&window.SFSave.load());}
  function saveGame(){
    if(!running||!window.SFSave||!exitPoint)return false;
    const snapshot={player:{x:player.x,y:player.y,z:player.z,angle:player.angle,health:player.health,armor:player.armor,ammo:player.ammo,reserve:player.reserve},camera:{yaw,pitch},
      enemies:enemies.map(e=>({x:e.x,y:e.y,z:e.z,angle:e.angle,alive:e.alive,health:e.health,fire:e.fire,source:e.source??null,routeIndex:e.routeIndex??0})),exitPoint,clock,combatActive,combatStartsAt,reloadUntil,lastShot};
    return window.SFSave.save(snapshot);
  }
  function restoreGame(saved){
    Object.assign(player,saved.player,{moving:false,running:false,reverse:false,animation:'idle',animationTime:0});
    yaw=saved.camera.yaw;pitch=saved.camera.pitch;clock=saved.clock;combatActive=saved.combatActive;combatStartsAt=saved.combatStartsAt;reloadUntil=saved.reloadUntil;lastShot=saved.lastShot;exitPoint={...saved.exitPoint};
    const actor=(window.SF_OPENING_ACTORS||[]).find(a=>a.source===184);
    enemies=saved.enemies.map(e=>({...e,moving:false,running:false,...(!e.alive?{deathAt:clock-2}:{}),...(e.source===184&&actor?{route:actor.route.map(p=>p.map(n=>n/100))}:{})}));
    camera=null;cameraImmediate=true;nextMarkerUpdate=0;sync();
  }
  // The original mission scripts use centimetre-like native coordinates and an
  // inverted vertical axis; renderer coordinates are scaled by 1/100.
  function missionCommandsAtPlayer(){
    if(!window.SFGeorgiaMission)return [];
    const preview=new window.SFGeorgiaMission();
    return preview.update({x:player.x*100,y:-player.y*100,z:player.z*100,interact:true});
  }
  function interact(){
    if(!running||tutorialOpen())return;
    const commands=missionCommandsAtPlayer();
    if(commands.some(c=>c.type==='destroy_object_source'&&c.object===317)){
      setMessage('COMMANDE DE SÉCURITÉ REPÉRÉE · OUVERTURE À INTÉGRER',4);return;
    }
    if(commands.some(c=>c.type==='teleport_to_source')){
      setMessage('ASCENSEUR REPÉRÉ · MÉCANISME À INTÉGRER',4);return;
    }
    const body=enemies.find(e=>!e.alive&&Math.hypot(e.x-player.x,e.y-player.y,e.z-player.z)<2.2);
    if(body){setMessage('HOSTILE NEUTRALISÉ · ZONE D’ENTRAÎNEMENT',3);return;}
    setMessage('AUCUNE INTERACTION À PROXIMITÉ · H POUR LES COMMANDES',3);
  }
  function reset(){
    clearLock();
    enemyShots=[];
    moveReticle(0,0);
    player.x=47.8;player.y=heightAt(47.8,28.25,21.32,3,3)??21.32;player.z=28.25;player.angle=Math.PI/2;player.moving=false;player.running=false;player.reverse=false;player.animation='idle';player.animationTime=0;player.health=rules.initialHealth;player.armor=rules.initialArmor;player.ammo=rules.magazineCapacity;player.reserve=rules.initialReserve;yaw=Math.PI/2;pitch=.05;clock=0;lastShot=-10;reloadUntil=0;impact=null;camera=null;cameraImmediate=true;finished=false;combatActive=false;combatStartsAt=0;nextMarkerUpdate=0;fallbackPositionKnown=false;keys.clear();
    const exitX=player.x-6, exitY=heightAt(exitX,player.z,player.y,1.5,2);exitPoint=exitY!==null&&!wallAt(exitX,exitY,player.z)?{x:exitX,y:exitY,z:player.z}:{x:player.x,y:player.y,z:player.z};enemies=placeEnemies();ui.threats.classList.remove('done');ui.exit.classList.remove('done');ui.threats.querySelector('b').textContent='01';ui.exit.querySelector('b').textContent='02';setMessage('HOSTILES : REPÈRES ROUGES · CLIC GAUCHE OU ESPACE POUR TIRER',6);sync();
  }
  function placeEnemies(){
    const result=[];
    const authored=(window.SF_OPENING_ACTORS||[]).find(a=>a.source===184&&a.model==='TERRO.HMD'&&Array.isArray(a.route)&&a.route.length);
    // Keep two local training targets; the third follows an authored French-disc route.
    for(const [d,offset] of (authored?[[8,-2],[13,2]]:[[8,-2],[13,2],[18,-1]])){
      let chosen=null;
      for(let radius=0;radius<=8&&!chosen;radius+=1.5)for(let j=0;j<12&&!chosen;j++){
        const a=j*TAU/12,x=player.x-d+Math.cos(a)*radius,z=player.z+offset+Math.sin(a)*radius,y=heightAt(x,z,player.y,1.5,2);
        if(y!==null&&!wallAt(x,y,z)&&Math.hypot(x-player.x,z-player.z)>4&&segmentVisible([player.x,player.y+1.2,player.z],[x,y+1.2,z])&&result.every(e=>Math.hypot(e.x-x,e.z-z)>2.5))chosen={x,y,z,angle:-Math.PI/2,alive:true,health:2,fire:2+d/10,moving:false,running:false};
      }
      if(chosen)result.push(chosen);
    }
    if(authored){
      const [x,y,z]=authored.position.map(n=>n/100),ground=heightAt(x,z,y,1.5,2);
      if(ground!==null&&!wallAt(x,ground,z))result.push({source:authored.source,x,y:ground,z,angle:0,alive:true,health:2,fire:3,moving:false,running:false,route:authored.route.map(p=>[p[0]/100,p[1]/100,p[2]/100]),routeIndex:0});
    }
    return result;
  }
  function remaining(){return enemies.filter(e=>e.alive).length;}
  function sync(){const left=remaining(),integrity=Math.ceil(100*(player.health+player.armor)/(rules.initialHealth+rules.initialArmor));ui.health.textContent=integrity;ui.healthSide.textContent=integrity+' %';ui.healthBar.style.width=integrity+'%';ui.ammo.textContent=player.ammo+' / '+player.reserve;ui.ammoSide.textContent=player.ammo+' / '+player.reserve;ui.remaining.textContent='MENACES · '+String(left).padStart(2,'0');const remainingMenu=$('pause-remaining');if(remainingMenu)remainingMenu.textContent=left;ui.status.textContent=running?'EN MISSION':finished?'ENTRAÎNEMENT TERMINÉ':'EN ATTENTE';ui.frame.textContent=running?'EN MISSION':finished?'FIN DE TRANSMISSION':'EN ATTENTE';ui.objective.textContent=left?'SÉCURISEZ LA ZONE':'REJOIGNEZ L’EXTRACTION';if(!left&&enemies.length){ui.threats.classList.add('done');ui.threats.querySelector('b').textContent='✓';}}
  function finish(won){running=false;finished=true;phase='briefing';overlay.classList.add('briefing');if(won&&window.SFSave)window.SFSave.clear();if(window.SFAudio)window.SFAudio.pauseMusic();if(document.pointerLockElement===canvas)document.exitPointerLock();ui.title.innerHTML=won?'ENTRAÎNEMENT<br><em>TERMINÉ.</em>':'MISSION<br><em>INTERROMPUE.</em>';ui.text.textContent=won?'Zone d’entraînement sécurisée. Les objectifs de la mission originale restent à intégrer.':'Votre intégrité est épuisée. Reprenez la mission depuis le début.';start.innerHTML='RECOMMENCER LA MISSION <span>↗</span>';overlay.hidden=false;if(won){ui.exit.classList.add('done');ui.exit.querySelector('b').textContent='✓';}sync();}
  // Intersect a normalized ray with the actual level triangles using the
  // double-sided Möller–Trumbore test. Return the nearest positive distance.
  function traceScene(origin, direction, maxDistance) {
    let best=maxDistance;
    for(const p of [SF_SCENE.positions,window.SF_PROPS&&window.SF_PROPS.positions]){
    if(!p)continue;
    for(let i=0;i<p.length;i+=9){
      const ax=p[i],ay=p[i+1],az=p[i+2],e1x=p[i+3]-ax,e1y=p[i+4]-ay,e1z=p[i+5]-az,e2x=p[i+6]-ax,e2y=p[i+7]-ay,e2z=p[i+8]-az;
      const hx=direction[1]*e2z-direction[2]*e2y,hy=direction[2]*e2x-direction[0]*e2z,hz=direction[0]*e2y-direction[1]*e2x,det=e1x*hx+e1y*hy+e1z*hz;
      if(Math.abs(det)<1e-8)continue;
      const f=1/det,sx=origin[0]-ax,sy=origin[1]-ay,sz=origin[2]-az,u=f*(sx*hx+sy*hy+sz*hz);if(u<0||u>1)continue;
      const qx=sy*e1z-sz*e1y,qy=sz*e1x-sx*e1z,qz=sx*e1y-sy*e1x,v=f*(direction[0]*qx+direction[1]*qy+direction[2]*qz);if(v<0||u+v>1)continue;
      const t=f*(e2x*qx+e2y*qy+e2z*qz);if(t>.04&&t<best)best=t;
    }}
    return best<maxDistance?best:null;
  }
  function rayBox(origin,direction,min,max,maximum){
    let near=0,far=maximum;
    for(let i=0;i<3;i++){
      if(Math.abs(direction[i])<1e-9){if(origin[i]<min[i]||origin[i]>max[i])return null;continue;}
      let a=(min[i]-origin[i])/direction[i],b=(max[i]-origin[i])/direction[i];if(a>b){const t=a;a=b;b=t;}
      near=Math.max(near,a);far=Math.min(far,b);if(near>far)return null;
    }
    return near>0?near:far>0?far:null;
  }
  function segmentVisible(a,b){
    const delta=b.map((value,i)=>value-a[i]),len=Math.hypot(...delta);if(len<.1)return true;
    const direction=delta.map(v=>v/len);return traceScene(a,direction,len-.04)===null;
  }
  function setLockStatus(text){const node=$('lock-status');if(node&&node.textContent!==text)node.textContent=text;}
  function clearLock(){lockHeld=false;lockedEnemy=null;nextLockCheck=0;setLockStatus('');if(reticle&&reticle.dataset)reticle.dataset.locked='false';displayReticle(aimX,aimY);}
  function projectTarget(enemy){
    if(!camera||!camera.eye||!camera.target||!enemy||!enemy.alive)return null;
    const origin=camera.eye,point=[enemy.x,enemy.y+1.2,enemy.z],f=camera.target.map((v,i)=>v-origin[i]),flen=Math.hypot(...f);if(flen<1e-6)return null;
    for(let i=0;i<3;i++)f[i]/=flen;
    const horizontal=Math.hypot(f[0],f[2]);if(horizontal<1e-6)return null;
    const r=[-f[2]/horizontal,0,f[0]/horizontal],u=[-r[2]*f[1],r[2]*f[0]-r[0]*f[2],r[0]*f[1]],d=point.map((v,i)=>v-origin[i]);
    const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],depth=dot(d,f);if(depth<=.08||Math.hypot(...d)>70)return null;
    const aspect=(canvas.clientWidth||canvas.width||1)/(canvas.clientHeight||canvas.height||1),tangent=Math.tan(Math.PI/6),x=dot(d,r)/(depth*tangent*aspect),y=-dot(d,u)/(depth*tangent);
    if(Math.abs(x)>1||Math.abs(y)>1)return null;
    return {x,y,point};
  }
  function isLockVisible(enemy,projection){
    return !!projection&&segmentVisible(camera.eye,projection.point)&&segmentVisible([player.x,player.y+1.2,player.z],projection.point);
  }
  function updateLock(force=false){
    if(!lockHeld||!running||tutorialOpen()){if(lockHeld||lockedEnemy)clearLock();return;}
    let projection=projectTarget(lockedEnemy);
    if(force||clock>=nextLockCheck||(lockedEnemy&&!projection)){
      nextLockCheck=clock+.15;
      if(!isLockVisible(lockedEnemy,projection)){
        lockedEnemy=null;projection=null;let best=Infinity;
        for(const enemy of enemies){const candidate=projectTarget(enemy);if(!candidate||!isLockVisible(enemy,candidate))continue;
          const score=(candidate.x-aimX)**2+(candidate.y-aimY)**2;if(score<best){best=score;lockedEnemy=enemy;projection=candidate;}}
      }
    }
    if(reticle&&reticle.dataset)reticle.dataset.locked=projection?'true':'false';
    if(projection){displayReticle(projection.x,projection.y);setLockStatus('CIBLE VERROUILLÉE · R2 : TIRER');}
    else {lockedEnemy=null;displayReticle(aimX,aimY);setLockStatus('AUCUNE CIBLE VISIBLE');}
  }
  function fire(){
    if(!running||tutorialOpen()||clock<reloadUntil||clock-lastShot<.28)return;
    if(player.ammo<=0){setMessage('CHARGEUR VIDE · APPUYEZ SUR R');return;}
    if(!camera||!camera.eye||!camera.target){setMessage('VISÉE EN PRÉPARATION');return;}
    if(lockHeld){updateLock(true);if(!lockedEnemy){setMessage('AUCUNE CIBLE VISIBLE',2);return;}}
    lastShot=clock;player.ammo--;player.angle=camera?.yaw??yaw;if(window.SFAudio)window.SFAudio.sound('shot');
    const origin=camera.eye,lockedPoint=lockedEnemy&&lockHeld?[lockedEnemy.x,lockedEnemy.y+1.2,lockedEnemy.z]:null,delta=lockedPoint&&lockedPoint.map((v,i)=>v-origin[i]),length=delta&&Math.hypot(...delta),direction=delta&&length?delta.map(v=>v/length):shotDirection(camera);
    if(!direction){sync();return;}
    const range=70,wallDistance=traceScene(origin,direction,range);
    let distance=wallDistance??range,target=null;
    for(const e of enemies){if(!e.alive)continue;
      const d=rayBox(origin,direction,[e.x-.48,e.y+.02,e.z-.48],[e.x+.48,e.y+1.85,e.z+.48],distance);
      if(d!==null&&d<distance){distance=d;target=e;}
    }
    const hitPoint=origin.map((v,i)=>v+direction[i]*distance),muzzle=[player.x,player.y+1.2,player.z];let blocked=wallDistance!==null;
    if(!segmentVisible(muzzle,hitPoint)){
      blocked=true;
      target=null;const muzzleDelta=hitPoint.map((v,i)=>v-muzzle[i]),muzzleLen=Math.hypot(...muzzleDelta),muzzleRay=muzzleDelta.map(v=>v/muzzleLen),block=traceScene(muzzle,muzzleRay,muzzleLen);
      if(block!==null)for(let i=0;i<3;i++)hitPoint[i]=muzzle[i]+muzzleRay[i]*block;
    }
    impact={x:hitPoint[0],y:hitPoint[1],z:hitPoint[2],hit:!!target};impactUntil=clock+.2;if(window.SFAudio)window.SFAudio.sound('impact');
    if(target){const firstHit=!combatActive;if(firstHit){combatActive=true;combatStartsAt=clock+3.5;}target.health--;if(target.health<=0){target.alive=false;target.deathAt=clock;target.deathTime=0;setMessage(remaining()?'MENACE NEUTRALISÉE':'ZONE SÉCURISÉE · REJOIGNEZ L’EXTRACTION',4);}else setMessage(firstHit?'CIBLE TOUCHÉE · ENNEMIS ALERTÉS':'CIBLE TOUCHÉE',firstHit?3.5:2);}
    else setMessage(blocked?'IMPACT SUR LE DÉCOR':'TIR EFFECTUÉ');
    sync();
  }
  function reload(){if(!running||tutorialOpen()||player.ammo===rules.magazineCapacity||clock<reloadUntil)return;if(!player.reserve){setMessage('PLUS DE MUNITIONS EN RÉSERVE',2);return;}reloadUntil=clock+1.1;if(window.SFAudio)window.SFAudio.sound('reload');setMessage('RECHARGEMENT…',1.1);}
  function advance(dt){
    clock+=dt;if(reloadUntil&&clock>=reloadUntil){reloadUntil=0;rules.reload(player);setMessage('CHARGEUR RECHARGÉ');}
    const clampAxis=value=>Math.max(-1,Math.min(1,value));
    const turn=clampAxis((keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('q')||keys.has('a')||keys.has('arrowleft')?1:0)+gamepadAxes.turn);
    const forward=clampAxis((keys.has('z')||keys.has('w')||keys.has('arrowup')?1:0)-(keys.has('s')||keys.has('arrowdown')?1:0)+gamepadAxes.forward);
    if(!lockHeld&&(gamepadAxes.lookX||gamepadAxes.lookY))moveReticle(aimX+gamepadAxes.lookX*1.15*dt,aimY+gamepadAxes.lookY*1.15*dt);
    const speed=(keys.has('shift')||forward<0)?rules.walkSpeed:rules.runSpeed;
    // PS1-style tank controls: turn in place, then travel along the agent's heading.
    if(turn){player.angle=normAngle(player.angle-turn*2.1*dt);yaw=player.angle;cameraImmediate=false;}
    const dx=-Math.sin(player.angle)*forward*speed*dt,dz=-Math.cos(player.angle)*forward*speed*dt;
    const previousX=player.x,previousZ=player.z;
    if(dx||dz){if(!moveAxis(player,dx,dz)){moveAxis(player,dx,0);moveAxis(player,0,dz);}}
    player.moving=Math.hypot(player.x-previousX,player.z-previousZ)>.0001;player.reverse=player.moving&&forward<0;player.running=player.moving&&!keys.has('shift')&&!player.reverse;
    const animation=player.moving?(player.running?'run':'walk'):'idle';
    if(player.animation!==animation){player.animation=animation;player.animationTime=0;}else player.animationTime+=dt;
    for(const e of enemies){if(!e.alive)continue;
      e.moving=false;
      // Route nodes are original; timing and the switch from patrol to combat
      // are provisional until the PS1 actor state machine has been recovered.
      if(!combatActive&&e.route&&e.routeIndex<e.route.length){
        let target=e.route[e.routeIndex],rx=target[0]-e.x,rz=target[2]-e.z,dist=Math.hypot(rx,rz);
        if(dist<.12){e.routeIndex++;target=e.route[e.routeIndex];if(target){rx=target[0]-e.x;rz=target[2]-e.z;dist=Math.hypot(rx,rz);}}
        if(target&&dist>0){const step=Math.min(dist,1.4*dt);e.angle=Math.atan2(-rx,-rz);e.moving=moveAxis(e,rx/dist*step,rz/dist*step);}
      }
      const dx=player.x-e.x,dz=player.z-e.z,d=Math.hypot(dx,dz);if(combatActive||!e.route)e.angle=Math.atan2(-dx,-dz);
      const facing=Math.abs(normAngle(Math.atan2(dx,dz)-yaw))<.85;
      if(combatActive&&clock>=combatStartsAt&&d<20&&facing&&segmentVisible([e.x,e.y+1.25,e.z],[player.x,player.y+1.25,player.z])){
        e.fire-=dt;if(e.fire<=0){e.fire=2.5;enemyShots.push({from:[e.x,e.y+1.3,e.z],to:[player.x,player.y+1.2,player.z],until:clock+.14});if(window.SFAudio){window.SFAudio.sound('enemy');window.SFAudio.sound('hurt');}rules.applyPlayerDamage(player,7);setMessage('CONTACT ENNEMI · RIPOSTEZ',1.8);}
      }}
    if(player.health<=0){finish(false);return;}
    if(enemies.length&&remaining()===0&&Math.hypot(player.x-exitPoint.x,player.z-exitPoint.z)<1.7){finish(true);return;}
    if(clock>messageUntil)ui.message.textContent=remaining()?'NEUTRALISEZ LES MENACES':'REJOIGNEZ LE POINT D’EXTRACTION';sync();
  }
  // Browsers may expose a standard gamepad only after its first button press.
  // Polling also makes disconnection safe even when the event is missed.
  function gamepadStatus(text){const status=$('gamepad-status');if(status&&status.textContent!==text)status.textContent=text;}
  // Continue only belongs to the title screen; briefing styles hide it even
  // when a valid save exists, so never let the gamepad select it there.
  function titleMenuItems(){return [start,...(phase==='introduction'&&continueGame&&!continueGame.hidden?[continueGame]:[]),$('help-brief')].filter(Boolean);}
  function selectGamepadMenu(selection){
    const items=titleMenuItems();gamepadMenuSelection=Math.max(0,Math.min(items.length-1,selection));
    for(const node of [start,continueGame,$('help-brief')])if(node&&node.dataset)node.dataset.gamepadSelected=node===items[gamepadMenuSelection]?'true':'false';
    const target=items[gamepadMenuSelection];if(target&&typeof target.focus==='function')target.focus();
  }
  function pollGamepad(){
    gamepadAxes={turn:0,forward:0,lookX:0,lookY:0};
    let pads=[];
    let available=false;
    try{if(typeof navigator!=='undefined'&&typeof navigator.getGamepads==='function'){available=true;pads=navigator.getGamepads()||[];}}catch(error){available=false;pads=[];}
    const pad=Array.from(pads).find(p=>p&&p.connected!==false&&(p.mapping==='standard'||!p.mapping));
    if(!pad){if(lockHeld)clearLock();gamepadStatus(available?'MANETTE : APPUYEZ SUR UNE TOUCHE':'MANETTE : NAVIGATEUR NON COMPATIBLE');if(gamepadIndex!==null)gamepadNeedsRelease=true;gamepadIndex=null;gamepadButtons=[];gamepadMenuAxis=0;return;}
    gamepadStatus('MANETTE CONNECTÉE · CROIX / OPTIONS : VALIDER');
    if(gamepadIndex!==null&&gamepadIndex!==pad.index)gamepadNeedsRelease=true;
    gamepadIndex=pad.index;
    const buttons=Array.from(pad.buttons||[],b=>!!(b&&(b.pressed||b.value>=.5)));
    // A first press can arrive in the very first frame after focus returns,
    // even when the browser kept exposing the pad while the page was blurred.
    // Menu actions are edge-triggered, so allow that fresh press immediately;
    // in gameplay retain the release gate to avoid unintended shots.
    if(inputFocused&&!running&&phase!=='cinematics')gamepadNeedsRelease=false;
    if(!inputFocused||gamepadNeedsRelease){
      if(lockHeld)clearLock();
      if(inputFocused&&!buttons.some(Boolean))gamepadNeedsRelease=false;
      gamepadButtons=buttons;return;
    }
    const pressed=i=>!!buttons[i]&&!gamepadButtons[i];
    if(buttons.some(Boolean))usingGamepad=true;
    // Edges are recorded before actions: one held button cannot activate the
    // title, close the guide, and interact again after a phase change.
    const cross=pressed(0),square=pressed(2),trigger=pressed(7),options=pressed(9),recenter=pressed(11);
    const confirm=cross||(!pad.mapping&&[1,2,3].some(pressed));
    const up=pressed(12),down=pressed(13);
    gamepadButtons=buttons;
    if(tutorialOpen()){
      if(lockHeld)clearLock();
      const vertical=Number(pad.axes&&pad.axes[1])||0,axis=vertical<-.65?-1:vertical>.65?1:0;
      if(up||down||(axis&&axis!==gamepadMenuAxis)){
        pauseMenuSelection=(down||axis>0)&&running?1:0;
        const node=$(pauseMenuSelection?'help-save-quit':'help-close');if(node&&typeof node.focus==='function')node.focus();
      }
      gamepadMenuAxis=axis;
      if(options)$('help-close').click();else if(confirm)$(pauseMenuSelection&&running?'help-save-quit':'help-close').click();
      return;
    }
    if(phase==='cinematics'){if(lockHeld)clearLock();if(confirm||options)skipIntro.click();return;}
    if(!running){
      if(lockHeld)clearLock();
      const vertical=Number(pad.axes&&pad.axes[1])||0,axis=vertical<-.65?-1:vertical>.65?1:0;
      if(up||down||(axis&&axis!==gamepadMenuAxis))selectGamepadMenu(gamepadMenuSelection+((down||axis>0)?1:-1));
      gamepadMenuAxis=axis;
      if(confirm||options){const target=titleMenuItems()[gamepadMenuSelection]||start;if(target)target.click();}
      return;
    }
    if(options){if(lockHeld)clearLock();pauseMenuSelection=0;gamepadMenuAxis=0;$('help-open').click();return;}
    if(buttons[6]){if(!lockHeld){lockHeld=true;nextLockCheck=0;updateLock(true);}}
    else if(lockHeld)clearLock();
    if(recenter)moveReticle(0,0);
    if(cross)interact();
    if(square)reload();
    if(trigger)fire();
    const deadzone=value=>{value=Number.isFinite(value)?Math.max(-1,Math.min(1,value)):0;const magnitude=Math.abs(value);return magnitude<=.18?0:Math.sign(value)*(magnitude-.18)/.82;};
    const axes=pad.axes||[];
    gamepadAxes={turn:deadzone(axes[0]),forward:-deadzone(axes[1]),lookX:deadzone(axes[2]),lookY:deadzone(axes[3])};
  }
  function updateEnemyMarkers(){
    if(!camera||!camera.eye)return;
    for(const e of enemies)e.marked=!!(e.alive&&segmentVisible(camera.eye,[e.x,e.y+1.3,e.z]));
  }
  function frame(time){const dt=Math.min((time-last)/1000||0,.05);last=time;pollGamepad();if(running&&!tutorialOpen())advance(dt);else if(tutorialOpen())keys.clear();if(running&&clock>=nextSaveAt){saveGame();nextSaveAt=clock+2;}if(running&&clock>=nextMarkerUpdate){updateEnemyMarkers();nextMarkerUpdate=clock+.2;}enemyShots=enemyShots.filter(shot=>clock<shot.until);for(const e of enemies)if(!e.alive)e.deathTime=Number.isFinite(e.deathAt)?Math.max(0,clock-e.deathAt):2;player.reloading=!!reloadUntil&&clock<reloadUntil;player.reloadTime=player.reloading?Math.max(0,1.1-(reloadUntil-clock)):0;player.aiming=lockHeld||(clock>=lastShot&&clock-lastShot<.5);if(renderer)camera=renderer.render({player,cameraYaw:yaw,cameraPitch:pitch,cameraImmediate,time:clock,enemies,enemyShots:running?enemyShots:[],objective:running&&!remaining()&&enemies.length?exitPoint:null,impact:running&&clock<impactUntil?impact:null});if(lockHeld)updateLock();cameraImmediate=false;requestAnimationFrame(frame);}
  function look(dx,dy){moveReticle(0,0);const current=cameraImmediate?yaw:(camera?.yaw??yaw);yaw=normAngle(current-dx*.003);player.angle=yaw;cameraImmediate=true;pitch=Math.max(-.55,Math.min(.65,pitch+dy*.002));}
  function showBriefing(){
    phase='briefing';cinematics.hidden=true;introVideo.pause();introVideo.removeAttribute('src');introVideo.load();
    overlay.hidden=false;overlay.classList.add('briefing');
    ui.title.innerHTML='BRIEFING DE<br><em>MISSION.</em>';
    const briefing=window.SF_BRIEFING;
    ui.text.classList.add('briefing-text');
    ui.text.textContent=briefing.directives.join('\n\n')+'\n\nOBJECTIFS DU DOSSIER :\n• '+briefing.objectives.join('\n• ')+'\n\nPARAMÈTRES :\n• '+briefing.parameters.join('\n• ');
    start.innerHTML='COMMENCER LA MISSION <span>→</span>';
    gamepadMenuSelection=0;
  }
  function playNextIntro(){
    if(phase!=='cinematics')return;
    const clips=['web/assets/intro-general.mp4','web/assets/intro-georgia.mp4'];
    if(introIndex>=clips.length){showBriefing();return;}
    introVideo.src=clips[introIndex++];
    try{const request=introVideo.play();if(request&&request.catch)request.catch(()=>{if(phase==='cinematics')showBriefing();});}
    catch(error){if(phase==='cinematics')showBriefing();}
  }
  function startMission(saved=null){
    phase='mission';overlay.classList.remove('briefing');ui.text.classList.remove('briefing-text');
    reset();if(saved)restoreGame(saved);if(!enemies.length){phase='briefing';ui.text.textContent='Impossible de placer les menaces dans cette zone.';return;}
    running=true;overlay.hidden=true;canvas.focus();sync();
    nextSaveAt=clock+2;if(window.SFAudio)window.SFAudio.startMusic();
    if(usingGamepad){setMessage('L2 CIBLER · R2 TIRER · OPTIONS MENU',5);return;}
    if(canvas.requestPointerLock){const p=canvas.requestPointerLock();if(p&&p.catch)p.catch(()=>{pointerError=true;fallbackPositionKnown=false;setMessage('DÉPLACEZ LA SOURIS SUR LE JEU POUR VISER',5);});}else{pointerError=true;fallbackPositionKnown=false;setMessage('DÉPLACEZ LA SOURIS SUR LE JEU POUR VISER',5);}
  }
  introVideo.addEventListener('ended',playNextIntro);
  introVideo.addEventListener('error',()=>{if(phase==='cinematics')playNextIntro();});
  skipIntro.addEventListener('click',()=>{if(phase==='cinematics')showBriefing();});
  start.addEventListener('click',event=>{
    if(event?.isTrusted)usingGamepad=false;
    if(!renderer)return;
    if(phase==='introduction'&&window.SF_BRIEFING){phase='cinematics';introIndex=0;overlay.hidden=true;cinematics.hidden=false;playNextIntro();return;}
    startMission();
  });
  if(continueGame&&continueGame.addEventListener)continueGame.addEventListener('click',()=>{const saved=window.SFSave&&window.SFSave.load();if(saved)startMission(saved);else refreshContinue();});
  const saveQuit=$('help-save-quit');if(saveQuit&&saveQuit.addEventListener)saveQuit.addEventListener('click',()=>{
    if(!saveGame()){const feedback=$('pause-feedback');if(feedback)feedback.textContent='SAUVEGARDE IMPOSSIBLE DANS CE NAVIGATEUR';return;}
    running=false;phase='introduction';clearLock();keys.clear();if(window.SFAudio)window.SFAudio.pauseMusic();$('help-close').click();
    overlay.classList.remove('briefing');overlay.hidden=false;if(window.SFAudio)window.SFAudio.pauseMusic();ui.title.innerHTML='GEORGIA<br><em>STREET.</em>';ui.text.textContent='Les terroristes sont dans le secteur. Neutralisez les menaces et rejoignez la zone d’extraction. Restez vigilant, agent.';
    start.innerHTML='<span class="title-start-label">NOUVELLE PARTIE</span><img class="title-start-sprite" src="web/assets/title-new.png" alt="" aria-hidden="true">';refreshContinue();selectGamepadMenu(0);sync();
  });
  document.addEventListener('keydown',e=>{if(window.SFAudio)window.SFAudio.unlock();usingGamepad=false;const k=e.key.toLowerCase();if(k==='escape'&&running){e.preventDefault();if(tutorialOpen())$('help-close').click();else $('help-open').click();return;}if(tutorialOpen())return;if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)&&running)e.preventDefault();if(!keys.has(k)){if(k==='r')reload();else if(k==='e')interact();else if(k===' ')fire();}keys.add(k);});document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>{keys.clear();drag=false;inputFocused=false;gamepadNeedsRelease=true;gamepadAxes={turn:0,forward:0,lookX:0,lookY:0};});window.addEventListener('focus',()=>{inputFocused=true;});window.addEventListener('pagehide',()=>saveGame());document.addEventListener('visibilitychange',()=>{if(document.hidden)saveGame();});document.addEventListener('pointerdown',()=>{if(window.SFAudio)window.SFAudio.unlock();});
  document.addEventListener('pointerlockchange',()=>{if(running&&!usingGamepad){if(document.pointerLockElement===canvas)setMessage('SOURIS ACTIVÉE · CLIQUEZ POUR TIRER',2);else setMessage('SOURIS LIBÉRÉE · CLIQUEZ POUR REPRENDRE LA VISÉE',4);}});
  document.addEventListener('mousemove',e=>{if(!running||tutorialOpen())return;if(document.pointerLockElement===canvas){pointerError=false;look(e.movementX,e.movementY);}else if(pointerError&&(e.target===canvas||drag)){if(fallbackPositionKnown)look(e.clientX-lastX,e.clientY-lastY);lastX=e.clientX;lastY=e.clientY;fallbackPositionKnown=true;}});
  canvas.addEventListener('mousedown',e=>{if(!running||tutorialOpen()||e.button!==0)return;usingGamepad=false;if(document.pointerLockElement!==canvas){drag=true;lastX=e.clientX;lastY=e.clientY;if(!pointerError&&canvas.requestPointerLock){const p=canvas.requestPointerLock();if(p&&p.catch)p.catch(()=>{pointerError=true;fallbackPositionKnown=false;setMessage('DÉPLACEZ LA SOURIS SUR LE JEU POUR VISER',5);});return;}}fire();});window.addEventListener('mouseup',()=>drag=false);canvas.addEventListener('contextmenu',e=>e.preventDefault());
  try{if(!window.SF_SCENE||!window.SFRenderer||!rules)throw new Error('Les ressources du jeu sont absentes.');const terrain=SF_SCENE.positions,props=window.SF_PROPS&&window.SF_PROPS.positions;
    collisionPositions=new Float32Array(terrain.length+(props?props.length:0));collisionPositions.set(terrain);if(props)collisionPositions.set(props,terrain.length);
    [groundGrid,wallGrid]=prepareCollision(collisionPositions);renderer=new SFRenderer(canvas,SF_SCENE);reset();refreshContinue();requestAnimationFrame(frame);}catch(error){ui.title.innerHTML='CHARGEMENT<br><em>IMPOSSIBLE.</em>';ui.text.textContent='Le navigateur ne peut pas lancer la scène 3D. Vérifiez que WebGL est disponible et que tous les fichiers du projet sont présents.';start.disabled=true;console.error(error);}
})();
