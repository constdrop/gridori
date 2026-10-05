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
    const thickness=f.wallThickness??140,steps=f.steps??(f.type==='turnStairs'?3:12),up=f.upDirection??'up';
    if(!Number.isFinite(thickness)||thickness<0||thickness>=Math.min(f.width,f.height)||
      !Number.isInteger(steps)||steps<1||steps>1000||!['up','down'].includes(up))throw Error('Invalid stairs');
    if(f.type==='turnStairs'&&!['left','right'].includes(f.turnDirection??'right'))throw Error('Invalid turn');
    const connections=f.type==='turnStairs'?['bottom',(f.turnDirection??'right')]:f.connections??(f.type==='stairs'?['top','bottom']:[]);
    if(!Array.isArray(connections)||connections.some(e=>!['top','bottom','left','right'].includes(e)))throw Error('Invalid connections');
    const inset=e=>connections.includes(e)?0:thickness/2;
    const width=f.width-inset('left')-inset('right'),height=f.height-inset('top')-inset('bottom');
    const notch=Math.min(thickness/2,width/2,height/2);
    const corners={tl:['top','left'],tr:['top','right'],br:['bottom','right'],bl:['bottom','left']};
    const notches=Object.fromEntries(Object.entries(corners).map(([key,edges])=>[key,edges.every(e=>connections.includes(e))?notch:0]));
    return {x:inset('left'),y:inset('top'),width,height,steps,up,connections,notches};
  }
  // Shared end treads are merged in world mm coordinates, including rotated stairs.
  function stairEndLines(fixtures){
    const groups=new Map(),epsilon=1e-6;
    for(const f of fixtures){
      if(!['stairs','turnStairs'].includes(f.type))continue;
      const s=stairs(f),a=(f.angle??0)*Math.PI/180,c=Math.cos(a),sn=Math.sin(a);
      const transform=(x,y)=>({x:f.x+f.width/2+(x-f.width/2)*c-(y-f.height/2)*sn,y:f.y+f.height/2+(x-f.width/2)*sn+(y-f.height/2)*c});
      for(const edge of (f.type==='turnStairs'?s.connections:['top','bottom'])){
        if(!s.connections.includes(edge))continue;
        const top=edge==='top',y=s.y+(top?0:s.height);
        let p=transform(s.x+s.notches[top?'tl':'bl'],y),q=transform(s.x+s.width-s.notches[top?'tr':'br'],y);
        if(edge==='left'||edge==='right'){
          const left=edge==='left',x=s.x+(left?0:s.width);
          p=transform(x,s.y+s.notches[left?'tl':'tr']);q=transform(x,s.y+s.height-s.notches[left?'bl':'br']);
        }
        const length=Math.hypot(q.x-p.x,q.y-p.y);if(length<epsilon)continue;
        let ux=(q.x-p.x)/length,uy=(q.y-p.y)/length;
        if(ux<-epsilon||(Math.abs(ux)<epsilon&&uy<0)){ux=-ux;uy=-uy}
        const normal=-uy*p.x+ux*p.y;
        const key=[ux,uy,normal].map(v=>Math.round(v/epsilon)).join(',');
        if(!groups.has(key))groups.set(key,{ux,uy,normal,intervals:[]});
        const values=[ux*p.x+uy*p.y,ux*q.x+uy*q.y].sort((a,b)=>a-b);
        groups.get(key).intervals.push(values);
      }
    }
    const result=[];
    for(const {ux,uy,normal,intervals} of groups.values()){
      intervals.sort((a,b)=>a[0]-b[0]);const merged=[];
      for(const range of intervals){const last=merged.at(-1);if(last&&range[0]<=last[1]+epsilon)last[1]=Math.max(last[1],range[1]);else merged.push([...range])}
      for(const [a,b] of merged)result.push({x1:ux*a-uy*normal,y1:uy*a+ux*normal,x2:ux*b-uy*normal,y2:uy*b+ux*normal});
    }
    return result;
  }
  function bath(f){
    const thickness=f.wallThickness??140;
    if(!Number.isFinite(f.width)||!Number.isFinite(f.height)||!Number.isFinite(thickness)||thickness<0||thickness>=Math.min(f.width,f.height))throw Error('Invalid bath size');
    const x=thickness/2,y=thickness/2,width=f.width-thickness,height=f.height-thickness;
    return {x,y,width,height,tub:{x,y,width,height:height*.45}};
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
      if(['stairs','landing','turnStairs'].includes(o.type))stairs(o);
      if(o.type==='bath')bath(o);
      return o;
    })};
  }
  const api={endpoints,body,snapWall,normalize,stairs,stairEndLines,bath};
  if(typeof module!=='undefined')module.exports=api;
  else root.WallModel=api;
})(globalThis);
