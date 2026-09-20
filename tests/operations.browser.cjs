const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict'),jsQR=require(process.env.JSQR_MODULE||'jsqr');
const root=path.join(__dirname,'..');
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**/*',r=>r.abort());
 await page.route('http://menu.test/**',r=>{const f=path.basename(new URL(r.request().url()).pathname)||'index.html';let body=fs.readFileSync(path.join(root,f));if(f.endsWith('.html'))body=body.toString().replace(/<script src="https:[\s\S]*?<\/script>/g,'').replace('</head>','<style>.hidden,[hidden]{display:none!important}body{margin:0;padding:12px;padding-bottom:250px}img{max-width:80px}*{box-sizing:border-box}</style></head>');r.fulfill({body,contentType:f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':'application/javascript'});});
 await page.addInitScript(()=>{
  window.allowed=location.pathname.includes('admin');window.alerts=[];window.alert=t=>alerts.push(t);window.confirm=()=>true;window.failRooms=false;
  window.mockRows=[{id:'a',nama:'Nasi',harga:25000,kategori:'FOOD',aktif:true,tersedia:true},{id:'b',nama:'Teh',harga:10000,kategori:'MINUMAN',aktif:true,tersedia:false},{id:'c',nama:'Rahasia',harga:5000,kategori:'FOOD',aktif:false,tersedia:true}];
  window.mockRooms=[{code:'101',label:'101',floor:'LANTAI 1',position:1,active:true,version:0},{code:'102',label:'102',floor:'LANTAI 1',position:2,active:true,version:0},{code:'201',label:'201',floor:'LANTAI 2',position:3,active:false,version:0}];
  window.mockPromos=[{id:'p',title:'Diskon Nasi',kind:'discount',items:[{menu_id:'a',quantity:1}],discount_type:'percent',discount_value:10,active:true,banner:true,archived:false,version:0},{id:'b',title:'Paket Teh',kind:'bundle',items:[{menu_id:'b',quantity:2}],bundle_price:15000,active:true,banner:true,archived:false,version:0}];
  window.mockHistory=Array.from({length:31},(_,i)=>({id:31-i,created_at:'2026-09-20T13:00:00Z',actor_label:'admin@example.test',entity:i?'menu_rooms':'menus',record_label:i?'Room 101':"Chef's <Menu>",operation:'UPDATE',changes:{harga:{before:20000,after:25000}}}));
  window.supabase={createClient:()=>({rpc:async name=>({data:name==='menu_server_time'?new Date().toISOString():allowed}),auth:{getSession:async()=>({data:{session:allowed?{}:null}}),onAuthStateChange:()=>{},signOut:async()=>({})},from:table=>{
    let filters={},payload=null,inserting=false,before=null;
    const source=()=>table==='menus'?mockRows:table==='menu_rooms'?mockRooms:table==='menu_promotions'?mockPromos:mockHistory;
    const selected=()=>source().filter(row=>Object.entries(filters).every(([k,v])=>row[k]===v)&&(!before||row.id<before));
    return {select(){return this},order(){return this},eq(k,v){filters[k]=v;return this},lt(k,v){before=v;return this},insert(v){payload=v;inserting=true;return this},update(v){payload=v;return this},
      async range(){if(table==='menu_rooms'&&failRooms)return {error:{message:'offline'}};return {data:structuredClone(selected())}},
      async limit(n){return {data:allowed?structuredClone(selected().slice(0,n)):[]}},
      async single(){
        if(table==='menu_settings')return {data:{id:1,version:0,store_name:'Toko',whatsapp:'6281255763976',category_order:[],menu_order:[]}};
        if(!allowed)return {error:{message:'Denied'}};
        const rows=source();if(inserting){if(rows.some(r=>r.code===payload.code))return {error:{message:'Duplicate'}};const row={...payload,version:0};rows.push(row);return {data:structuredClone(row)}};
        const row=selected()[0];if(!row)return {error:{message:'Conflict'}};Object.assign(row,payload);return {data:structuredClone(row)};
      }};
  }})};
 });
 await page.goto('http://menu.test/admin.html');await page.waitForFunction(()=>document.querySelectorAll('#dashboard-cards article').length===6);
 assert.match(await page.locator('#dashboard-cards').textContent(),/2Menu aktif1Siap dipesan1Habis sementara1Menu nonaktif2Promo berjalan2Room aktif/);
 await page.locator('#tabList').click();await page.waitForFunction(()=>document.querySelectorAll('#list-menu article').length===3);
 const nasi=page.locator('#list-menu article').filter({has:page.getByRole('heading',{name:'Nasi',exact:true})});
 await nasi.getByRole('button',{name:'Tandai habis',exact:true}).click();await page.waitForFunction(()=>mockRows[0].tersedia===false);
 await nasi.getByRole('button',{name:'Edit',exact:true}).click();assert.equal(await page.locator('#tersedia').isChecked(),false);
 await page.locator('#tabPromotions').click();await page.waitForFunction(()=>promotionLoaded);
 await page.locator('#promotion-list article').filter({hasText:'Diskon Nasi'}).getByRole('button',{name:'Arsipkan',exact:true}).click();await page.waitForFunction(()=>mockPromos[0].archived);
 assert.equal(await page.locator('#promotion-list').getByText('Diskon Nasi',{exact:true}).count(),0);
 await page.locator('#promotion-archive-filter').selectOption('archived');await page.getByRole('button',{name:'Pulihkan promo',exact:true}).click();await page.waitForFunction(()=>!mockPromos[0].archived);assert.equal(await page.evaluate(()=>mockPromos[0].active),false);
 await page.locator('#tabRooms').click();await page.waitForFunction(()=>roomsLoaded);
 await page.locator('#room-code').fill('401');await page.locator('#room-label').fill("VIP <1>");await page.locator('#room-floor').fill('LANTAI 4');await page.locator('#room-position').fill('40');await page.locator('#room-save').click();await page.waitForFunction(()=>mockRooms.length===4);
 assert.equal(await page.locator('#room-code').isDisabled(),true);
 const vip=page.locator('#room-list article').filter({hasText:'VIP <1>'});assert.equal(await vip.locator('h3 img').count(),0);
 await vip.getByRole('button',{name:'Lihat / unduh QR',exact:true}).click();
 const pixels=await page.locator('#room-qr canvas').evaluate(c=>({data:Array.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data),width:c.width,height:c.height}));
 assert.equal(jsQR(Uint8ClampedArray.from(pixels.data),pixels.width,pixels.height).data,'https://hpmenu81-alt.github.io/menu-digital/?room=401');
 assert.equal(await page.locator('#room-qr a').getAttribute('download'),'room-401.png');
 await page.evaluate(()=>mockRooms.find(r=>r.code==='401').version++);await page.locator('#room-label').fill('Stale');await page.locator('#room-save').click();await page.waitForFunction(()=>document.getElementById('room-status').textContent.includes('data berubah'));assert.equal(await page.evaluate(()=>mockRooms.find(r=>r.code==='401').label),'VIP <1>');
 await page.locator('#room-reload').click();await page.waitForFunction(()=>roomsLoaded&&!busy);await page.locator('#room-list article').filter({hasText:'401 — VIP <1>'}).getByRole('button',{name:'Nonaktifkan room',exact:true}).click();await page.waitForFunction(()=>!mockRooms.find(r=>r.code==='401').active);
 await page.locator('#tabHistory').click();await page.waitForFunction(()=>document.querySelectorAll('#history-list article').length===30);await page.locator('#history-more').click();await page.waitForFunction(()=>document.querySelectorAll('#history-list article').length===31);
 await page.locator('#history-filter').selectOption('menus');await page.waitForFunction(()=>document.querySelectorAll('#history-list article').length===1);assert.equal(await page.locator('#history-list h3').textContent(),"Mengubah Chef's <Menu>");
 await page.getByText('Lihat perubahan',{exact:true}).click();assert.match(await page.locator('#history-list').textContent(),/Rp 20.000 → Rp 25.000/);
 await page.locator('#tabRooms').click();await page.locator('#room-new').click();await page.locator('#room-code').fill('402');await page.locator('#room-label').fill('No access');await page.evaluate(()=>allowed=false);await page.locator('#room-save').click();await page.waitForFunction(()=>document.getElementById('room-status').textContent.includes('Akses admin'));assert.equal(await page.evaluate(()=>mockRooms.length),4);
 await page.goto('http://menu.test/index.html?room=201');await page.waitForFunction(()=>promotionsReady);
 assert.equal(await page.locator('#input-room-final').inputValue(),'');assert.match(await page.locator('#cart-notice').textContent(),/tidak aktif/);
 assert.equal(await page.locator('#container-menu article').count(),2);const tea=page.locator('#container-menu article').filter({hasText:'Teh'});assert.match(await tea.textContent(),/Habis sementara/);assert.equal(await tea.getByRole('button',{name:'+',exact:true}).count(),0);
 await page.locator('#input-room-final').selectOption('101');await page.locator('#container-menu article').filter({hasText:'Nasi'}).getByRole('button',{name:'+',exact:true}).click();await page.getByRole('button',{name:'Lihat Keranjang →',exact:true}).click();
 await page.evaluate(()=>{window.sent=[];openOrderWhatsApp=url=>sent.push(url);mockRooms[0].active=false;});await page.locator('#btn-kirim-wa').click();await page.waitForFunction(()=>alerts.length>0);assert.equal(await page.evaluate(()=>sent.length),0);assert.equal(await page.locator('#checkout-room').inputValue(),'');
 await page.locator('#checkout-room').selectOption('102');await page.evaluate(()=>mockRows[0].tersedia=false);await page.locator('#btn-kirim-wa').click();await page.waitForFunction(()=>cart.size===0);assert.equal(await page.evaluate(()=>sent.length),0);
 await page.evaluate(()=>{mockRooms[1].active=false;});await page.reload();await page.waitForFunction(()=>promotionsReady);assert.equal(await page.locator('#bar-keranjang').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('PASS dashboard, sold out, archive/restore, room CRUD/conflict/auth, QR decode, audit filter/pagination, disabled QR room, checkout revalidation.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
