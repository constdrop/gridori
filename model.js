// All geometry, including snap tolerance, is in millimetres.
(function(root){
  const direction=w=>{const a=w.angle*Math.PI/180;return {x:Math.cos(a),y:Math.sin(a)}};
  function endpoints(w){const u=direction(w);return [{x:w.x,y:w.y},{x:w.x+w.length*u.x,y:w.y+w.length*u.y}]}
  function body(w){return {x:-w.thickness/2,y:-w.thickness/2,width:w.length+w.thickness,height:w.thickness}}
  function snapWall(w,walls,tolerance=182){
    let best=null;
    const ends=endpoints(w);
    function consider(p,q,kind){
      const distance=Math.hypot(q.x-p.x,q.y-p.y);
      // Endpoint priority makes L joins reachable near the ends of a segment.
      if(distance<=tolerance && (!best || (kind==='endpoint' && best.kind==='segment') ||
        (kind===best.kind && distance<best.distance)))
        best={x:q.x,y:q.y,dx:q.x-p.x,dy:q.y-p.y,distance,kind};
    }
    for(const other of walls){
      if(other.id===w.id)continue;
      const [a,b]=endpoints(other),vx=b.x-a.x,vy=b.y-a.y;
      for(const p of ends){
        consider(p,a,'endpoint');consider(p,b,'endpoint');
        const t=((p.x-a.x)*vx+(p.y-a.y)*vy)/(vx*vx+vy*vy);
        if(t>0 && t<1)consider(p,{x:a.x+t*vx,y:a.y+t*vy},'segment');
      }
    }
    return best?{x:w.x+best.dx,y:w.y+best.dy,target:best}:
      {x:Math.round(w.x/455)*455,y:Math.round(w.y/455)*455,target:null};
  }
  function stairs(f){
    const thickness=f.wallThickness??140,steps=f.steps??12,up=f.upDirection??'up';
    if(!Number.isFinite(thickness)||thickness<0||thickness>=Math.min(f.width,f.height)||
      !Number.isInteger(steps)||steps<1||steps>1000||!['up','down'].includes(up))throw Error('Invalid stairs');
    return {x:thickness/2,y:thickness/2,width:f.width-thickness,height:f.height-thickness,steps,up};
  }
  function normalize(input){
    if(!input || ![1,2,3].includes(input.version))throw Error('Unsupported version');
    const walls=input.walls??input.objects?.filter(o=>o.type==='wall');
    const fixtures=input.fixtures??input.objects?.filter(o=>o.type!=='wall');
    if(!Array.isArray(walls)||!Array.isArray(fixtures))throw Error('Invalid objects');
    const ids=new Set();
    function check(o,fields){
      if(typeof o.id!=='string'||!o.id||ids.has(o.id))throw Error('Invalid id');
      ids.add(o.id);
      for(const k of fields)if(!Number.isFinite(o[k]))throw Error('Invalid '+k);
      return o;
    }
    return {version:3,units:'mm',grid:{major:910,minor:455},walls:walls.map(w=>{
      // Legacy width is the nominal length; x/y already denoted the reference point.
      const o=check({id:w.id,type:'wall',x:w.x,y:w.y,length:w.length??w.width,angle:w.angle??0,thickness:w.thickness??140},['x','y','length','angle','thickness']);
      if(o.length<=0||o.thickness<=0)throw Error('Invalid wall size');
      return o;
    }),fixtures:fixtures.map(f=>{
      const o=check({...f,angle:f.angle??0},['x','y','width','height','angle']);
      if(o.width<=0||o.height<=0||typeof o.type!=='string'||o.type==='wall')throw Error('Invalid fixture');
      if(o.type==='stairs')stairs(o);
      return o;
    })};
  }
  const api={endpoints,body,snapWall,normalize,stairs};
  if(typeof module!=='undefined')module.exports=api;
  else root.WallModel=api;
})(globalThis);
