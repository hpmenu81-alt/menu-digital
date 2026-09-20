const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const rows=[{id:'a',nama:'Nasi',harga:25000,kategori:'FOOD',aktif:true},{id:'b',nama:'Teh',harga:10000,kategori:'MINUMAN',aktif:true}];
let promos=[];
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>r.abort());
 async function load(admin){
   await page.goto('about:blank');
   await page.setContent(fs.readFileSync(path.join(root,admin?'admin.html':'index.html'),'utf8').replace(/<script[\s\S]*?<\/script>/g,''));
   await page.addStyleTag({content:'.hidden,[hidden]{display:none!important}button{padding:10px}body{margin:0;padding-bottom:250px}img{max-width:80px}'});
   await page.addStyleTag({path:path.join(root,'promotions.css')});
   await page.evaluate(({rows,promos,admin})=>{
     window.mockRows=rows;window.mockPromos=promos;window.allowed=admin;window.failPromo=false;window.opened=[];window.alerts=[];
     window.confirm=()=>true;window.alert=t=>window.alerts.push(t);
     window.supabase={createClient:()=>({rpc:async name=>({data:name==="menu_server_time"?new Date().toISOString():window.allowed}),auth:{getSession:async()=>({data:{session:admin?{}:null}}),onAuthStateChange:()=>{}},from:table=>{
       let payload=null,insert=false,filters={};
       return {select(){return this},order(){return this},eq(k,v){filters[k]=v;return this},insert(p){payload=p;insert=true;return this},update(p){payload=p;return this},
       async range(){if(table==='menu_promotions'&&window.failPromo)return {error:{message:'Network error'}};return {data:table==='menu_rooms'?[{"code":"101","label":"101","active":true,"floor":"Lantai","position":0,"version":0},{"code":"102","label":"102","active":true,"floor":"Lantai","position":1,"version":0},{"code":"201","label":"201","active":true,"floor":"Lantai","position":2,"version":0}]:table==='menus'?window.mockRows.filter(m=>!filters.aktif||m.aktif):window.mockPromos.filter(p=>!filters.active||p.active)};},
       async single(){
         if(table==='menu_settings')return {data:{id:1,version:0,store_name:'Toko',whatsapp:'6281255763976',address:'Samarinda',opening_hours:'',information:'',category_order:[],menu_order:[]}};
         if(!window.allowed)return {error:{message:'Denied'}};
         if(insert){const data={...payload,id:'p'+(window.mockPromos.length+1),version:0};window.mockPromos.push(data);return {data};}
         const i=window.mockPromos.findIndex(p=>p.id===filters.id&&p.version===filters.version);
         if(i<0)return {error:{message:'Conflict'}};
         window.mockPromos[i]={...window.mockPromos[i],...payload};return {data:window.mockPromos[i]};
       }};
     }})};
   },{rows,promos,admin});
   for(const file of ['common.js','settings.js','promotions.js',...(admin?['rooms.js','admin-operations.js','admin-promotions.js','admin-settings.js','admin.js']:['rooms.js','servings.js','cart-storage.js','customer.js'])])await page.addScriptTag({path:path.join(root,file)});
   if(admin)await page.waitForFunction(()=>!document.getElementById('admin-content').hidden);
   else{await page.waitForFunction(()=>promotionsReady);await page.evaluate(()=>{openOrderWhatsApp=url=>window.opened.push(url);});}
 }
 await load(true);await page.locator('#tabPromotions').click();await page.waitForFunction(()=>!document.getElementById('promotion-save').disabled);
 await page.locator('#promotion-title').fill("Chef's <Promo>");await page.getByRole('checkbox',{name:'Pilih Nasi',exact:true}).check();
 await page.locator('#promotion-discount-value').fill('20');await page.locator('#promotion-active').check();await page.locator('#promotion-banner').check();
 await page.locator('#promotion-save').click();await page.waitForFunction(()=>window.mockPromos.length===1);
 assert.equal(await page.locator('#promotion-list h3').textContent(),"Chef's <Promo>");assert.equal(await page.locator('#promotion-list h3 img').count(),0);
 await page.locator('#tabList').click();await page.locator('#filterAdmin').selectOption('PROMO');await page.waitForFunction(()=>document.querySelectorAll('#list-menu article').length===1);
 assert.equal(await page.locator('#list-menu article .price-new').textContent(),'Rp 20.000');
 await page.locator('#list-menu article').getByRole('button',{name:'Edit',exact:true}).click();assert.equal(await page.locator('#harga').inputValue(),'25000');
 await page.locator('#tabPromotions').click();
 await page.locator('#promotion-new').click();await page.locator('#promotion-title').fill('Paket berdua');await page.locator('#promotion-kind').selectOption('bundle');
 await page.getByRole('checkbox',{name:'Pilih Nasi',exact:true}).check();await page.getByRole('spinbutton',{name:'Jumlah Nasi',exact:true}).fill('2');
 await page.getByRole('checkbox',{name:'Pilih Teh',exact:true}).check();await page.locator('#promotion-bundle-price').fill('45000');await page.locator('#promotion-active').check();await page.locator('#promotion-banner').check();
 await page.locator('#promotion-save').click();await page.waitForFunction(()=>window.mockPromos.length===2);promos=await page.evaluate(()=>window.mockPromos);
 // Stale edits and authorization cannot overwrite another version.
 await page.evaluate(()=>window.mockPromos[1].version++);await page.locator('#promotion-title').fill('Stale');await page.locator('#promotion-save').click();
 await page.waitForFunction(()=>document.getElementById('promotion-status').textContent.includes('admin lain'));assert.equal(await page.evaluate(()=>window.mockPromos[1].title),'Paket berdua');
 await page.evaluate(()=>window.allowed=false);await page.locator('#promotion-save').click();await page.waitForFunction(()=>document.getElementById('promotion-status').textContent.includes('Akses admin'));
 await load(false);
 assert.equal(await page.locator('#promotion-banners article').count(),2);assert.equal(await page.locator('#container-menu article').count(),3);
 assert.equal(await page.locator('#container-menu article').first().locator('del').textContent(),'Rp 25.000');
 assert.equal(await page.locator('#container-menu article').first().locator('.price-new').textContent(),'Rp 20.000');
 await page.getByRole('button',{name:'Lihat menu promo',exact:true}).click();assert.equal(await page.locator('#container-menu article').count(),1);
 await page.locator('#container-menu article').first().getByRole('button',{name:'+',exact:true}).click();assert.equal(await page.locator('#container-menu article').count(),1);
 await page.getByRole('button',{name:'Tambah paket +',exact:true}).click();await page.locator('#input-room-final').selectOption('101');
 await page.evaluate(()=>munculkanPopup());assert.equal(await page.locator('#harga-akhir').textContent(),'Rp 65.000');
 assert.match(await page.locator('#list-checkout').textContent(),/2× Nasi \+ 1× Teh/);
 await page.evaluate(()=>jalankanKirimWA());const message=decodeURIComponent(await page.evaluate(()=>window.opened[0]));assert.match(message,/TOTAL: Rp 65.000/);assert.match(message,/Isi per paket: 2× Nasi \+ 1× Teh/);
 // Revoked discount re-prices cart and asks customer to review before navigating.
 await page.evaluate(()=>{window.mockPromos[0].active=false;});await page.evaluate(()=>jalankanKirimWA());assert.equal(await page.evaluate(()=>window.opened.length),1);assert.equal(await page.locator('#harga-akhir').textContent(),'Rp 70.000');
 await page.evaluate(()=>{window.mockRows[1].aktif=false;});await page.evaluate(()=>jalankanKirimWA());assert.equal(await page.locator('#harga-akhir').textContent(),'Rp 25.000');
 await page.evaluate(()=>{window.failPromo=true;});await page.evaluate(()=>jalankanKirimWA());assert.equal(await page.evaluate(()=>window.opened.length),1);
 await page.evaluate(()=>ambilData());assert.equal(await page.locator('#btn-kirim-wa').isDisabled(),true);
 await load(false);await page.screenshot({path:path.join(root,'tests','promo-mobile.png'),fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
 assert.deepEqual(errors,[]);console.log('PASS: admin discount/bundle, safe text, conflicts, authorization, banners, cart, WhatsApp, repricing, unavailable menus, network failure, mobile layout.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
