import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const elements=new Map();
function get(id){if(!elements.has(id))elements.set(id,{hidden:true,textContent:'',addEventListener(){},querySelectorAll(){return [];}});return elements.get(id);}
let row, interval, access=false, displayed, fail=null, rpcCalls=0, authenticated=true, manager=false;
const client={
  auth:{async getSession(){return {data:{session:authenticated?{}:null}};},onAuthStateChange(){}},
  from(table){return {select(){return {eq(){return table==='cards'?{async single(){return {data:structuredClone(row),error:null};}}:Promise.resolve({data:authenticated?[{card_id:'human',can_manage_skills:manager}]:[],error:null});}};}};},
  async rpc(name,args){
    rpcCalls++;
    if(fail){const code=fail;fail=null;return {error:{code}};}
    assert.ok(['save_card','save_card_skills'].includes(name));
    if(args.p_revision!==row.revision)return {error:{code:'PT409'}};
    row=name==='save_card_skills'?{...row,skills:structuredClone(args.p_skills),revision:row.revision+1}:{...row,state:structuredClone(args.p_state),revision:row.revision+1};
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

authenticated=true;manager=false;
const player=await context.CardCloud.start({id:'human',onState(){},onStatus(){},onAccess(){}});
await assert.rejects(player.saveSkills([]),/только мастер/);
manager=true;let receivedSkills;
const gm=await context.CardCloud.start({id:'human',onState(){},onStatus(){},onAccess(){},onSkills(s){receivedSkills=s;}});
await gm.saveSkills([{name:'Навык',level:2,description:'Описание'}]);assert.equal(receivedSkills[0].name,'Навык');
vm.runInContext(fs.readFileSync(new URL('card-skills.js',import.meta.url),'utf8'),context);
const initial=context.CardSkills.initial('human');assert.equal(initial.length,3);
assert.throws(()=>context.CardSkills.add(initial,' уклонение ',1,''),/уже есть/);
assert.throws(()=>context.CardSkills.add(initial,'Тест',0,''),/Укажи/);
assert.throws(()=>context.CardSkills.add(initial,' ',1,''),/Укажи/);
const next=context.CardSkills.add(initial,'Новый',3,'Описание');assert.equal(next.length,4);assert.equal(initial.length,3);
console.log('OK: GM-only skills RPC, skill rendering callback, duplicates, invalid inputs and immutable add.');
