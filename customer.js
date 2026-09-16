"use strict";
let databaseMenu = [], katAktif = "SEMUA", queryCari = "";
const cart = new Map();
let customerPromotions=[], promotionsReady=false, checkingOrder=false, promotionFilter=null;
function room() { return $("input-room-final").value; }
function deteksiRoom() {
  const candidate = new URLSearchParams(location.search).get("room")?.toUpperCase();
  if (Array.from($("input-room-final").options).some(option => option.value === candidate)) $("input-room-final").value = candidate;
  cekRoomStatus();
}
function cekRoomStatus() {
  $("info-room-header").textContent = room() ? "📍 Room: " + room() : "📍 Pilih Room";
  $("btn-kirim-wa").disabled = !storeSettingsReady || !promotionsReady || checkingOrder || !room() || cart.size === 0;
  $("btn-kirim-wa").textContent = room() ? "Lanjutkan ke WhatsApp" : "Pilih Room Dulu 🎤";
}
async function ambilData() {
  try {
    promotionsReady=false;cekRoomStatus();
    const [rows,promos]=await Promise.all([readMenus(true),readPromotions(true)]);
    customerPromotions=promos;
    databaseMenu=orderedMenus(buildOfferCatalog(rows.filter(m=>Number.isSafeInteger(Number(m.harga))&&Number(m.harga)>0),promos));
    promotionsReady=true;syncCartPrices();
    $("promotion-load-status").replaceChildren();renderBanners();
    renderTabs(); renderMenu(); renderBestSeller();updateBar();
  } catch (error) {
    promotionsReady=false;cekRoomStatus();$("promotion-banners").hidden=true;
    $("promotion-load-status").replaceChildren(el("p","Menu dan harga promo belum bisa dimuat. Pemesanan sementara tidak tersedia.","promo-alert"),action("Coba lagi",ambilData));
  }
}
function quantities(menu, refreshCart = false) {
  const controls = el("div", "", "flex items-center gap-2 mt-2");
  const change = delta => { ubahQty(menu.id, delta); if (refreshCart) munculkanPopup(); };
  controls.append(action("−", () => change(-1)), el("span", String(cart.get(String(menu.id))?.qty || 0)), action("+", () => change(1)));
  return controls;
}
function card(menu) {
  const node = el("article", "", "menu-card bg-white rounded-2xl p-3 min-w-[160px]");
  node.append(menuImage(menu.foto_url, menu.nama), el("h3", menu.nama, "font-black text-sm mt-2"), el("p", menu.deskripsi || "", "text-xs text-slate-500"), priceDisplay(menu));
  if(menu.contents)node.append(el("p",menu.contents,"bundle-contents"));
  const badges = [(menu.promo || menu.offer_id) && "🔥 PROMO", menu.best_seller && "⭐ BEST SELLER", menu.kategori === "PAKET" && "🎁 PAKET"].filter(Boolean);
  if (badges.length) node.append(el("p", badges.join(" · "), "text-xs"));
  node.append(quantities(menu));
  return node;
}
function renderMenu() {
  const filtered = databaseMenu.filter(m => (!promotionFilter || m.offer_id===promotionFilter) && (katAktif === "SEMUA" || m.kategori === katAktif) && String(m.nama).toLowerCase().includes(queryCari));
  const grid = el("div", "", "grid grid-cols-2 gap-2 text-left");
  filtered.forEach(menu => grid.append(card(menu)));
  $("container-menu").replaceChildren(filtered.length ? grid : el("p", "Menu tidak ditemukan.", "py-12"));
}
function renderBestSeller() {
  const best = databaseMenu.filter(m => m.best_seller || m.promo || m.offer_id || m.kategori === "PAKET");
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
  if (!menu) return;
  const item = cart.get(String(id)) || { ...menu, qty: 0, catatan: "" };
  item.qty = Math.max(0, Math.min(99, item.qty + delta));
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
    note.addEventListener("input", () => { item.catatan = note.value; });
    node.append(el("h3", item.nama, "font-black"),priceDisplay(item));
    if(item.contents)node.append(el("p",item.contents,"bundle-contents"));
    node.append(el("p", "Subtotal: "+rupiah(Number(item.harga) * item.qty)), quantities(item, true), note);
    $("list-checkout").append(node);
  }
  $("harga-akhir").textContent = $("subtotal-angka").textContent = rupiah(total());
  $("layar-hitam").classList.add("tampil");
  document.body.style.overflow = "hidden";
  cekRoomStatus();
}
function hilangkanPopup() { $("layar-hitam").classList.remove("tampil"); document.body.style.overflow = ""; }
function resetKeranjang() { if (confirm("Hapus semua item di keranjang?")) { cart.clear(); hilangkanPopup(); updateBar(); renderMenu(); renderBestSeller(); } }
function syncCartPrices() {
  for(const [id,item] of cart){const current=databaseMenu.find(menu=>String(menu.id)===id);if(current)cart.set(id,{...current,qty:item.qty,catatan:item.catatan});else cart.delete(id);}
}
function renderBanners(){
  const section=$("promotion-banners"),track=el("div","","promo-track");
  for(const p of customerPromotions.filter(p=>p.active&&p.banner)){
    const candidates=databaseMenu.filter(m=>p.kind==="bundle"?m.id==="bundle:"+p.id:m.offer_id===p.id);
    if(!candidates.length)continue;
    const first=candidates[0],banner=el("article","","promo-banner"+(p.kind==="bundle"?" bundle":"")),copy=el("div","");
    copy.append(el("span",p.kind==="bundle"?"Paket bundling":p.discount_type==="percent"?"Diskon "+p.discount_value+"%":"Potongan "+rupiah(p.discount_value),"promo-label"),el("h3",p.title),el("p",p.description));
    if(p.kind==="bundle")copy.append(el("p",first.contents),priceDisplay(first));
    else copy.append(el("p",candidates.map(m=>m.nama).join(" · ")));
    copy.append(action(p.kind==="bundle"?"Tambah paket +":"Lihat menu promo",()=>{
      if(p.kind==="bundle"){ubahQty(first.id,1);return;}
      queryCari="";$("input-cari-sticky").value="";$("btn-reset-cari-sticky").classList.add("hidden");katAktif="SEMUA";promotionFilter=p.id;renderTabs();renderMenu();
      $("judul-kategori-menu").textContent=p.title;$("sticky-order-bar").scrollIntoView({behavior:"smooth"});
    },"promo-cta"));
    banner.append(copy,menuImage(first.foto_url,first.nama));track.append(banner);
  }
  section.replaceChildren(el("h2","Promo pilihan","promo-heading"),track);section.hidden=!track.children.length;
}
function whatsappURL(message) { return "https://wa.me/" + storeSettings.whatsapp + "?text=" + encodeURIComponent(message); }
function openOrderWhatsApp(url) { window.location.assign(url); }
async function jalankanKirimWA() {
  if (!storeSettingsReady || !promotionsReady || checkingOrder || !room() || !cart.size) return;
  checkingOrder=true;cekRoomStatus();
  const oldCart=JSON.stringify([...cart.values()].map(i=>[i.id,i.harga,i.nama,i.contents]));
  try {
    const [rows,promos,settings]=await Promise.all([readMenus(true),readPromotions(true),readStoreSettings()]);
    databaseMenu=orderedMenus(buildOfferCatalog(rows,promos));customerPromotions=promos;storeSettings=settings;syncCartPrices();
    if(oldCart!==JSON.stringify([...cart.values()].map(i=>[i.id,i.harga,i.nama,i.contents]))) {
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
  if (!room()) { alert("Pilih room terlebih dahulu di bagian atas halaman."); return; }
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
async function startCustomer() {
  storeSettingsReady = false;
  deteksiRoom();
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
