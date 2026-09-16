"use strict";
const DEFAULT_STORE = {
  id: 1, version: 0, store_name: "Happy Puppy Panjaitan",
  whatsapp: "6281255763976", address: "Samarinda",
  opening_hours: "", information: "", category_order: [], menu_order: []
};
let storeSettings = { ...DEFAULT_STORE }, storeSettingsReady = false;
function normalizeWhatsApp(value) {
  let number = String(value).trim().replace(/[\s()+-]/g, "");
  if (number.startsWith("0")) number = "62" + number.slice(1);
  if (!/^[1-9][0-9]{7,14}$/.test(number)) throw new Error("Nomor WhatsApp tidak valid. Gunakan kode negara, contoh 6281234567890.");
  return number;
}
function settingsPayload(input) {
  const result = {};
  for (const [key, max] of [["store_name",100], ["address",500], ["opening_hours",500], ["information",2000]]) {
    result[key] = String(input[key] ?? "").trim();
    if (result[key].length > max) throw new Error("Teks terlalu panjang: " + key);
  }
  if (!result.store_name) throw new Error("Nama toko wajib diisi.");
  result.whatsapp = normalizeWhatsApp(input.whatsapp);
  for (const key of ["category_order","menu_order"]) {
    if (!Array.isArray(input[key]) || input[key].length > 10000 || input[key].some(item => typeof item !== "string" || !item || item.length > 200)) throw new Error("Daftar urutan tidak valid.");
    result[key] = [...new Set(input[key])];
  }
  return result;
}
function orderedValues(values, preference) {
  const ranks = new Map(preference.map((value,i)=>[String(value),i]));
  return [...values].sort((a,b)=>(ranks.get(String(a)) ?? Infinity) - (ranks.get(String(b)) ?? Infinity));
}
function orderedMenus(rows, settings = storeSettings) {
  const categories = new Map(settings.category_order.map((value,i)=>[value,i]));
  const items = new Map(settings.menu_order.map((value,i)=>[String(value),i]));
  return [...rows].sort((a,b)=>{
    const category = (categories.get(a.kategori) ?? Infinity) - (categories.get(b.kategori) ?? Infinity);
    if (category && !Number.isNaN(category)) return category;
    const item = (items.get(String(a.id)) ?? Infinity) - (items.get(String(b.id)) ?? Infinity);
    return Number.isNaN(item) ? 0 : item;
  });
}
function moveOrder(values, value, delta) {
  const result = [...values], index = result.indexOf(value), target = index + delta;
  if (index >= 0 && target >= 0 && target < result.length) [result[index],result[target]] = [result[target],result[index]];
  return result;
}
async function readStoreSettings() {
  const {data,error} = await client.from("menu_settings").select("*").eq("id",1).single();
  if (error) throw error;
  if (!data) throw new Error("Pengaturan toko belum tersedia.");
  return { ...DEFAULT_STORE, ...data, ...settingsPayload(data) };
}
function applyStoreInformation() {
  document.title = ($("admin-content") ? "Admin — " : "Menu — ") + storeSettings.store_name;
  for (const node of document.querySelectorAll("[data-store-name]")) node.textContent = storeSettings.store_name;
  for (const [id,key] of [["store-address","address"],["store-hours","opening_hours"],["store-information","information"]]) {
    if ($(id)) { $(id).textContent = storeSettings[key]; $(id).hidden = !storeSettings[key]; }
  }
}
