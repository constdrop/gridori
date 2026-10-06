const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const M=require('./model.js');
const wall=(extra={})=>({id:'w1',type:'wall',x:910,y:910,length:2730,angle:0,thickness:140,...extra});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('wall endpoints and physical extents in every cardinal direction',()=>{
  for(const [angle,x,y] of [[0,3640,910],[90,910,3640],[180,-1820,910],[270,910,-1820]]){
    const w=wall({angle}),end=M.endpoints(w)[1],body=M.body(w);
    near(end.x,x);near(end.y,y);
    assert.deepEqual(body,{x:-70,y:-70,width:2870,height:140});
  }
});
test('L join: moved end meets fixed start without changing length',()=>{
  const fixed=wall({id:'fixed',x:3640,y:910,angle:90});
  const moving=wall({x:950,y:950});
  const result=M.snapWall(moving,[fixed]);
  near(result.x,910);near(result.y,910);assert.equal(result.target.kind,'endpoint');
});
test('T join: either endpoint meets wall centerline, including off-grid walls',()=>{
  const fixed=wall({id:'fixed',y:1000});
  for(const moving of [wall({x:2000,y:1050,angle:90}),wall({x:2000,y:1050,angle:270})]){
    const result=M.snapWall(moving,[fixed]);near(result.y,1000);near(result.x,2000);
    assert.equal(result.target.kind,'segment');
  }
  const result=M.snapWall(wall({x:2000,y:-1700,angle:90}),[fixed]);
  near(M.endpoints({...wall({angle:90}),...result})[1].y,1000);
});
test('snap tolerance is mm; own wall ignored; fallback uses 455mm grid',()=>{
  const w=wall({x:1110,y:1120});
  assert.deepEqual(M.snapWall(w,[w]),{x:910,y:910,target:null});
  assert.equal(M.snapWall(w,[wall({id:'other',y:1400})]).target,null);
});
test('legacy imports, round trip, validation and duplicate IDs',()=>{
  const old={version:2,walls:[{id:'w9',type:'wall',x:910,y:910,width:2730,height:105,thickness:140}],fixtures:[]};
  const data=M.normalize(old);assert.equal(data.walls[0].length,2730);assert.equal(data.walls[0].angle,0);
  assert.equal(data.walls[0].width,undefined);
  assert.deepEqual(M.normalize(JSON.parse(JSON.stringify(data))),data);
  assert.throws(()=>M.normalize({...data,walls:[wall({length:0})]}));
  assert.throws(()=>M.normalize({...data,walls:[wall(),wall()]}));
  assert.equal(M.normalize({version:1,objects:[wall()]}).walls.length,1);
});
// Exercise the actual application renderer and handlers with a minimal DOM.
function app(){
  const nodes=new Map();
  function element(){return {children:[],attrs:{},dataset:{},style:{},classList:{add(){},remove(){}},
    setAttribute(k,v){this.attrs[k]=v},appendChild(n){this.children.push(n)},addEventListener(){},
    set innerHTML(v){this.children=[];this.html=v},get innerHTML(){return this.html}}}
  const document={getElementById(id){if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)},
    createElementNS:element,querySelectorAll(){return []},addEventListener(){}};
  const context=vm.createContext({document,WallModel:M,window:{addEventListener(){},removeEventListener(){}},alert(){}});
  const script=fs.readFileSync('index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInContext(script,context);
  return {run:code=>vm.runInContext(code,context),nodes};
}
test('doors inherit wall geometry, support both hinges and swing sides, and survive JSON round trip',()=>{
  const {run,nodes}=app();
  run('selected=data.walls[0];selected.thickness=200;selected.angle=90;addFixture("door")');
  assert.equal(run('selected.height'),200);
  let g=nodes.get('objects').children[2];
  assert.equal(g.attrs.transform,'translate(45.5,45.5) rotate(90)');
  assert.equal(g.children[0].attrs.y,-10);
  assert.equal(g.children[0].attrs.height,20);
  assert.equal(g.children[2].attrs.d,'M0 0V80');
  assert.equal(g.children[3].attrs.d,'M80 0A80 80 0 0 1 0 80');
  for(const [id,value] of Object.entries({pxx:'455',pyy:'455',pww:'800',phh:'200',pang:'90',plabel:'ドア',phanding:'right',pswing:'-1'})){
    nodes.set(id,{value});
  }
  run('applyProps()');g=nodes.get('objects').children[2];
  assert.equal(g.children[2].attrs.d,'M80 0V-80');
  assert.equal(g.children[3].attrs.d,'M0 0A80 80 0 0 1 80 -80');
  run('selected.swingSide=1;render()');
  assert.equal(nodes.get('objects').children[2].children[3].attrs.d,'M0 0A80 80 0 0 0 80 80');
  run('selected.handing="left";selected.swingSide=-1;render()');
  assert.equal(nodes.get('objects').children[2].children[3].attrs.d,'M80 0A80 80 0 0 0 0 -80');
  run('addFixture("slidingDoor")');
  g=nodes.get('objects').children[3];
  assert.equal(g.children[2].attrs.x,80);
  assert.equal(g.children[2].attrs.width,80);
  run('addFixture("doubleSlidingDoor")');
  g=nodes.get('objects').children[4];
  assert.equal(g.children.length,6);
  run('data=WallModel.normalize(JSON.parse(JSON.stringify(data)));render()');
  assert.equal(run('data.fixtures[0].swingSide'),-1);
  assert.equal(run('data.fixtures[0].handing'),'left');
  assert.equal(run('data.fixtures[1].type'),'slidingDoor');
  assert.equal(run('data.fixtures[2].type'),'doubleSlidingDoor');
});
test('sliding door settings cover both directions and wall sides through rotation and save/load',()=>{
  const {run,nodes}=app();
  run('addFixture("slidingDoor")');
  for(const direction of ['left','right'])for(const side of [-1,1]){
    for(const [id,value] of Object.entries({pxx:'910',pyy:'910',pww:'800',phh:'140',pang:'0',plabel:'引き戸',pslideDirection:direction,pslideSide:String(side)}))nodes.set(id,{value});
    run('applyProps()');
    for(const angle of [0,90,180,270]){
      if(angle)run('rotateSelected(90)');
      const g=nodes.get('objects').children[2];
      assert.equal(g.attrs.transform,`translate(91,91) rotate(${angle})`);
      assert.equal(g.children[2].attrs.x,direction==='left'?-80:80);
      assert.equal(g.children[2].attrs.y,side===1?7:-10);
      assert.ok(g.children[3].attrs.d.startsWith(direction==='left'?'M64 0H16':'M16 0H64'));
    }
    run('data=WallModel.normalize(JSON.parse(JSON.stringify(data)));selected=data.fixtures[0];render()');
    assert.equal(run('selected.slideDirection'),direction);
    assert.equal(run('selected.slideSide'),side);
  }
  run('delete selected.slideDirection;delete selected.slideSide;render()');
  const legacy=nodes.get('objects').children[2];
  assert.equal(legacy.children[2].attrs.x,80);
  assert.equal(legacy.children[2].attrs.y,-10);
});
test('folding doors retain equal leaf lengths for all directions, rotations and saved settings',()=>{
  const {run,nodes}=app();
  run('selected=data.walls[0];selected.thickness=200;selected.angle=90;addFixture("foldingDoor")');
  assert.equal(run('selected.height'),200);
  assert.equal(run('selected.angle'),90);
  assert.equal(run('selected.x'),455);
  assert.equal(run('selected.label'),'折戸');
  for(const direction of ['left','right'])for(const side of [-1,1]){
    for(const [id,value] of Object.entries({pxx:'455',pyy:'455',pww:'800',phh:'200',pang:'0',plabel:'折戸',pfoldDirection:direction,pfoldSide:String(side)}))nodes.set(id,{value});
    run('applyProps()');
    for(const angle of [0,90,180,270]){
      if(angle)run('rotateSelected(90)');
      const g=nodes.get('objects').children[2];
      assert.equal(g.attrs.transform,`translate(45.5,45.5) rotate(${angle})`);
      assert.equal(g.children[0].attrs.y,-10);
      const coords=g.children[2].attrs.d.match(/-?\d+(?:\.\d+)?/g).map(Number);
      const [x0,y0,x1,y1,x2,y2]=coords;
      near(Math.hypot(x1-x0,y1-y0),40);
      near(Math.hypot(x2-x1,y2-y1),40);
      assert.equal(x0,direction==='left'?0:80);
      assert.equal(Math.sign(y1),side);
      assert.ok(g.children[4].attrs.d.startsWith(direction==='left'?'M64 0H16':'M16 0H64'));
    }
    run('data=WallModel.normalize(JSON.parse(JSON.stringify(data)));selected=data.fixtures[0];render()');
    assert.equal(run('selected.foldDirection'),direction);
    assert.equal(run('selected.foldSide'),side);
    assert.equal(run('selected.centerline'),true);
  }
});
test('stairs reach grid at both ends, draw exact tread count and preserve direction through editing and import',()=>{
  const {run,nodes}=app();
  run('addFixture("stairs")');
  let g=nodes.get('objects').children[2];
  assert.equal(g.children[0].attrs.x,7);
  assert.equal(g.children[0].attrs.y,0);
  assert.equal(g.children[0].attrs.width,77);
  assert.equal(g.children[0].attrs.height,273);
  assert.equal(g.children.length,15); // fill + side edges + 11 internal lines + arrow strokes
  assert.equal(g.children[1].attrs.d,'M7 0V273 M84 0V273');
  const closed=M.stairs({type:'stairs',width:910,height:2730,connections:[]});
  assert.equal(closed.y,70);assert.equal(closed.height,2590);
  const arrow=g.children.at(-1).attrs.d;
  for(const [id,value] of Object.entries({pxx:'1365',pyy:'1365',pww:'910',phh:'2730',pang:'90',plabel:'階段',pstwall:'200',psteps:'16',pup:'down'}))nodes.set(id,{value});
  run('applyProps()');g=nodes.get('objects').children[2];
  assert.equal(g.children.length,18);
  assert.equal(g.children[0].attrs.x,10);
  assert.equal(g.children[0].attrs.width,71);
  assert.ok(g.attrs.transform.includes('rotate(90'));
  assert.notEqual(g.children.at(-1).attrs.d,arrow);
  const coords=g.children.at(-1).attrs.d.match(/-?\d+(?:\.\d+)?/g).map(Number);
  // The shaft uses M x y V y: V supplies only the end Y, not an X/Y pair.
  const [,startY,endY]=coords;
  // SVG Y increases downward; check local direction before the group rotation.
  assert.ok(endY>startY, 'Down arrow must end below its start in local coordinates');
  run('data=WallModel.normalize(JSON.parse(JSON.stringify(data)));selected=data.fixtures[0];render()');
  assert.equal(run('selected.steps'),16);
  assert.equal(run('selected.wallThickness'),200);
  assert.equal(run('selected.upDirection'),'down');
  nodes.set('psteps',{value:'2.5'});run('applyProps()');assert.equal(run('selected.steps'),16);
  assert.throws(()=>M.stairs({width:910,height:2730,wallThickness:910}));
  assert.throws(()=>M.stairs({width:910,height:2730,steps:0}));
  assert.equal(M.stairs({width:910,height:2730}).steps,12);
});
test('landing connects without inset gaps or edge strokes and survives rotation and import',()=>{
  const {run,nodes}=app();
  run('addFixture("landing")');
  let g=nodes.get('objects').children[2];
  assert.equal(g.children.length,1);
  assert.equal(g.children[0].attrs.width,77);
  for(const [id,value] of Object.entries({pxx:'910',pyy:'910',pww:'910',phh:'910',pang:'90',plabel:'踊り場',pstwall:'140'}))nodes.set(id,{value});
  nodes.set('pconnect-top',{checked:true});nodes.set('pconnect-right',{checked:true});
  run('applyProps()');g=nodes.get('objects').children[2];
  assert.ok(g.children[0].attrs.d.includes('L84 0 L84 7 L91 7'));
  assert.equal(g.children[0].attrs.stroke,'none');
  assert.equal(g.children[1].attrs.d,'M7 84H91 M7 0V84 M84 0 L84 7 L91 7');
  assert.ok(g.attrs.transform.includes('rotate(90'));
  run('data=WallModel.normalize(JSON.parse(JSON.stringify(data)));render()');
  assert.equal(run('data.fixtures[0].connections.join(",")'),'top,right');
  const flight=M.stairs({width:910,height:2730,connections:['bottom']});
  const landing=M.stairs({width:910,height:910,connections:['top']});
  near(flight.y+flight.height,2730+landing.y);
  near(flight.x,landing.x);near(flight.width,landing.width);
  assert.throws(()=>M.stairs({width:910,height:910,connections:['invalid']}));
});
test('adjacent connections notch only their shared corners; opposite edges remain uncut',()=>{
  const base={width:910,height:910,wallThickness:140};
  for(const [corner,connections] of Object.entries({tl:['top','left'],tr:['top','right'],br:['bottom','right'],bl:['bottom','left']})){
    const s=M.stairs({...base,connections});
    assert.equal(s.notches[corner],70);
    assert.equal(Object.values(s.notches).filter(n=>n>0).length,1);
  }
  for(const connections of [[],['top'],['top','bottom'],['left','right']]){
    assert.ok(Object.values(M.stairs({...base,connections}).notches).every(n=>n===0));
  }
  assert.ok(Object.values(M.stairs({...base,connections:['top','bottom','left','right']}).notches).every(n=>n===70));
  const {run,nodes}=app();
  run('addFixture("stairs");selected.connections=["top","left"];selected.steps=48;render()');
  const g=nodes.get('objects').children[2];
  assert.equal(g.children[2].attrs.x1,7); // first tread is trimmed clear of the notch
  assert.equal(g.children[2].attrs.x2,84);
});
test('end treads merge shared and partial spans, retain gaps and rotate with stairs',()=>{
  const f={type:'stairs',x:0,y:0,width:910,height:2730,angle:0};
  const lines=M.stairEndLines([f,{...f,y:2730}]);
  assert.equal(lines.length,3);
  assert.equal(lines.filter(l=>l.y1===2730).length,1);
  const partial=M.stairEndLines([{...f,connections:['top']},{...f,x:455,connections:['top']}]);
  assert.equal(partial.length,1);near(partial[0].x1,70);near(partial[0].x2,1295);
  assert.equal(M.stairEndLines([{...f,connections:['top']},{...f,x:1820,connections:['top']}]).length,2);
  const rotated=M.stairEndLines([{...f,angle:90},{...f,angle:90,x:-2730}]);
  assert.equal(rotated.length,3);
  for(const line of rotated)near(line.x1,line.x2);
  assert.equal(M.stairEndLines([f,{...f,type:'landing',y:2730}]).length,2);
  const cut=M.stairEndLines([{...f,connections:['top','left']}]);
  near(cut[0].x1,70);near(cut[0].x2,840);
  const {run,nodes}=app();run('addFixture("stairs")');
  const ends=nodes.get('objects').children.slice(-2);
  assert.equal(ends[0].attrs.y1,136.5);
  assert.equal(ends[1].attrs.y1,409.5);
  assert.equal(ends[0].style.pointerEvents,'none');
});
test('quarter-turn stairs mirror treads, clip inner corner, rotate, join and round-trip',()=>{
  const {run,nodes}=app();run('addFixture("turnStairs")');
  assert.equal(run('selected.steps'),3);
  for(const direction of ['right','left']){
    for(const [id,value] of Object.entries({pxx:'0',pyy:'0',pww:'910',phh:'910',pang:'0',plabel:'曲がり階段',pstwall:'140',psteps:'3',pturn:direction}))nodes.set(id,{value});
    run('applyProps()');
    const g=nodes.get('objects').children[2];
    assert.equal(g.children.length,6); // floor + edges + two treads + arrow halo/stroke
    const ray=g.children[2].attrs;
    near(ray.y1,91-7*Math.tan(Math.PI/6));
    near(ray.x1,direction==='right'?84:7);
    near(ray.x2,direction==='right'?7:84);
    assert.ok(g.children[5].attrs.d.includes(direction==='right'?' 0 0 1 ':' 0 0 0 '));
    for(const angle of [90,180,270]){
      run('rotateSelected(90)');
      assert.ok(nodes.get('objects').children[2].attrs.transform.includes(`rotate(${angle} `));
    }
    run('data=WallModel.normalize(JSON.parse(JSON.stringify(data)));selected=data.fixtures[0];render()');
    assert.equal(run('selected.turnDirection'),direction);
    assert.equal(run('selected.steps'),3);
  }
  const turn={type:'turnStairs',x:0,y:0,width:910,height:910,angle:0,turnDirection:'right'};
  const straight={type:'stairs',x:0,y:910,width:910,height:2730,angle:0};
  const lines=M.stairEndLines([turn,straight]);
  assert.equal(lines.length,3);
  const shared=lines.filter(l=>Math.abs(l.y1-910)<1e-6&&Math.abs(l.y2-910)<1e-6);
  assert.equal(shared.length,1);near(shared[0].x1,70);near(shared[0].x2,840);
  assert.throws(()=>M.stairs({...turn,turnDirection:'invalid'}));
});
test('bath is inset on all sides and its tub follows rotation, edits and JSON',()=>{
  const {run,nodes}=app();run('addFixture("bath")');
  let g=nodes.get('objects').children[2];
  assert.equal(g.children[0].attrs.x,7);assert.equal(g.children[0].attrs.y,7);
  assert.equal(g.children[0].attrs.width,168);assert.equal(g.children[0].attrs.height,168);
  assert.equal(g.children.length,3);
  for(const angle of [0,90,180,270]){
    if(angle)run('rotateSelected(90)');
    g=nodes.get('objects').children[2];
    assert.equal(g.attrs.transform,`translate(136.5,136.5) rotate(${angle} 91 91)`);
    const tub=g.children[1].attrs,dx=tub.x+tub.width/2-91,dy=tub.y+tub.height/2-91;
    const a=angle*Math.PI/180,tx=dx*Math.cos(a)-dy*Math.sin(a),ty=dx*Math.sin(a)+dy*Math.cos(a);
    if(angle===0)assert.ok(ty<0);if(angle===90)assert.ok(tx>0);
    if(angle===180)assert.ok(ty>0);if(angle===270)assert.ok(tx<0);
  }
  for(const [id,value] of Object.entries({pxx:'910',pyy:'910',pww:'1820',phh:'1365',pang:'90',plabel:'UB',pbathwall:'200'}))nodes.set(id,{value});
  run('applyProps()');assert.equal(run('selected.wallThickness'),200);
  const room=M.bath({width:1820,height:1365,wallThickness:200});
  assert.equal(room.width,1620);assert.equal(room.height,1165);
  assert.equal(room.tub.x,room.x);assert.equal(room.tub.y,room.y);
  assert.equal(room.tub.x+room.tub.width,room.x+room.width);
  assert.ok(room.tub.y+room.tub.height<room.y+room.height);
  run('data=WallModel.normalize(JSON.parse(JSON.stringify(data)));selected=data.fixtures[0];render()');
  assert.equal(run('selected.wallThickness'),200);assert.equal(run('selected.angle'),90);
  nodes.set('pbathwall',{value:'1365'});run('applyProps()');assert.equal(run('selected.wallThickness'),200);
  assert.throws(()=>M.bath({width:100,height:200,wallThickness:140}));
  assert.equal(M.bath({width:1820,height:1820}).x,70);
});
test('bathrooms render beneath doors regardless of creation or JSON order',()=>{
  for(const bathFirst of [true,false]){
    const {run,nodes}=app();
    run(bathFirst?'addFixture("bath");addFixture("door")':'addFixture("door");addFixture("bath")');
    const before=run('data.fixtures.map(f=>f.id).join(",")');
    run('data=WallModel.normalize(JSON.parse(JSON.stringify(data)));render()');
    assert.equal(nodes.get('objects').children[2].dataset.id,run('data.fixtures.find(f=>f.type==="bath").id'));
    assert.equal(nodes.get('objects').children[3].dataset.id,run('data.fixtures.find(f=>f.type==="door").id'));
    assert.equal(run('data.fixtures.map(f=>f.id).join(",")'),before);
  }
});
test('toilets rotate around a grid-cell center and preserve legacy positions',()=>{
  const {run,nodes}=app();run('addFixture("toilet")');
  assert.equal(run('selected.origin'),'center');assert.equal(run('selected.height'),650);
  for(const angle of [0,90,180,270]){
    if(angle)run('rotateSelected(90)');
    const g=nodes.get('objects').children[2];
    assert.equal(g.attrs.transform,`translate(136.5,136.5) rotate(${angle}) translate(-19,-32.5)`);
    assert.equal(g.children.length,4);
    assert.equal(g.children[2].attrs.y,0);
    assert.ok(g.children[0].attrs.cy>g.children[2].attrs.height);
    assert.deepEqual(M.snapToilet({origin:'center',width:380,height:650,x:1400,y:1300,angle}),{x:1365,y:1365});
  }
  run('data=WallModel.normalize(JSON.parse(JSON.stringify(data)));selected=data.fixtures[0];render()');
  assert.equal(run('selected.origin'),'center');assert.equal(run('selected.angle'),270);
  run('delete selected.origin;selected.width=650;selected.height=380;selected.x=910;selected.y=910;render()');
  assert.equal(nodes.get('objects').children[2].attrs.transform,'translate(123.5,110) rotate(270) translate(-32.5,-19)');
  assert.deepEqual(M.snapToilet({width:650,height:380,x:910,y:910}),{x:1040,y:1175});
});
test('washstand back snaps to wall faces in four orientations, without crossing wall ends',()=>{
  for(const angle of [0,90,180,270]){
    const a=angle*Math.PI/180,ux=Math.cos(a),uy=Math.sin(a),nx=-uy,ny=ux;
    const wall={id:'wall',type:'wall',x:0,y:0,length:2730,angle,thickness:200};
    const f={type:'wash',origin:'backCenter',x:ux*1365+nx*130,y:uy*1365+ny*130,width:750,height:910*2/3,angle};
    const snapped=M.snapWash(f,[wall]);
    near(snapped.x,ux*1365+nx*100);near(snapped.y,uy*1365+ny*100);
    assert.ok(snapped.target);
    assert.equal(M.snapWash(f,[{...wall,length:500}]).target,null);
  }
  const wall={id:'w',x:0,y:0,length:2730,angle:0,thickness:140};
  const f={origin:'backCenter',x:100,y:70,width:750,height:607,angle:0};
  assert.equal(M.snapWash(f,[wall]).target,null); // too far from a fully supported position
  assert.equal(M.snapWash({...f,x:300},[wall]).x,375);
  assert.equal(M.snapWash({...f,x:1000,angle:90},[wall]).target,null);
  const {run,nodes}=app();run('selected=data.walls[0];addFixture("wash")');
  near(run('selected.height'),910*2/3);
  assert.equal(run('selected.y'),525);
  for(const angle of [0,90,180,270]){
    if(angle)run('rotateSelected(90)');
    const g=nodes.get('objects').children[2];
    assert.equal(g.attrs.transform,`translate(227.5,52.5) rotate(${angle})`);
    assert.equal(g.children.length,6);
    assert.equal(g.children[1].attrs.y,0);
  }
  run('data=WallModel.normalize(JSON.parse(JSON.stringify(data)));selected=data.fixtures[0];render()');
  assert.equal(run('selected.origin'),'backCenter');assert.equal(run('selected.angle'),270);
  const legacy=M.washBack({x:100,y:200,width:750,height:600,angle:90});
  near(legacy.x,775);near(legacy.y,500);
});
test('kitchen modules form straight and mirrored L layouts, show equipment and round-trip',()=>{
  const {run,nodes}=app();
  run('addKitchen("sink");addKitchen("counter");addKitchen("stove");addKitchen("corner")');
  assert.equal(run('data.fixtures[1].x-data.fixtures[0].x'),750);
  assert.equal(run('data.fixtures[2].x-data.fixtures[1].x'),750);
  assert.equal(run('data.fixtures[3].x-data.fixtures[2].x'),675);
  const sink=nodes.get('objects').children[2],stove=nodes.get('objects').children[4];
  assert.equal(sink.children.length,5);assert.equal(stove.children.length,6);
  assert.equal(stove.children[3].attrs.fill,'#fff');
  run('addKitchen("counter",90)');
  assert.equal(run('selected.angle'),90);
  assert.equal(run('selected.x-data.fixtures[3].x'),300);
  assert.equal(run('selected.y-data.fixtures[3].y'),975);
  run('data=WallModel.normalize(JSON.parse(JSON.stringify(data)));render()');
  assert.equal(run('data.fixtures[0].kitchenKind'),'sink');
  assert.equal(run('data.fixtures[2].kitchenKind'),'stove');
  for(const angle of [0,90,180,270])for(const turn of [-90,90]){
    const prev={origin:'backCenter',x:0,y:0,width:650,height:650,angle};
    const next=M.nextKitchen(prev,{width:900,height:650},turn);
    const a=angle*Math.PI/180;
    near(next.x*Math.cos(a)+next.y*Math.sin(a),turn>0?325:-325);
    near(-next.x*Math.sin(a)+next.y*Math.cos(a)-450,650); // branch begins at corner front edge
    assert.equal(next.angle,(angle+turn+360)%360);
  }
  run('selected=data.fixtures[4]');
  for(const [id,value] of Object.entries({pxx:'0',pyy:'0',pww:'900',phh:'650',pang:'90',plabel:'キッチン',pkitchen:'sink'}))nodes.set(id,{value});
  run('applyProps()');assert.equal(run('selected.kitchenKind'),'sink');
  run('delete selected.kitchenKind;delete selected.origin;render()');
  assert.equal(nodes.get('objects').children[6].children.length,9); // legacy combined unit
});
test('kitchen branches extend away from either corner after rotation and JSON round trips',()=>{
  for(const angle of [0,90,180,270])for(const turn of [-90,90]){
    const {run}=app();
    run(`addKitchen('corner');rotateSelected(${angle});addKitchen('counter',${turn})`);
    // Reload before each further addition to verify growthDirection survives persistence.
    for(const kind of ['sink','stove']){
      run('data=WallModel.normalize(JSON.parse(JSON.stringify(data)));selected=data.fixtures.at(-1);render()');
      assert.equal(run('selected.growthDirection'),turn>0?1:-1);
      run(`addKitchen('${kind}')`);
    }
    const fixtures=JSON.parse(run('JSON.stringify(data.fixtures)'));
    const corner=fixtures[0],a=angle*Math.PI/180;
    // Compare actual footprints in the corner's frame, rather than just direction flags.
    function bounds(f){
      const back=M.washBack(f),r=f.angle*Math.PI/180;
      const points=[[-f.width/2,0],[f.width/2,0],[f.width/2,f.height],[-f.width/2,f.height]].map(([x,y])=>{
        const dx=back.x+x*Math.cos(r)-y*Math.sin(r)-corner.x;
        const dy=back.y+x*Math.sin(r)+y*Math.cos(r)-corner.y;
        return {x:dx*Math.cos(a)+dy*Math.sin(a),y:-dx*Math.sin(a)+dy*Math.cos(a)};
      });
      return {left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))};
    }
    let previous=bounds(corner);
    for(const f of fixtures.slice(1)){
      const current=bounds(f);
      near(current.left,-300);near(current.right,300);
      near(current.top,previous.bottom); // touches without a gap or overlap
      near(current.bottom-current.top,750);
      assert.equal(f.growthDirection,turn>0?1:-1);
      previous=current;
    }
    near(previous.bottom,2850); // 600mm corner + three 750mm modules
  }
});
test('kitchen straight additions retain legacy positive growth and use edited module widths',()=>{
  const previous={origin:'backCenter',x:100,y:200,width:600,height:600,angle:0};
  const positive=M.nextKitchen(previous,{width:800});
  near(positive.x,800);near(positive.y,200);assert.equal(positive.growthDirection,1);
  const negative=M.nextKitchen({...previous,growthDirection:-1},{width:800});
  near(negative.x,-600);near(negative.y,200);assert.equal(negative.growthDirection,-1);
});
test('kitchen dragging is free except normal-to-wall snaps, and corners snap both marked sides',()=>{
  const f={type:'kitchen',kitchenKind:'counter',origin:'backCenter',x:617.3,y:123.4,width:600,height:600,angle:0};
  assert.deepEqual(M.snapKitchen(f,[]),{x:617.3,y:123.4,target:null});
  const top={id:'top',x:-2000,y:0,length:4000,thickness:200,angle:0};
  const single=M.snapKitchen(f,[top]);near(single.x,617.3);near(single.y,100);
  assert.equal(M.snapKitchen({...f,y:500},[top]).y,500);
  for(const side of ['left','right'])for(const angle of [0,90,180,270]){
    const sign=side==='left'?-1:1,a=angle*Math.PI/180;
    const rot=(x,y)=>({x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)});
    const sideWall={id:'side',x:sign*1000,y:0,length:2000,thickness:200,angle:90};
    const walls=[top,sideWall].map(w=>({...w,...rot(w.x,w.y),angle:w.angle+angle}));
    const result=M.snapKitchen({...f,...rot(sign*617.3,123.4),angle,kitchenKind:'corner',cornerSide:side},walls);
    const expected=rot(sign*600,100);near(result.x,expected.x);near(result.y,expected.y);
  }
  const {run,nodes}=app();run('addKitchen("corner")');
  assert.equal(nodes.get('objects').children[2].children[2].attrs.d,'M-30 0H30V60');
  run('selected.cornerSide="left";render()');
  assert.equal(nodes.get('objects').children[2].children[2].attrs.d,'M30 0H-30V60');
  run('data=WallModel.normalize(JSON.parse(JSON.stringify(data)));render()');
  assert.equal(run('data.fixtures[0].cornerSide'),'left');
});
test('railing walls share wall geometry and editing, persist, and render below normal walls',()=>{
  assert.throws(()=>M.normalize({version:3,walls:[wall({wallKind:'invalid'})],fixtures:[]}),/Invalid wall kind/);
  for(const railingFirst of [true,false]){
    const {run,nodes}=app();
    run('data.walls=[]');
    run(railingFirst?'newWall("railing");newWall()':'newWall();newWall("railing")');
    run('selected=data.walls.find(w=>w.wallKind==="railing");rotateSelected(90);changeWallLength(455)');
    let g=nodes.get('objects').children[0];
    assert.equal(g.dataset.id,run('selected.id'));
    assert.equal(g.children[0].attrs.fill,'#777');
    assert.equal(g.children[0].attrs.x,-7);
    assert.equal(g.children[0].attrs.width,332.5);
    assert.equal(g.attrs.transform,'translate(91,91) rotate(90)');
    assert.equal(nodes.get('objects').children[1].children[0].attrs.fill,'#444');
    const before=run('data.walls.map(w=>w.id).join(",")');
    run('data=WallModel.normalize(JSON.parse(JSON.stringify(data)));selected=data.walls.find(w=>w.wallKind==="railing");render()');
    assert.equal(run('data.walls.map(w=>w.id).join(",")'),before);
    assert.equal(nodes.get('objects').children[0].dataset.id,run('selected.id'));
    for(const [id,value] of Object.entries({pxx:'910',pyy:'910',plen:'1000',pang:'180',pth:'100',pwallkind:'railing'}))nodes.set(id,{value});
    run('applyProps()');assert.equal(run('selected.wallKind'),'railing');assert.equal(run('selected.thickness'),100);
    nodes.set('pwallkind',{value:'normal'});run('applyProps()');assert.equal(run('selected.wallKind'),undefined);
  }
  const railing=wall({wallKind:'railing',x:950,y:950});
  const snapped=M.snapWall(railing,[wall({id:'other',x:3640,y:910,angle:90})]);
  near(snapped.x,910);near(snapped.y,910);
  const reverse=M.snapWall(wall({x:950,y:950}),[wall({id:'other',wallKind:'railing',x:3640,y:910,angle:90})]);
  near(reverse.x,910);near(reverse.y,910);
});
test('wall face dimensions account for thickness, reversed walls and rotations',()=>{
  for(const angle of [0,90,180,270,35]){
    const a=angle*Math.PI/180,n={x:-Math.sin(a),y:Math.cos(a)};
    const walls=[wall({id:'a',x:0,y:0,angle,thickness:140}),wall({id:'b',x:n.x*3640,y:n.y*3640,angle:angle+180,thickness:200})];
    const d={wallA:'a',wallB:'b',kind:'inner',offset:1000};
    near(M.dimension(d,walls).value,3470);
    near(M.dimension({...d,kind:'outer'},walls).value,3810);
    near(M.dimension({...d,wallA:'b',wallB:'a'},walls).value,3470);
    walls[1].angle+=30;assert.equal(M.dimension(d,walls),null);
  }
  assert.equal(M.dimension({wallA:'a',wallB:'b',kind:'inner',offset:0},[wall({id:'a'}),wall({id:'b'})]),null);
});
test('dimension UI persists annotations, follows edits, and removes dangling references',()=>{
  const {run,nodes}=app();
  assert.equal(nodes.get('objects').children[0].children.length,3); // body and endpoints, no length label
  run('selected=data.walls[0]');nodes.set('pdimwall',{value:'w2'});
  run('addDimension("inner");addDimension("outer")');
  assert.equal(run('data.dimensions.length'),2);
  assert.equal(nodes.get('objects').children.at(-2).children.at(-1).textContent,'内寸 3500 mm');
  assert.equal(nodes.get('objects').children.at(-1).children.at(-1).textContent,'外寸 3780 mm');
  run('editDimension(0,"-910");data.walls[1].y+=455;render()');
  assert.equal(run('data.dimensions[0].offset'),-910);
  assert.equal(nodes.get('objects').children.at(-2).children.at(-1).textContent,'内寸 3955 mm');
  run('data=WallModel.normalize(JSON.parse(JSON.stringify(data)));render()');
  assert.equal(run('data.dimensions.length'),2);assert.equal(run('data.dimensions[0].offset'),-910);
  run('data.walls[1].angle=90;render()');
  assert.ok(nodes.get('dimensions').innerHTML.includes('測定不可'));
  run('deleteDimension(0)');assert.equal(run('data.dimensions.length'),1);
  run('selected=data.walls[1];deleteSelected()');assert.equal(run('data.dimensions.length'),0);
  assert.throws(()=>M.normalize({version:3,walls:[wall()],fixtures:[],dimensions:[{wallA:'w1',wallB:'missing',kind:'inner',offset:0}]}));
});
test('window opening matches selected wall thickness and sash stays on centerline after rotation',()=>{
  const {run,nodes}=app();
  run('selected=data.walls[0];selected.thickness=200;selected.angle=90;addFixture("window")');
  assert.equal(run('selected.height'),200);
  assert.equal(run('selected.label'),'窓');
  let g=nodes.get('objects').children[2];
  assert.equal(g.attrs.transform,'translate(45.5,45.5) rotate(90)');
  assert.equal(g.children[0].attrs.y,-10);
  assert.equal(g.children[0].attrs.height,20);
  assert.equal(g.children[2].attrs.y,-3);
  assert.equal(g.children[3].attrs.y,0);
  run('selected=null;addFixture("fixedWindow")');
  assert.equal(run('selected.height'),140);
  assert.equal(run('selected.label'),'固定窓');
  g=nodes.get('objects').children[3];
  assert.equal(g.children[2].attrs.width,165);
  assert.equal(g.children[2].attrs.y,-1.5);
  assert.equal(g.children[3].attrs.d,'M0 0H165');
  run('data=WallModel.normalize(JSON.parse(JSON.stringify(data)));render()');
  assert.equal(run('data.fixtures[0].centerline'),true);
  assert.equal(run('data.fixtures[1].type'),'fixedWindow');
});
test('actual SVG renderer: creation, rotation, numeric length, L/T/cross joins and fixture editing',()=>{
  const {run,nodes}=app();
  run('newWall()');
  assert.equal(run('selected.length'),2730);
  let g=nodes.get('objects').children[2];
  assert.equal(g.children[0].attrs.width,287);assert.equal(g.children[0].attrs.x,-7);
  run('rotateSelected(90)');g=nodes.get('objects').children[2];
  assert.equal(g.attrs.transform,'translate(91,91) rotate(90)');
  run('changeWallLength(455)');assert.equal(run('selected.length'),3185);
  run('data.walls=[{id:"a",type:"wall",x:910,y:910,length:2730,angle:0,thickness:140},{id:"b",type:"wall",x:3640,y:910,length:2730,angle:90,thickness:140}];render()');
  assert.equal(nodes.get('objects').children[1].attrs.transform,'translate(364,91) rotate(90)');
  run('data.walls[1].x=1820;render()');
  assert.equal(nodes.get('objects').children[1].attrs.transform,'translate(182,91) rotate(90)');
  run('data.walls[1].y=0;render()');
  assert.equal(nodes.get('objects').children[1].attrs.transform,'translate(182,0) rotate(90)');
  run('addFixture("toilet");rotateSelected(90)');assert.equal(run('selected.width'),380);
  run('deleteSelected()');assert.equal(run('data.fixtures.length'),0);
  run('data.walls=[{id:"w99",type:"wall",x:0,y:0,length:1,angle:0,thickness:140}];uid=99;newWall()');
  assert.equal(run('selected.id'),'w100');
});
