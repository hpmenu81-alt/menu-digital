// Optional: npm install --no-save playwright, then node tests/settings.browser.cjs.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.join(__dirname,"..");
const rows=[
 {id:"a",nama:"Nasi",kategori:"FOOD",harga:25000,aktif:true},
 {id:"b",nama:"Ayam",kategori:"FOOD",harga:30000,aktif:true},
 {id:"c",nama:"Teh",kategori:"MINUMAN",harga:10000,aktif:true}
];
let saved={id:1,version:0,store_name:"Happy Puppy Panjaitan",whatsapp:"6281255763976",address:"Samarinda",opening_hours:"",information:"",category_order:[],menu_order:[]};
(async()=>{
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || "msedge",headless:true});
 try {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 await page.route("https://**/*",route=>route.abort());
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 async function load(admin,fail=false) {
   await page.goto("about:blank");
   const html=fs.readFileSync(path.join(root,admin?"admin.html":"index.html"),"utf8");
   await page.setContent(html.replace(/<script[\s\S]*?<\/script>/g,""));
   await page.addStyleTag({content:".hidden,[hidden]{display:none!important} img{max-width:80px} body{padding-bottom:250px}"});
   await page.evaluate(({rows,saved,admin,fail})=>{
     window.mockRows=rows; window.mockStore=saved;window.allowed=admin;window.failSettings=fail;window.opened=[];window.writes=0;
     window.open=url=>window.opened.push(url);
     window.confirm=()=>true;
     window.supabase={createClient:()=>({
       rpc:async()=>({data:window.allowed}),
       auth:{onAuthStateChange:()=>{},getSession:async()=>({data:{session:admin?{}:null}}),signOut:async()=>({})},
       from:table=>{
         let update=null,version;
         return {select(){return this},order(){return this},eq(key,value){if(key==="version")version=value;return this},
           update(payload){update=payload;return this},
           async range(){return {data:table==="menu_promotions"?[]:window.mockRows}},
           async single(){
             if(table!=="menu_settings")return {data:{id:"a"}};
             if(window.failSettings)return {error:{message:"Unavailable"}};
             if(update) {
               if(!window.allowed||version!==window.mockStore.version)return {error:{message:"Denied or conflict"}};
               window.writes++;window.mockStore={...window.mockStore,...update};
             }
             return {data:{...window.mockStore}};
           }
         };
       }
     })};
   },{rows,saved,admin,fail});
   for(const file of ["common.js","settings.js","promotions.js",...(admin?["admin-promotions.js","admin-settings.js","admin.js"]:["customer.js"])]) await page.addScriptTag({path:path.join(root,file)});
   if(!admin)await page.evaluate(()=>{openOrderWhatsApp=url=>window.opened.push(url);});
   if(admin)await page.waitForFunction(()=>document.getElementById("admin-content").hidden===false);
   else await page.waitForFunction(()=>document.querySelectorAll("#container-menu article").length===3);
 }
 await load(true);
 await page.locator("#tabSettings").click();
 await page.waitForFunction(()=>!document.getElementById("settings-save").disabled);
 await page.locator("#setting-store_name").fill("Chef's <Store>");
 await page.locator("#setting-whatsapp").fill("0812-9999-8888");
 await page.locator("#setting-address").fill("<img src=x onerror=alert(1)>");
 await page.locator("#setting-opening_hours").fill("Setiap hari 12.00–02.00 WITA");
 await page.locator("#setting-information").fill("Silakan konfirmasi ke staf.");
 await page.getByRole("button",{name:"Naikkan MINUMAN",exact:true}).click();
 await page.locator("#order-category").selectOption("FOOD");
 await page.getByRole("button",{name:"Naikkan Ayam",exact:true}).click();
 await page.locator("#settings-save").click();
 await page.waitForFunction(()=>window.writes===1);
 saved=await page.evaluate(()=>window.mockStore);
 assert.equal(saved.whatsapp,"6281299998888");
 assert.deepEqual(saved.category_order,["MINUMAN","FOOD"]);
 assert.deepEqual(saved.menu_order,["b","a","c"]);
 await page.evaluate(()=>{window.mockStore.version++;});
 await page.locator("#setting-store_name").fill("Conflict");
 await page.locator("#settings-save").click();
 await page.waitForFunction(()=>document.getElementById("settings-status").textContent.includes("admin lain"));
 assert.equal(await page.evaluate(()=>window.writes),1);
 await page.evaluate(()=>{window.allowed=false;});
 await page.locator("#settings-save").click();
 await page.waitForFunction(()=>document.getElementById("settings-status").textContent.includes("Akses admin"));
 assert.equal(await page.evaluate(()=>window.writes),1);
 await load(false);
 assert.deepEqual(await page.locator("#container-menu h3").allTextContents(),["Teh","Ayam","Nasi"]);
 assert.deepEqual(await page.locator("#tabs-kategori button").allTextContents(),["SEMUA","MINUMAN","FOOD"]);
 assert.equal(await page.locator("#store-address").textContent(),"<img src=x onerror=alert(1)>");
 assert.equal(await page.locator("#store-address img").count(),0);
 assert.equal(await page.locator("[data-store-name]").first().textContent(),"Chef's <Store>");
 await page.locator("#input-room-final").selectOption("101");
 await page.locator("#container-menu button").filter({hasText:/^\+$/}).first().dispatchEvent("click");
 await page.evaluate(()=>jalankanKirimWA());
 await page.evaluate(()=>kirimBantuan("Minta Bill"));
 const urls=await page.evaluate(()=>window.opened);
 assert.equal(urls.length,2);assert(urls.every(url=>url.startsWith("https://wa.me/6281299998888?")));
 await load(false,true);
 assert.equal(await page.locator("#btn-kirim-wa").isDisabled(),true);
 await page.evaluate(()=>jalankanKirimWA());
 assert.equal(await page.evaluate(()=>window.opened.length),0);
 assert.deepEqual(errors,[]);
 console.log("Browser PASS: save settings, reorder categories/menus, customer reload, safe text, WhatsApp routing, conflicts, unauthorized writes, unavailable settings.");
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
