const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**/*',r=>r.abort());
 await page.route('http://menu.test/**',r=>{let file=path.basename(new URL(r.request().url()).pathname)||'index.html';if(!/^[\w.-]+$/.test(file))return r.abort();let body=fs.readFileSync(path.join(root,file));if(file.endsWith('.html'))body=body.toString().replace(/<script src="https:[\s\S]*?<\/script>/g,'').replace('</head>','<style>.hidden,[hidden]{display:none!important}body{padding-bottom:250px}img{max-width:80px}</style></head>');r.fulfill({body,contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/javascript'});});
 await page.addInitScript(()=>{
  window.mockRows=[{id:'a',nama:'Nasi',harga:25000,kategori:'FOOD',aktif:true},{id:'b',nama:'Teh (Dingin / Panas)',harga:10000,kategori:'MINUMAN',aktif:true}];window.mockPromos=[];window.fail=false;window.alert=()=>{};
  window.supabase={createClient:()=>({rpc:async()=>({data:new Date().toISOString()}),from:table=>({select(){return this},order(){return this},eq(){return this},async range(){return window.fail?{error:{message:'offline'}}:{data:table==='menus'?window.mockRows:window.mockPromos}},async single(){return {data:{id:1,version:0,store_name:'Toko',whatsapp:'6281255763976',address:'',opening_hours:'',information:'',category_order:[],menu_order:[]}}}})})};
 });
 async function ready(){await page.waitForFunction(()=>typeof promotionsReady!=='undefined'&&promotionsReady);}
 await page.goto('http://menu.test/index.html');await ready();
 await page.locator('#container-menu article').first().getByRole('button',{name:'+',exact:true}).click();await page.getByRole('button',{name:'Lihat Keranjang →',exact:true}).click();
 await page.getByRole('combobox',{name:'Room pesanan',exact:true}).selectOption('102');await page.getByRole('textbox',{name:'Catatan untuk Nasi'}).fill('Tanpa sambal');
 assert.equal(await page.locator('#input-room-final').inputValue(),'102');assert.equal(await page.locator('#btn-kirim-wa').isDisabled(),false);
 await page.addInitScript(()=>{window.mockRows[0].harga=30000;});await page.reload();await ready();
 assert.equal(await page.locator('#input-room-final').inputValue(),'102');await page.getByRole('button',{name:'Lihat Keranjang →',exact:true}).click();
 assert.equal(await page.locator('#harga-akhir').textContent(),'Rp 30.000');assert.equal(await page.getByRole('textbox',{name:'Catatan untuk Nasi'}).inputValue(),'Tanpa sambal');
 // An ended discount and a newly started offer update without page reload.
 await page.evaluate(()=>{customerPromotions=[{id:'p',active:true,banner:true,kind:'discount',title:'Diskon',items:[{menu_id:'a',quantity:1}],discount_type:'percent',discount_value:20,starts_at:new Date(Date.now()-1000).toISOString(),ends_at:new Date(Date.now()+60000).toISOString()}];refreshScheduledPrices();});
 assert.equal(await page.locator('#harga-akhir').textContent(),'Rp 24.000');
 await page.evaluate(()=>{customerPromotions[0].ends_at=new Date(Date.now()-1).toISOString();refreshScheduledPrices();});assert.equal(await page.locator('#harga-akhir').textContent(),'Rp 30.000');
 // Different room QR clears the prior room's cart.
 await page.goto('http://menu.test/index.html?room=201');await ready();assert.equal(await page.locator('#input-room-final').inputValue(),'201');assert.equal(await page.locator('#bar-keranjang').isVisible(),false);
 await page.evaluate(()=>{localStorage.setItem(CART_STORAGE_KEY,'broken');});await page.reload();await ready();assert.equal(await page.locator('#bar-keranjang').isVisible(),false);
 
 await page.getByRole('button',{name:'🎁 Paket',exact:true}).click();
 assert.match(await page.locator('#container-menu').textContent(),/Belum ada paket tersedia/);
 await page.getByRole('button',{name:'Lihat semua menu',exact:true}).click();
 await page.locator('#container-menu article').filter({hasText:'Teh (Dingin / Panas)'}).getByRole('button',{name:'+',exact:true}).click();
 await page.locator('#container-menu article').filter({hasText:'Teh (Dingin / Panas)'}).getByRole('button',{name:'+',exact:true}).click();
 await page.getByRole('button',{name:'Lihat Keranjang →',exact:true}).click();
 assert.equal(await page.locator('#btn-kirim-wa').isDisabled(),true);
 await page.getByRole('spinbutton',{name:/Jumlah panas/}).fill('1');
 await page.getByRole('spinbutton',{name:/Jumlah dingin/}).fill('1');
 assert.equal(await page.locator('#btn-kirim-wa').isDisabled(),false);
 await page.reload();await ready();await page.getByRole('button',{name:'Lihat Keranjang →',exact:true}).click();
 assert.equal(await page.getByRole('spinbutton',{name:/Jumlah panas/}).inputValue(),'1');
 assert.equal(await page.getByRole('spinbutton',{name:/Jumlah dingin/}).inputValue(),'1');
 await page.evaluate(()=>{window.sent=[];openOrderWhatsApp=url=>sent.push(url);});
 await page.locator('#btn-kirim-wa').click();await page.waitForFunction(()=>sent.length===1);
 assert.match(decodeURIComponent(await page.evaluate(()=>sent[0])),/1 panas, 1 dingin/);
 await page.getByRole('spinbutton',{name:/Jumlah panas/}).fill('-1');assert.equal(await page.locator('#btn-kirim-wa').isDisabled(),true);
 await page.getByRole('spinbutton',{name:/Jumlah panas/}).fill('1');
 await page.evaluate(()=>{hilangkanPopup();customerPromotions=[{id:'pack',title:'Paket Teh',active:true,banner:true,kind:'bundle',items:[{menu_id:'b',quantity:2}],bundle_price:15000,banner_position:0}];refreshScheduledPrices();});
 await page.getByRole('button',{name:'Tambah paket +',exact:true}).click();await page.getByRole('button',{name:'Lihat Keranjang →',exact:true}).click();
 const pack=page.locator('#list-checkout article').filter({has:page.getByRole('heading',{name:'Paket Teh',exact:true})});
 await pack.getByRole('spinbutton',{name:/Jumlah panas/}).fill('1');await pack.getByRole('spinbutton',{name:/Jumlah dingin/}).fill('1');
 assert.equal(await page.locator('#btn-kirim-wa').isDisabled(),false);
 await page.evaluate(()=>hilangkanPopup());
 for(const width of [320,390,768,1280]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 assert.deepEqual(errors,[]);console.log('PASS: room in checkout, notes/cart reload, current prices, automatic schedule changes, different-room QR, corrupt storage.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
