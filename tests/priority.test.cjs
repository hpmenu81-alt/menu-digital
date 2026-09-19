const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function run(file,code,vars={}){const ctx=vm.createContext(vars);vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx);return vm.runInContext(code,ctx);}
test('saved cart rejects corrupt, stale and future snapshots; ignores invalid quantities and duplicates',()=>{
 const snapshot={version:1,savedAt:1000,room:'101',items:[{id:'a',qty:2,catatan:'tanpa gula'},{id:'a',qty:3},{id:'b',qty:0},{id:'c',qty:100},{id:'d',qty:1,catatan:'x'.repeat(400)}]};
 const result=run('cart-storage.js','parseSavedCart(raw,2000)',{raw:JSON.stringify(snapshot)});
 assert.equal(result.items.length,2);assert.equal(result.items[0].qty,2);assert.equal(result.items[1].catatan.length,300);
 for(const raw of ['broken','null',JSON.stringify({...snapshot,savedAt:-50000000}),JSON.stringify({...snapshot,savedAt:100000})])assert.equal(run('cart-storage.js','parseSavedCart(raw,2000)',{raw}),null);
});
test('saved cart stores IDs quantities notes only, never trusts stored prices',()=>{
 let stored;const localStorage={setItem:(k,v)=>stored=v};
 assert.equal(run('cart-storage.js','writeSavedCart("101",[{id:"a",qty:1,catatan:"hi",harga:1}])',{localStorage}),true);
 assert.equal(Object.hasOwn(JSON.parse(stored).items[0],'harga'),false);
 assert.equal(run('cart-storage.js','writeSavedCart("101",[])',{localStorage:{setItem(){throw Error('blocked')}}}),false);
});
test('schedule boundaries start inclusive and end exclusive; WITA conversion independent of device timezone',()=>{
 const p={active:true,starts_at:'2026-09-18T04:00:00Z',ends_at:'2026-09-18T06:00:00Z'};
 for(const [now,expected] of [['2026-09-18T03:59:59Z','Terjadwal'],['2026-09-18T04:00:00Z','Berjalan'],['2026-09-18T06:00:00Z','Berakhir']])assert.equal(run('promotions.js','promotionStatus(p,Date.parse(now))',{p,now}),expected);
 assert.equal(run('promotions.js','fromWitaInput("2026-09-18T12:00")'),'2026-09-18T04:00:00.000Z');
 assert.equal(run('promotions.js','toWitaInput("2026-09-18T04:00:00Z")'),'2026-09-18T12:00');
 assert.throws(()=>run('promotions.js','fromWitaInput("2026-02-30T12:00")'));
});
