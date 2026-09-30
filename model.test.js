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
  const script=fs.readFileSync('floorplan_910mm_prototype.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInContext(script,context);
  return {run:code=>vm.runInContext(code,context),nodes};
}
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
