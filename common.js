"use strict";
const client = supabase.createClient("https://sytpztzuohaxseqdcnwa.supabase.co", "sb_publishable_uEpaY5r4PqrbW7Gw-QMumQ_wIKrP3Cg");
const $ = id => document.getElementById(id);
const rupiah = value => "Rp " + Number(value).toLocaleString("id-ID");
function el(tag, text, className = "") {
  const node = document.createElement(tag);
  node.textContent = text;
  node.className = className;
  return node;
}
function action(text, callback, className = "bg-orange-500 text-white rounded-xl px-3 py-2 font-bold") {
  const button = el("button", text, className);
  button.type = "button";
  button.addEventListener("click", callback);
  return button;
}
function menuImage(url, name) {
  const image = el("img", "", "w-16 h-16 rounded-xl object-cover bg-slate-100");
  image.alt = name || "Foto menu";
  image.loading = "lazy";
  try { const parsed = new URL(url); if (parsed.protocol === "https:") image.src = parsed.href; } catch {}
  image.addEventListener("error", () => { image.removeAttribute("src"); }, { once: true });
  return image;
}
function validPrice(raw) {
  const value = Number(raw);
  if (!String(raw).trim() || !Number.isSafeInteger(value) || value <= 0) throw new Error("Harga harus bilangan bulat lebih dari nol.");
  return value;
}
function menuPayload(values, editing) {
  const nama = values.nama.trim(), kategori = values.kategori.trim().toUpperCase();
  if (!nama || !kategori) throw new Error("Nama dan kategori wajib diisi.");
  const payload = { nama, kategori, harga: validPrice(values.harga), deskripsi: values.deskripsi.trim(), best_seller: values.best_seller, promo: values.promo };
  if (!editing) payload.aktif = true;
  return payload;
}
async function readMenus(activeOnly = false) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    let query = client.from("menus").select("id,nama,harga,kategori,deskripsi,foto_url,aktif,best_seller,promo,created_at").order("created_at", { ascending: false }).order("id");
    if (activeOnly) query = query.eq("aktif", true);
    const { data, error } = await query.range(offset, offset + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
