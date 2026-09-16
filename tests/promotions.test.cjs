const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const rows=[{id:'a',nama:'Nasi',harga:25000,aktif:true},{id:'b',nama:'Teh',harga:10000,aktif:true}];
const promo={id:'p',title:'Promo',description:'',kind:'discount',items:[{menu_id:'a',quantity:1}],discount_type:'percent',discount_value:20,active:true,banner:true};
function run(code,data={}){const ctx=vm.createContext({supabase:{createClient:()=>({})},...data});for(const file of ['common.js','promotions.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx);return vm.runInContext(code,ctx);}
test('discount applies without changing base price and chooses best offer without stacking',()=>{
 const result=run('buildOfferCatalog(rows,promos)',{rows,promos:[promo,{...promo,id:'p2',discount_type:'amount',discount_value:6000}]});
 assert.equal(result[0].harga,19000);assert.equal(result[0].original_price,25000);assert.equal(rows[0].harga,25000);assert.equal(result[1].harga,10000);
});
test('inactive discounts and excessive nominal discount do not create free/negative products',()=>{
 for(const p of [{...promo,active:false},{...promo,discount_type:'amount',discount_value:25000}])assert.equal(run('buildOfferCatalog(rows,[p])[0].harga',{rows,p}),25000);
});
test('bundles have distinct IDs, explicit quantities, normal total and standalone price',()=>{
 const p={...promo,kind:'bundle',items:[{menu_id:'a',quantity:2},{menu_id:'b',quantity:1}],bundle_price:45000,discount_value:0};
 const result=run('buildOfferCatalog(rows,[p])',{rows,p});assert.equal(result[2].harga,45000);assert.equal(result[2].original_price,60000);assert.equal(result[2].id,'bundle:p');assert.equal(result[2].contents,'2× Nasi + 1× Teh');
 assert.equal(run('buildOfferCatalog(rows,[p]).length',{rows:[rows[0]],p}),1);
 assert.equal(run('buildOfferCatalog(rows,[p]).length',{rows:[rows[0],{...rows[1],aktif:false}],p}),2);
});
test('invalid discount values, missing items, duplicate items and inactive activation are rejected',()=>{
 for(const patch of [{discount_value:100},{discount_value:0},{discount_value:1.5},{items:[]},{items:[{menu_id:'x',quantity:1}]},{items:[{menu_id:'a',quantity:1},{menu_id:'a',quantity:1}]},{discount_type:'amount',discount_value:25000}])assert.throws(()=>run('promotionPayload(p,rows)',{p:{...promo,...patch},rows}));
 assert.throws(()=>run('promotionPayload(p,rows)',{p:promo,rows:[{...rows[0],aktif:false}]}));
});
test('bundle validates quantity and lower price; percent rounds to nearest rupiah',()=>{
 const p={...promo,kind:'bundle',bundle_price:24000};assert.equal(run('promotionPayload(p,rows).bundle_price',{rows,p}),24000);
 assert.throws(()=>run('promotionPayload(p,rows)',{rows,p:{...p,bundle_price:25000}}));
 assert.throws(()=>run('promotionPayload(p,rows)',{rows,p:{...p,items:[{menu_id:'a',quantity:0}]}}));
 assert.equal(run('discountPrice(10005,{discount_type:"percent",discount_value:10})'),9005);
});
