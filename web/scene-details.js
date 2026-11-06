/* Georgia Street visual-only details. Original PS1 geometry remains the
 * authoritative source for collisions, layout, and the police vehicle. */
(function (global) {
  'use strict';
  const RED=[.95,.09,.07],BLUE=[.08,.22,.98],DIM_RED=[.31,.045,.035],DIM_BLUE=[.035,.065,.32];
  const SILVER=[.49,.51,.53],PAPER=[.44,.43,.38],ROAD=[.075,.075,.07],BRASS=[.42,.34,.20],LAMP=[.94,.72,.31];
  function box(renderer,item,color){renderer.box(item[0],item[1],item[2],item[3],item[4],item[5],item[6],color);}
  function bounds(props,o){
    if(!o||o.start<0||o.count<=0||(o.start+o.count)*3>props.positions.length)return null;
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    for(let i=o.start*3;i<(o.start+o.count)*3;i++){
      const n=i%3,v=props.positions[i];if(!Number.isFinite(v))return null;
      min[n]=Math.min(min[n],v);max[n]=Math.max(max[n],v);
    }
    return {min,max};
  }
  function make(props){
    if(!props||!props.positions||!Array.isArray(props.objects))return null;
    const roof=props.objects.find(o=>o.name==='LIGHT'&&o.id===139);
    const vehicle=props.objects.find(o=>o.name==='CP'&&o.id===57);
    const roofBounds=bounds(props,roof);
    if(!roofBounds||!vehicle)return null;
    const {min,max}=roofBounds;
    const x=(min[0]+max[0])/2,z=(min[2]+max[2])/2,y=max[1]+.03;
    // The asset is diagonal; positions below follow its roof lightbar.
    const angle=-.473,px=-.456,pz=.89;
    const entrance=[];
    for(const obj of props.objects.filter(o=>o.name==='BDOOR'&&Array.isArray(o.rooms)&&o.rooms.includes(67))){
      const b=bounds(props,obj);if(!b)continue;
      const bx=b.max[0]+.012,midY=(b.min[1]+b.max[1])/2,height=b.max[1]-b.min[1];
      entrance.push([bx,midY,b.min[2],0,.025,height,.045],
        [bx,midY,b.max[2],0,.025,height,.045],
        [bx,b.max[1],(b.min[2]+b.max[2])/2,0,.025,.06,b.max[2]-b.min[2]],
        [bx,b.max[1]+.17,(b.min[2]+b.max[2])/2,0,.05,.08,.3]);
    }
    return {
      room:74,
      entranceRoom:67,entrance,
      left:[x-px*.31,y,z-pz*.31,angle,.29,.07,.35],
      right:[x+px*.31,y,z+pz*.31,angle,.29,.07,.35],
      bridge:[x,y+.005,z,angle,.32,.065,.055],
      // Small, flat pieces and tyre traces do not create fake obstacles.
      marks:[
        [39.3,21.337,25.8,-.47,.05,.008,1.18],
        [39.0,21.337,27.0,-.47,.05,.008,.82],
        [37.95,21.338,30.98,.1,.12,.01,.19],
        [40.13,21.338,29.93,.5,.09,.01,.15],
        [31.1,21.338,26.15,-.3,.12,.01,.08]
      ]
    };
  }
  function draw(renderer,details,time){
    if(!details||!renderer||typeof renderer.box!=='function')return;
    if(!renderer.visibleRooms||renderer.visibleRooms.has(details.room)){
      const phase=Math.floor(Math.max(0,Number.isFinite(time)?time:0)*2)%2;
      box(renderer,details.left,phase?DIM_RED:RED);box(renderer,details.right,phase?BLUE:DIM_BLUE);
      box(renderer,details.bridge,SILVER);
      details.marks.forEach((item,i)=>box(renderer,item,i<2?ROAD:PAPER));
    }
    if(!renderer.visibleRooms||renderer.visibleRooms.has(details.entranceRoom))
      details.entrance.forEach((item,i)=>box(renderer,item,i%4===3?LAMP:BRASS));
  }
  global.SFSceneDetails={make,draw};
})(window);
