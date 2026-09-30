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
  run('addFixture("toilet");rotateSelected(90)');assert.equal(run('selected.width'),650);
  run('deleteSelected()');assert.equal(run('data.fixtures.length'),0);
  run('data.walls=[{id:"w99",type:"wall",x:0,y:0,length:1,angle:0,thickness:140}];uid=99;newWall()');
  assert.equal(run('selected.id'),'w100');
});
