import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const elements=new Map();
function get(id){if(!elements.has(id))elements.set(id,{hidden:true,textContent:'',addEventListener(){},querySelectorAll(){return [];}});return elements.get(id);}
let row, interval, access=false, displayed, fail=null, rpcCalls=0, authenticated=true;
const client={
  auth:{async getSession(){return {data:{session:authenticated?{}:null}};},onAuthStateChange(){}},
  from(table){return {select(){return {eq(){return table==='cards'?{async single(){return {data:structuredClone(row),error:null};}}:Promise.resolve({data:authenticated?[{card_id:'human'}]:[],error:null});}};}};},
  async rpc(name,args){
    rpcCalls++;
    if(fail){const code=fail;fail=null;return {error:{code}};}
    assert.equal(name,'save_card');
    if(args.p_revision!==row.revision)return {error:{code:'PT409'}};
    row={state:structuredClone(args.p_state),revision:row.revision+1};
    return {data:[structuredClone(row)]};
  }
};
const context={CARD_CLOUD_CONFIG:{url:'https://example.supabase.co',key:'public-test-key'},supabase:{createClient(){return client;}},document:{hidden:false,getElementById:get},window:{addEventListener(){}},setTimeout(){},setInterval(fn){interval=fn;return 1;},clearInterval(){}};
vm.createContext(context);
vm.runInContext(fs.readFileSync(new URL('card-state.js',import.meta.url),'utf8'),context);
vm.runInContext(fs.readFileSync(new URL('card-cloud.js',import.meta.url),'utf8'),context);
row={state:JSON.parse(JSON.stringify(context.CardState.initial('human'))),revision:1};
const connection=await context.CardCloud.start({id:'human',onState(s){displayed=s;},onStatus(){},onAccess(v){access=v;}});
assert.equal(displayed.coins,386);assert.equal(access,true);
await connection.save({...displayed,coins:380});assert.equal(row.state.coins,380);assert.equal(displayed.coins,380);
row={state:{...row.state,coins:400},revision:row.revision+1};
const count=rpcCalls;
await assert.rejects(connection.save({...displayed,coins:379}),/другом устройстве/);
assert.equal(rpcCalls,count+1);assert.equal(displayed.coins,400);assert.equal(row.state.coins,400);
row={state:{...row.state,coins:410},revision:row.revision+1};
interval();await new Promise(resolve=>setImmediate(resolve));assert.equal(displayed.coins,410);
fail='NETWORK';await assert.rejects(connection.save({...displayed,coins:409}),/не подтверждено/);assert.equal(row.state.coins,410);
get('armor-form').hidden=false;row={state:{...row.state,coins:415},revision:row.revision+1};
interval();await new Promise(resolve=>setImmediate(resolve));assert.equal(displayed.coins,410);
get('armor-form').hidden=true;
authenticated=false;
const viewer=await context.CardCloud.start({id:'human',onState(){},onStatus(){},onAccess(v){access=v;}});
assert.equal(access,false);await assert.rejects(viewer.save(row.state),/правом редактирования/);
console.log('OK: cloud load/save, conflict protection, polling, failed-save handling, form drafts and viewer lock.');
