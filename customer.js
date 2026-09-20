"use strict";
let databaseMenu = [], katAktif = "SEMUA", queryCari = "";
const cart = new Map();
let customerPromotions=[], promotionsReady=false, checkingOrder=false, promotionFilter=null;
let customerRooms=[],roomsReady=false,roomsInitialized=false;
let baseCustomerMenus=[],cartRestored=false,savedCart=readSavedCart(),scheduleTimer=null;
function persistCart(){
  if(!cartRestored)return;
  if(!writeSavedCart(room(),cart.values()))$("cart-notice").textContent="Penyimpanan perangkat tidak tersedia. Keranjang hanya bertahan selama halaman ini terbuka.";
}
function room() { return $("input-room-final").value; }
function deteksiRoom() {
  const candidate = new URLSearchParams(location.search).get("room")?.toUpperCase();
  const valid=value=>!!value&&Array.from($("input-room-final").options).some(option=>option.value===value);
  if(candidate&&savedCart?.room&&savedCart.room!==candidate){savedCart=null;$("cart-notice").textContent="Room dari QR berbeda. Mulai keranjang baru.";}
  if(candidate&&!valid(candidate)){$("input-room-final").value="";$("cart-notice").textContent="Room dari QR tidak aktif atau tidak ditemukan. Pilih room yang tersedia.";}
  else if(valid(candidate)){
    $("input-room-final").value=candidate;
  }else if(valid(savedCart?.room))$("input-room-final").value=savedCart.room;
  $("checkout-room").replaceChildren(...Array.from($("input-room-final").children,node=>node.cloneNode(true)));
  cekRoomStatus();
}
function applyCustomerRooms(rows){
  const previous=room();customerRooms=rows;fillRoomSelect($("input-room-final"),rows,previous);
  roomsReady=true;
  if(!roomsInitialized){deteksiRoom();roomsInitialized=true;}
  else {fillRoomSelect($("checkout-room"),rows,room());if(previous&&!room())$("cart-notice").textContent="Room sebelumnya tidak lagi tersedia. Pilih room aktif.";}
  if(!rows.some(r=>r.active))$("cart-notice").textContent="Belum ada room aktif. Silakan hubungi staf untuk memesan.";
  cekRoomStatus();
}
function cekRoomStatus() {
  $("checkout-room").value=room();persistCart();
  $("info-room-header").textContent = room() ? "📍 Room: " + room() : "📍 Pilih Room";
  $("btn-kirim-wa").disabled = !storeSettingsReady || !roomsReady || !promotionsReady || checkingOrder || !room() || cart.size === 0 || [...cart.values()].some(item=>!servingsComplete(item));
  $("serving-status").textContent=[...cart.values()].some(item=>!servingsComplete(item))?"Lengkapi pilihan panas/dingin untuk semua minuman sebelum melanjutkan.":"";
  $("btn-kirim-wa").textContent = room() ? "Lanjutkan ke WhatsApp" : "Pilih Room Dulu 🎤";
}
async function ambilData() {
  try {
    promotionsReady=false;cekRoomStatus();
    const [rows,promos,rooms]=await Promise.all([readMenus(true),readPromotions(true),readRooms(true)]);
    applyCustomerRooms(rooms);
    customerPromotions=promos;baseCustomerMenus=rows.filter(m=>Number.isSafeInteger(Number(m.harga))&&Number(m.harga)>0);
    databaseMenu=orderedMenus(buildOfferCatalog(baseCustomerMenus,promos));
    if(!cartRestored){
      const items=savedCart?.items||[];
      for(const item of items){const menu=databaseMenu.find(m=>String(m.id)===item.id);if(menu&&menu.tersedia!==false)cart.set(item.id,{...menu,qty:item.qty,catatan:item.catatan,servings:normalizeServings({...menu,qty:item.qty},item.servings)});}
      cartRestored=true;savedCart=null;
      if(items.length)$("cart-notice").textContent=cart.size?"Keranjang dipulihkan dengan harga terbaru. Periksa kembali sebelum memesan.":"Menu dari keranjang sebelumnya sudah tidak tersedia.";
    }
    promotionsReady=true;syncCartPrices();
    $("promotion-load-status").replaceChildren();renderBanners();
    renderTabs(); renderMenu(); renderBestSeller();updateBar();schedulePromoRefresh();
  } catch (error) {
    promotionsReady=false;roomsReady=false;cekRoomStatus();$("promotion-banners").hidden=true;
    $("promotion-load-status").replaceChildren(el("p","Menu, room, dan harga promo belum bisa dimuat. Pemesanan sementara tidak tersedia.","promo-alert"),action("Coba lagi",ambilData));
  }
}
function quantities(menu, refreshCart = false) {
  const controls = el("div", "", "flex items-center gap-2 mt-2");
  const change = delta => { ubahQty(menu.id, delta); if (refreshCart) munculkanPopup(); };
  controls.append(action("−", () => change(-1)), el("span", String(cart.get(String(menu.id))?.qty || 0)), action("+", () => change(1)));
  return controls;
}
function card(menu) {
  const node = el("article", "", "menu-card");
  node.append(menuImage(menu.foto_url, menu.nama), el("h3", menu.nama, "font-black text-sm mt-2"), el("p", menu.deskripsi || "", "text-xs text-slate-500"), priceDisplay(menu));
  if(menu.contents)node.append(el("p",menu.contents,"bundle-contents"));
  const badges = [menu.offer_id && "🔥 PROMO", menu.best_seller && "⭐ BEST SELLER", menu.kategori === "PAKET" && "🎁 PAKET"].filter(Boolean);
  if (badges.length) node.append(el("p", badges.join(" · "), "text-xs"));
  if(menu.tersedia===false){node.classList.add("sold-out");node.append(el("p","Habis sementara","sold-out-label"));}
  else node.append(quantities(menu));
  return node;
}
function renderMenu() {
  const filtered = databaseMenu.filter(m => (!promotionFilter || m.offer_id===promotionFilter) && (katAktif === "SEMUA" || m.kategori === katAktif) && String(m.nama).toLowerCase().includes(queryCari));
  const grid = el("div", "", "customer-grid");
  filtered.forEach(menu => grid.append(card(menu)));
  $("container-menu").replaceChildren(filtered.length ? grid : emptyMenuState());
}
function emptyMenuState(){
  const node=el("div","","empty-menu");
  node.append(el("h3",katAktif==="PAKET"&&!queryCari?"Belum ada paket tersedia":"Menu tidak ditemukan"),el("p",katAktif==="PAKET"&&!queryCari?"Paket spesial akan muncul di sini saat tersedia. Anda tetap bisa memilih menu satuan.":"Coba kata kunci lain atau lihat semua menu."));
  node.append(action("Lihat semua menu",()=>{resetCariSticky();gantiKat("SEMUA");setActiveNav("menu");}));return node;
}
function renderBestSeller() {
  const best = databaseMenu.filter(m => m.best_seller || m.offer_id || m.kategori === "PAKET");
  $("section-best-seller").hidden = !best.length || !!queryCari;
  $("container-best-seller").replaceChildren(...best.map(card));
}
function renderTabs() {
  const categories = ["SEMUA", ...new Set(databaseMenu.map(m => m.kategori))];
  $("tabs-kategori").replaceChildren(...categories.map(category => action(category, () => gantiKat(category), "px-3 py-2 rounded-full text-xs " + (category === katAktif ? "active-tab" : "bg-white"))));
}
function gantiKat(category) {
  promotionFilter=null;
  katAktif = category;
  $("judul-kategori-menu").textContent = category === "SEMUA" ? "☰ SEMUA MENU" : "☰ " + category;
  renderTabs(); renderMenu();
}
function cekInputCariSticky() {
  promotionFilter=null;
  queryCari = $("input-cari-sticky").value.toLowerCase().trim();
  $("btn-reset-cari-sticky").classList.toggle("hidden", !queryCari);
  renderMenu(); renderBestSeller();
}
function resetCariSticky() { $("input-cari-sticky").value = ""; cekInputCariSticky(); }
function ubahQty(id, delta) {
  if(!promotionsReady || checkingOrder)return;
  const menu = databaseMenu.find(m => String(m.id) === String(id));
  if (!menu || menu.tersedia===false) return;
  const item = cart.get(String(id)) || { ...menu, qty: 0, catatan: "" };
  item.qty = Math.max(0, Math.min(99, item.qty + delta));
  item.servings=normalizeServings(item,item.servings);
  if (item.qty) cart.set(String(id), item); else cart.delete(String(id));
  updateBar(); renderMenu(); renderBestSeller(); renderBanners();
}
function total() { return Array.from(cart.values()).reduce((sum, item) => sum + Number(item.harga) * item.qty, 0); }
function updateBar() {
  $("bar-keranjang").classList.toggle("hidden", !cart.size);
  const qty = Array.from(cart.values()).reduce((sum, item) => sum + item.qty, 0);
  $("ringkasan-singkat").replaceChildren(el("p", qty + " Menu", "font-black"), el("p", rupiah(total())));
  cekRoomStatus();
}
function munculkanPopup(event) {
  event?.preventDefault();
  if (!cart.size) { hilangkanPopup(); return; }
  $("list-checkout").replaceChildren();
  for (const item of cart.values()) {
    const node = el("article", "", "rounded-2xl border p-3 mb-2");
    const note = el("input", "", "w-full bg-orange-50 rounded-xl p-2 mt-2");
    note.type = "text"; note.value = item.catatan; note.maxLength = 300;
    note.placeholder = "Catatan, contoh: jangan pedas";
    note.setAttribute("aria-label", "Catatan untuk " + item.nama);
    note.addEventListener("input", () => { const current=cart.get(String(item.id));if(current)current.catatan=note.value;persistCart(); });
    node.append(el("h3", item.nama, "font-black"),priceDisplay(item));
    if(item.contents)node.append(el("p",item.contents,"bundle-contents"));
    node.append(el("p", "Subtotal: "+rupiah(Number(item.harga) * item.qty)), quantities(item, true));
    appendServingControls(node,item);node.append(note);
    $("list-checkout").append(node);
  }
  $("harga-akhir").textContent = $("subtotal-angka").textContent = rupiah(total());
  $("layar-hitam").classList.add("tampil");
  document.body.style.overflow = "hidden";
  cekRoomStatus();
}
function appendServingControls(node,item){
  for(const part of servingParts(item)){
    const group=el("fieldset","","serving-choice"),required=part.quantity*item.qty;
    group.append(el("legend",part.nama+" · "+required+" gelas"));
    const inputs={};
    for(const [key,label] of [["hot","Panas"],["cold","Dingin"]]){
      const wrapper=el("label",label),input=el("input","");input.type="number";input.min="0";input.max=String(required);input.step="1";input.value=item.servings[part.id][key];
      input.setAttribute("aria-label","Jumlah "+label.toLowerCase()+" untuk "+part.nama+" — "+item.nama);inputs[key]=input;
      input.addEventListener("input",()=>{
        const current=cart.get(String(item.id));if(!current)return;
        current.servings[part.id]={hot:inputs.hot.valueAsNumber,cold:inputs.cold.valueAsNumber};
        const valid=[inputs.hot,inputs.cold].every(x=>x.validity.valid&&x.value!=="")&&inputs.hot.valueAsNumber+inputs.cold.valueAsNumber===required;
        help.textContent=valid?"Pilihan lengkap":"Isi jumlah panas + dingin = "+required+" gelas.";
        cekRoomStatus();
      });wrapper.append(input);group.append(wrapper);
    }
    const help=el("p",servingsComplete(item)?"Pilihan lengkap":"Isi jumlah panas + dingin = "+required+" gelas.","promo-help");group.append(help);node.append(group);
  }
}
function hilangkanPopup() { $("layar-hitam").classList.remove("tampil"); document.body.style.overflow = ""; }
function resetKeranjang() { if (confirm("Hapus semua item di keranjang?")) { cart.clear(); hilangkanPopup(); updateBar(); renderMenu(); renderBestSeller();$("cart-notice").textContent="Keranjang dikosongkan."; } }
function syncCartPrices() {
  for(const [id,item] of cart){const current=databaseMenu.find(menu=>String(menu.id)===id);if(current&&current.tersedia!==false)cart.set(id,{...current,qty:item.qty,catatan:item.catatan,servings:normalizeServings({...current,qty:item.qty},item.servings)});else cart.delete(id);}
}
function renderBanners(){
  const section=$("promotion-banners"),track=el("div","","promo-track");
  for(const p of orderedBanners(customerPromotions).filter(p=>promotionRunning(p)&&p.banner)){
    const candidates=databaseMenu.filter(m=>m.tersedia!==false).filter(m=>p.kind==="bundle"?m.id==="bundle:"+p.id:m.offer_id===p.id);
    if(!candidates.length)continue;
    const first=candidates[0];
    const banner=promotionBanner(p,candidates,()=>{

      if(p.kind==="bundle"){ubahQty(first.id,1);return;}
      queryCari="";$("input-cari-sticky").value="";$("btn-reset-cari-sticky").classList.add("hidden");katAktif="SEMUA";promotionFilter=p.id;renderTabs();renderMenu();
      $("judul-kategori-menu").textContent=p.title;$("sticky-order-bar").scrollIntoView({behavior:"smooth"});
    });track.append(banner);
  }
  section.replaceChildren(el("h2","Promo pilihan","promo-heading"),track);section.hidden=!track.children.length;
}
function whatsappURL(message) { return "https://wa.me/" + storeSettings.whatsapp + "?text=" + encodeURIComponent(message); }
function openOrderWhatsApp(url) { window.location.assign(url); }
async function jalankanKirimWA() {
  if (!storeSettingsReady || !roomsReady || !promotionsReady || checkingOrder || !room() || !cart.size || [...cart.values()].some(item=>!servingsComplete(item))) return;
  checkingOrder=true;cekRoomStatus();
  const oldCart=JSON.stringify([...cart.values()].map(i=>[i.id,i.harga,i.nama,i.contents,i.servings]));
  try {
    const selectedRoom=room();
    const [rows,promos,settings,rooms]=await Promise.all([readMenus(true),readPromotions(true),readStoreSettings(),readRooms(true)]);
    applyCustomerRooms(rooms);
    if(!room()||room()!==selectedRoom){alert("Room tidak lagi tersedia. Pilih room aktif sebelum memesan.");return;}
    baseCustomerMenus=rows;databaseMenu=orderedMenus(buildOfferCatalog(rows,promos));customerPromotions=promos;storeSettings=settings;syncCartPrices();persistCart();schedulePromoRefresh();
    if(oldCart!==JSON.stringify([...cart.values()].map(i=>[i.id,i.harga,i.nama,i.contents,i.servings]))) {
      renderTabs();renderMenu();renderBestSeller();renderBanners();updateBar();munculkanPopup();
      alert("Harga atau ketersediaan menu berubah. Periksa keranjang terbaru, lalu lanjutkan lagi.");return;
    }
  } catch(error) {alert("Harga terbaru belum bisa diperiksa. Silakan coba lagi.");return;}
  finally{checkingOrder=false;cekRoomStatus();}
  const lines = ["Halo, saya dari ROOM " + room() + " ingin memesan:", ""];
  for (const item of cart.values()) {
    lines.push("• " + item.nama + " (" + item.qty + "x) @ "+rupiah(item.harga)+" = "+rupiah(item.harga*item.qty));
    if(item.contents)lines.push("  Isi per paket: "+item.contents);
    if(item.original_price>item.harga)lines.push("  Harga normal: "+rupiah(item.original_price)+" · "+(item.offer_title||"Promo"));
    if(servingParts(item).length)lines.push("  Pilihan: "+servingDescription(item));
    if (item.catatan) lines.push("  Catatan: " + item.catatan);
  }
  lines.push("", "TOTAL: " + rupiah(total()), "Mohon konfirmasi pesanan ke room. Terima kasih!");
  openOrderWhatsApp(whatsappURL(lines.join("\n")));
  // Opening WhatsApp is not confirmation of delivery. Keep the cart for retry.
  $("btn-kirim-wa").textContent = "Buka WhatsApp lagi";
}
function bukaBantuan() { $("layar-bantuan").classList.add("tampil"); }
function tutupBantuan() { $("layar-bantuan").classList.remove("tampil"); }
function kirimBantuan(request) {
  if (!storeSettingsReady) { alert("Informasi toko belum berhasil dimuat. Silakan muat ulang halaman."); return; }
  if (!roomsReady || !room()) { alert("Pilih room terlebih dahulu di bagian atas halaman."); return; }
  window.open(whatsappURL("Halo " + storeSettings.store_name + ", saya dari ROOM " + room() + ". " + request + "."), "_blank", "noopener,noreferrer");
  tutupBantuan();
}
function setActiveNav(name) {
  document.querySelectorAll(".bottom-nav button").forEach(button => button.classList.toggle("active", button.id === "nav-" + name));
}
function bukaRiwayatPesanan() {
  setActiveNav("pesanan");
  if (cart.size) munculkanPopup(); else alert("Keranjang masih kosong.");
}
function tutupNotifSelesai() { $("notif-sukses").classList.remove("tampil"); }
document.addEventListener("keydown", event => { if (event.key === "Escape") { hilangkanPopup(); tutupBantuan(); } });
$("checkout-room").addEventListener("change",()=>{$("input-room-final").value=$("checkout-room").value;cekRoomStatus();});
function schedulePromoRefresh(){
  clearTimeout(scheduleTimer);
  const now=promotionNow(),boundaries=customerPromotions.flatMap(p=>[p.starts_at,p.ends_at]).filter(Boolean).map(Date.parse).filter(time=>time>now);
  if(boundaries.length)scheduleTimer=setTimeout(refreshScheduledPrices,Math.min(2147483647,Math.max(50,Math.min(...boundaries)-now+50)));
}
function refreshScheduledPrices(){
  if(!promotionsReady)return;
  if(checkingOrder){scheduleTimer=setTimeout(refreshScheduledPrices,1000);return;}
  const before=JSON.stringify([...cart.values()].map(m=>[m.id,m.harga]));
  databaseMenu=orderedMenus(buildOfferCatalog(baseCustomerMenus,customerPromotions));syncCartPrices();
  renderMenu();renderBestSeller();renderTabs();renderBanners();updateBar();
  if(before!==JSON.stringify([...cart.values()].map(m=>[m.id,m.harga]))){
    $("cart-notice").textContent="Jadwal promo berubah. Harga keranjang telah diperbarui; periksa kembali sebelum memesan.";
    if($("layar-hitam").classList.contains("tampil"))munculkanPopup();
  }
  schedulePromoRefresh();
}
document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshScheduledPrices();});
async function startCustomer() {
  storeSettingsReady = false;
  roomsReady=false;
  try {
    storeSettings = await readStoreSettings();
    storeSettingsReady = true;
    applyStoreInformation();
    $("store-load-status").replaceChildren();
  } catch (error) {
    $("store-load-status").replaceChildren(el("p","Informasi toko belum bisa dimuat. Pemesanan sementara tidak tersedia."), action("Coba lagi",startCustomer));
  }
  cekRoomStatus();
  await ambilData();
}
startCustomer();
