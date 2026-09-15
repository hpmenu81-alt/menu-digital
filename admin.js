"use strict";
let menus = [], authorized = false, busy = false, previewUrl = null, authVersion = 0, loadVersion = 0;
function statusMessage(message) { $("status").textContent = message; }
function clearPreview() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  $("previewFoto").removeAttribute("src");
  $("previewFoto").classList.add("hidden");
}
function resetForm() {
  if (busy) return;
  for (const id of ["edit_id", "nama", "harga", "kategori", "deskripsi", "foto"]) $(id).value = "";
  $("best_seller").checked = $("promo").checked = false;
  $("fotoHint").classList.add("hidden");
  $("btn-simpan").textContent = "Simpan Menu";
  clearPreview();
}
function previewFoto() {
  clearPreview();
  const file = $("foto").files[0];
  if (file) { previewUrl = URL.createObjectURL(file); $("previewFoto").src = previewUrl; $("previewFoto").classList.remove("hidden"); }
}
function editMenu(menu) {
  if (busy) return;
  resetForm();
  for (const id of ["nama", "harga", "kategori", "deskripsi"]) $(id).value = menu[id] ?? "";
  $("edit_id").value = menu.id;
  $("best_seller").checked = !!menu.best_seller;
  $("promo").checked = !!menu.promo;
  $("fotoHint").classList.remove("hidden");
  const image = menuImage(menu.foto_url, menu.nama);
  if (image.hasAttribute("src")) { $("previewFoto").src = image.src; $("previewFoto").classList.remove("hidden"); }
  $("btn-simpan").textContent = "Update Menu";
  showTab("form");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function setBusy(value) {
  busy = value;
  $("admin-content").querySelectorAll("input,textarea,select,button").forEach(node => { node.disabled = value; });
}
async function requireAdmin() {
  const { data, error } = await client.rpc("is_menu_admin");
  if (error || data !== true) throw new Error("Akses admin diperlukan. Masuk dengan akun admin yang terdaftar.");
}
async function simpanMenu() {
  if (busy || !authorized) return;
  try {
    const editId = $("edit_id").value;
    const payload = menuPayload({ nama: $("nama").value, harga: $("harga").value, kategori: $("kategori").value, deskripsi: $("deskripsi").value, best_seller: $("best_seller").checked, promo: $("promo").checked }, !!editId);
    const file = $("foto").files[0];
    if (!editId && !file) throw new Error("Foto wajib diisi untuk menu baru.");
    const types = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
    if (file && (!types[file.type] || file.size > 5 * 1024 * 1024 || file.size === 0)) throw new Error("Gunakan JPG, PNG, WebP, atau GIF maksimal 5 MB.");
    setBusy(true);
    statusMessage("Menyimpan...");
    await requireAdmin();
    if (file) {
      const path = crypto.randomUUID() + "." + types[file.type];
      const { error } = await client.storage.from("menu-images").upload(path, file, { contentType: file.type });
      if (error) throw error;
      payload.foto_url = client.storage.from("menu-images").getPublicUrl(path).data.publicUrl;
    }
    let query = editId ? client.from("menus").update(payload).eq("id", editId) : client.from("menus").insert(payload);
    const { data, error } = await query.select("id").single();
    if (error || !data) throw error || new Error("Tidak ada menu yang tersimpan.");
    setBusy(false);
    resetForm();
    statusMessage(editId ? "Menu berhasil diupdate." : "Menu berhasil disimpan.");
    await loadMenu();
  } catch (error) {
    // A network failure may happen after the database committed. Keep the image
    // in that case; deleting it could break a successfully saved menu.
    statusMessage("Gagal: " + error.message);
  } finally { setBusy(false); }
}
async function toggleField(id, field, value) {
  if (busy || !authorized) return;
  try {
    setBusy(true);
    await requireAdmin();
    const { data, error } = await client.from("menus").update({ [field]: value }).eq("id", id).select("id").single();
    if (error || !data) throw error || new Error("Menu tidak ditemukan.");
    await loadMenu();
  } catch (error) { statusMessage("Gagal: " + error.message); }
  finally { setBusy(false); }
}
function renderAdmin() {
  const keyword = $("searchAdmin").value.toLowerCase(), filter = $("filterAdmin").value;
  const result = menus.filter(m => [m.nama, m.kategori].some(v => String(v || "").toLowerCase().includes(keyword)) && ({ SEMUA: true, AKTIF: !!m.aktif, NONAKTIF: !m.aktif, BEST: !!m.best_seller, PROMO: !!m.promo })[filter]);
  $("list-menu").replaceChildren();
  for (const menu of result) {
    const card = el("article", "", "bg-slate-50 rounded-2xl p-3 border space-y-2");
    card.append(menuImage(menu.foto_url, menu.nama), el("h3", menu.nama, "font-black"), el("p", rupiah(menu.harga)), el("p", menu.kategori), el("p", menu.aktif ? "🟢 AKTIF" : "🔴 NONAKTIF"));
    const controls = el("div", "", "grid grid-cols-2 gap-2");
    controls.append(action("Edit", () => editMenu(menu)));
    for (const [field, label] of [["aktif", "Aktif"], ["best_seller", "Best Seller"], ["promo", "Promo"]]) controls.append(action((menu[field] ? "Nonaktifkan " : "Aktifkan ") + label, () => toggleField(menu.id, field, !menu[field])));
    card.append(controls);
    $("list-menu").append(card);
  }
  if (!result.length) $("list-menu").append(el("p", "Tidak ada menu yang cocok."));
}
async function loadMenu() {
  if (!authorized) return;
  const version = ++loadVersion;
  $("list-menu").textContent = "Memuat menu...";
  try { const rows = await readMenus(); if (authorized && version === loadVersion) { menus = rows; renderAdmin(); } }
  catch (error) { if (version === loadVersion) $("list-menu").textContent = "Gagal memuat menu: " + error.message; }
}
function showTab(tab) {
  if (busy) return;
  $("panelForm").classList.toggle("hidden", tab !== "form");
  $("panelList").classList.toggle("hidden", tab !== "list");
  for (const name of ["Form", "List"]) $("tab" + name).className = (name.toLowerCase() === tab ? "bg-orange-500 text-white" : "bg-slate-200 text-slate-700") + " rounded-2xl py-3 font-black text-xs uppercase";
  if (tab === "list") loadMenu();
}
async function checkSession(session) {
  const version = ++authVersion;
  authorized = false;
  ++loadVersion;
  menus = [];
  $("list-menu").replaceChildren();
  $("admin-content").hidden = true;
  $("login-panel").hidden = false;
  $("logout").hidden = !session;
  if (!session) { statusMessage("Silakan masuk sebagai admin."); return; }
  try {
    await requireAdmin();
    if (version !== authVersion) return;
    authorized = true;
    $("admin-content").hidden = false;
    $("login-panel").hidden = true;
    statusMessage("");
    await loadMenu();
  } catch (error) { if (version === authVersion) statusMessage(error.message); }
}
$("login-form").addEventListener("submit", async event => {
  event.preventDefault();
  $("login-button").disabled = true;
  try {
    const { data, error } = await client.auth.signInWithPassword({ email: $("email").value.trim(), password: $("password").value });
    if (error) throw error;
    $("password").value = "";
    await checkSession(data.session);
  } catch (error) { statusMessage("Gagal masuk: " + error.message); }
  finally { $("login-button").disabled = false; }
});
$("logout").addEventListener("click", async () => {
  const { error } = await client.auth.signOut();
  if (error) statusMessage(error.message);
  else { resetForm(); await checkSession(null); }
});
client.auth.onAuthStateChange((_event, session) => { setTimeout(() => checkSession(session), 0); });
client.auth.getSession().then(({ data, error }) => error ? statusMessage(error.message) : checkSession(data.session)).catch(error => statusMessage(error.message));
