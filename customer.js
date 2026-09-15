"use strict";
const WA_NUMBER = "6281255763976";
let databaseMenu = [], katAktif = "SEMUA", queryCari = "";
const cart = new Map();
function room() { return $("input-room-final").value; }
function deteksiRoom() {
  const candidate = new URLSearchParams(location.search).get("room")?.toUpperCase();
  if (Array.from($("input-room-final").options).some(option => option.value === candidate)) $("input-room-final").value = candidate;
  cekRoomStatus();
}
function cekRoomStatus() {
  $("info-room-header").textContent = room() ? "📍 Room: " + room() : "📍 Pilih Room";
  $("btn-kirim-wa").disabled = !room() || cart.size === 0;
  $("btn-kirim-wa").textContent = room() ? "Lanjutkan ke WhatsApp" : "Pilih Room Dulu 🎤";
}
async function ambilData() {
  try {
    databaseMenu = (await readMenus(true)).filter(m => Number.isSafeInteger(Number(m.harga)) && Number(m.harga) > 0);
    renderTabs(); renderMenu(); renderBestSeller();
  } catch (error) {
    $("container-menu").replaceChildren(el("p", "Gagal memuat menu. Silakan coba lagi."), action("Coba lagi", ambilData));
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
  node.append(menuImage(menu.foto_url, menu.nama), el("h3", menu.nama, "font-black text-sm mt-2"), el("p", menu.deskripsi || "", "text-xs text-slate-500"), el("p", rupiah(menu.harga), "font-black text-orange-600 mt-2"));
  const badges = [menu.promo && "🔥 PROMO", menu.best_seller && "⭐ BEST SELLER", menu.kategori === "PAKET" && "🎁 PAKET"].filter(Boolean);
  if (badges.length) node.append(el("p", badges.join(" · "), "text-xs"));
  node.append(quantities(menu));
  return node;
}
function renderMenu() {
  const filtered = databaseMenu.filter(m => (katAktif === "SEMUA" || m.kategori === katAktif) && String(m.nama).toLowerCase().includes(queryCari));
  const grid = el("div", "", "grid grid-cols-2 gap-2 text-left");
  filtered.forEach(menu => grid.append(card(menu)));
  $("container-menu").replaceChildren(filtered.length ? grid : el("p", "Menu tidak ditemukan.", "py-12"));
}
function renderBestSeller() {
  const best = databaseMenu.filter(m => m.best_seller || m.promo || m.kategori === "PAKET");
  $("section-best-seller").hidden = !best.length || !!queryCari;
  $("container-best-seller").replaceChildren(...best.map(card));
}
function renderTabs() {
  const categories = ["SEMUA", ...new Set(databaseMenu.map(m => m.kategori))];
  $("tabs-kategori").replaceChildren(...categories.map(category => action(category, () => gantiKat(category), "px-3 py-2 rounded-full text-xs " + (category === katAktif ? "active-tab" : "bg-white"))));
}
function gantiKat(category) {
  katAktif = category;
  $("judul-kategori-menu").textContent = category === "SEMUA" ? "☰ SEMUA MENU" : "☰ " + category;
  renderTabs(); renderMenu();
}
function cekInputCariSticky() {
  queryCari = $("input-cari-sticky").value.toLowerCase().trim();
  $("btn-reset-cari-sticky").classList.toggle("hidden", !queryCari);
  renderMenu(); renderBestSeller();
}
function resetCariSticky() { $("input-cari-sticky").value = ""; cekInputCariSticky(); }
function ubahQty(id, delta) {
  const menu = databaseMenu.find(m => String(m.id) === String(id));
  if (!menu) return;
  const item = cart.get(String(id)) || { ...menu, qty: 0, catatan: "" };
  item.qty = Math.max(0, Math.min(99, item.qty + delta));
  if (item.qty) cart.set(String(id), item); else cart.delete(String(id));
  updateBar(); renderMenu(); renderBestSeller();
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
    node.append(el("h3", item.nama, "font-black"), el("p", rupiah(Number(item.harga) * item.qty)), quantities(item, true), note);
    $("list-checkout").append(node);
  }
  $("harga-akhir").textContent = $("subtotal-angka").textContent = rupiah(total());
  $("layar-hitam").classList.add("tampil");
  document.body.style.overflow = "hidden";
  cekRoomStatus();
}
function hilangkanPopup() { $("layar-hitam").classList.remove("tampil"); document.body.style.overflow = ""; }
function resetKeranjang() { if (confirm("Hapus semua item di keranjang?")) { cart.clear(); hilangkanPopup(); updateBar(); renderMenu(); renderBestSeller(); } }
function whatsappURL(message) { return "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(message); }
function jalankanKirimWA() {
  if (!room() || !cart.size) return;
  const lines = ["Halo, saya dari ROOM " + room() + " ingin memesan:", ""];
  for (const item of cart.values()) {
    lines.push("• " + item.nama + " (" + item.qty + "x)");
    if (item.catatan) lines.push("  Catatan: " + item.catatan);
  }
  lines.push("", "TOTAL: " + rupiah(total()), "Mohon konfirmasi pesanan ke room. Terima kasih!");
  window.open(whatsappURL(lines.join("\n")), "_blank", "noopener,noreferrer");
  // Opening WhatsApp is not confirmation of delivery. Keep the cart for retry.
  $("btn-kirim-wa").textContent = "Buka WhatsApp lagi";
}
function bukaBantuan() { $("layar-bantuan").classList.add("tampil"); }
function tutupBantuan() { $("layar-bantuan").classList.remove("tampil"); }
function kirimBantuan(request) {
  if (!room()) { alert("Pilih room terlebih dahulu di bagian atas halaman."); return; }
  window.open(whatsappURL("Halo Happy Puppy Samarinda, saya dari ROOM " + room() + ". " + request + "."), "_blank", "noopener,noreferrer");
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
deteksiRoom();
ambilData();
