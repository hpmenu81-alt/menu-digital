const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const source=['common.js','promotions.js','servings.js'].map(f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8')).join('\n');
function run(code){return vm.runInNewContext(source+'\n'+code,{supabase:{createClient:()=>({})},URL});}
test('mixed hot/cold counts are required, validated and resized for bundles',()=>{
  assert.equal(run(`const item={id:'a',nama:'Teh (Dingin / Panas)',qty:2};item.servings=normalizeServings(item,{a:{hot:1,cold:1}});servingsComplete(item)`),true);
  for(const v of ['{hot:-1,cold:3}','{hot:0.5,cold:1.5}','{hot:2,cold:1}','{hot:NaN,cold:2}','{hot:0,cold:1}'])assert.equal(run(`servingsComplete({id:'a',nama:'Teh (Dingin / Panas)',qty:2,servings:{a:${v}}})`),false);
  assert.equal(run(`const item={is_bundle:true,qty:2,serving_parts:[{id:'a',nama:'Teh',quantity:3}]};item.servings=normalizeServings(item,{a:{hot:2,cold:4}});servingsComplete(item)`),true);
  assert.equal(run(`temperatureMenu({nama:'Teh Dingin'})`),false);
});
test('banner priority is deterministic and untrusted URLs are rejected',()=>{
  assert.equal(run(`orderedBanners([{id:'b',title:'B',banner_position:2},{id:'a',title:'A',banner_position:0}])[0].id`),'a');
  for(const url of ['javascript:alert(1)','http://a.test/x','https://user:pass@a.test/x'])assert.throws(()=>run(`promotionPayload({title:'Promo',kind:'discount',items:[{menu_id:'a',quantity:1}],discount_type:'percent',discount_value:10,banner_image_url:${JSON.stringify(url)}},[{id:'a',harga:100,aktif:true}])`));
});
