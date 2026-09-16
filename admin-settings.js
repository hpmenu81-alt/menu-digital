"use strict";
let editorLoaded = false, editorVersion = 0, editorRequest = 0;
let categoryDraft = [], menuDraft = [], settingsDirty = false;
function markSettingsDirty() { settingsDirty = true; $("settings-status").textContent = "Ada perubahan yang belum disimpan."; }
function resetSettingsEditor() {
  ++editorRequest;
  editorLoaded = false; settingsDirty = false;
  categoryDraft = []; menuDraft = [];
  $("store-settings-form").reset();
  $("category-order-list").replaceChildren();
  $("menu-order-list").replaceChildren();
  $("settings-status").textContent = "";
}
async function openSettings() {
  if (!authorized || busy || editorLoaded) return;
  const request = ++editorRequest;
  $("settings-save").disabled = true;
  $("settings-status").textContent = "Memuat pengaturan...";
  try {
    const settings = await readStoreSettings();
    if (!authorized || request !== editorRequest) return;
    storeSettings = settings; editorVersion = settings.version;
    for (const key of ["store_name","whatsapp","address","opening_hours","information"]) $("setting-" + key).value = settings[key];
    categoryDraft = orderedValues([...new Set(menus.map(menu=>menu.kategori))],settings.category_order);
    menuDraft = orderedValues(menus.map(menu=>String(menu.id)),settings.menu_order);
    editorLoaded = true; settingsDirty = false;
    renderOrders(); applyStoreInformation();
    $("settings-status").textContent = "";
  } catch (error) {
    if (request === editorRequest) $("settings-status").textContent = "Pengaturan belum bisa dimuat. Pastikan SQL fitur pengaturan sudah dijalankan, lalu coba lagi. " + error.message;
  } finally { if (request === editorRequest) $("settings-save").disabled = !editorLoaded; }
}
function orderRow(label, value, values, onMove) {
  const row = el("div", "", "flex items-center gap-2 border rounded-xl p-2 bg-white");
  const name = el("span", label, "flex-1 min-w-0 break-words text-sm");
  const up = action("↑",()=>onMove(-1)), down = action("↓",()=>onMove(1));
  up.setAttribute("aria-label","Naikkan " + label); down.setAttribute("aria-label","Turunkan " + label);
  up.disabled = values.indexOf(value) === 0 || busy;
  down.disabled = values.indexOf(value) === values.length - 1 || busy;
  row.append(name,up,down);
  return row;
}
function renderOrders() {
  if (!editorLoaded) return;
  $("category-order-list").replaceChildren(...categoryDraft.map(category=>orderRow(category,category,categoryDraft,delta=>{
    categoryDraft = moveOrder(categoryDraft,category,delta); markSettingsDirty(); renderOrders();
  })));
  const selected = $("order-category").value;
  $("order-category").replaceChildren(...categoryDraft.map(category=>{
    const option = el("option",category); option.value=category; return option;
  }));
  if (categoryDraft.includes(selected)) $("order-category").value=selected;
  const category = $("order-category").value;
  const ids = menuDraft.filter(id=>menus.some(menu=>String(menu.id)===id && menu.kategori===category));
  $("menu-order-list").replaceChildren(...ids.map(id=>{
    const menu = menus.find(menu=>String(menu.id)===id);
    return orderRow(menu.nama + (menu.aktif ? "" : " (nonaktif)"),id,ids,delta=>{
      const reordered = moveOrder(ids,id,delta); let cursor=0;
      menuDraft = menuDraft.map(value=>ids.includes(value)?reordered[cursor++]:value);
      markSettingsDirty(); renderOrders();
    });
  }));
  if (!categoryDraft.length) $("category-order-list").append(el("p","Tambahkan menu terlebih dahulu."));
}
function syncOrderMenus() {
  if (!editorLoaded) return;
  const categories = [...new Set(menus.map(menu=>menu.kategori))], ids=menus.map(menu=>String(menu.id));
  categoryDraft = orderedValues(categories,categoryDraft);
  menuDraft = orderedValues(ids,menuDraft);
  renderOrders();
}
async function saveSettings(event) {
  event.preventDefault();
  if (!authorized || busy || !editorLoaded) return;
  const request = editorRequest;
  try {
    const input=Object.fromEntries(["store_name","whatsapp","address","opening_hours","information"].map(key=>[key,$("setting-"+key).value]));
    const payload=settingsPayload({...input,category_order:categoryDraft,menu_order:menuDraft});
    setBusy(true);
    $("settings-status").textContent="Menyimpan...";
    await requireAdmin();
    const {data,error}=await client.from("menu_settings").update({...payload,version:editorVersion+1}).eq("id",1).eq("version",editorVersion).select("*").single();
    if (error || !data) throw new Error("Gagal menyimpan. Pengaturan mungkin telah diubah admin lain. Muat ulang pengaturan lalu coba lagi." + (error ? " " + error.message : ""));
    if (!authorized || request !== editorRequest) return;
    storeSettings={...DEFAULT_STORE,...data}; editorVersion=data.version;
    $("setting-whatsapp").value=data.whatsapp;
    settingsDirty=false;
    applyStoreInformation(); renderAdmin();
    $("settings-status").textContent="Pengaturan dan urutan berhasil disimpan. Pelanggan melihat perubahan setelah memuat ulang halaman.";
  } catch(error) { if(request===editorRequest) $("settings-status").textContent=error.message; }
  finally { setBusy(false); $("settings-save").disabled=!editorLoaded; renderOrders(); }
}
$("store-settings-form").addEventListener("submit",saveSettings);
$("store-settings-form").addEventListener("input",markSettingsDirty);
$("order-category").addEventListener("change",renderOrders);
$("settings-reload").addEventListener("click",()=>{
  if(busy || (settingsDirty && !confirm("Buang perubahan pengaturan yang belum disimpan?"))) return;
  editorLoaded=false; openSettings();
});
window.addEventListener("beforeunload",event=>{
  if(settingsDirty) { event.preventDefault(); event.returnValue=""; }
});
