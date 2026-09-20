const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function run(code){return vm.runInNewContext(['common.js','rooms.js','promotions.js'].map(f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8')).join('\n')+'\n'+code,{supabase:{createClient:()=>({})},URL});}
test('room payload normalizes codes and validates labels, position and QR destination',()=>{
 assert.equal(run(`roomPayload({code:'vip-1',label:'VIP',floor:'Lantai 1',position:1,active:true}).code`),'VIP-1');
 for(const code of ['../../x','X?room=other','a b',''])assert.throws(()=>run(`roomPayload({code:${JSON.stringify(code)},label:'Room',position:0})`));
 assert.throws(()=>run(`roomPayload({code:'101',label:' ',position:0})`));
 assert.throws(()=>run(`roomPayload({code:'101',label:'101',position:-1})`));
 assert.equal(run(`roomLink('VIP-1')`),'https://hpmenu81-alt.github.io/menu-digital/?room=VIP-1');
});
test('archived offers never discount and unavailable bundle ingredients block the bundle',()=>{
 assert.equal(run(`promotionRunning({active:true,archived:true})`),false);
 assert.equal(run(`buildOfferCatalog([{id:'a',nama:'Nasi',harga:100,aktif:true,tersedia:false}],[{id:'p',kind:'bundle',active:true,items:[{menu_id:'a',quantity:2}],bundle_price:150}]).length`),1);
 assert.equal(run(`buildOfferCatalog([{id:'a',nama:'Nasi',harga:100,aktif:true}],[{id:'p',kind:'discount',active:true,archived:true,items:[{menu_id:'a',quantity:1}],discount_type:'percent',discount_value:10}])[0].harga`),100);
});
