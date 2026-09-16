"use strict";
let promotionRows=[], promotionLoaded=false, promotionRequest=0, promotionEdit=null, promotionDirty=false;
let promotionSelection=new Map();
function promoDirty(){promotionDirty=true;$("promotion-status").textContent="Ada perubahan promo yang belum disimpan.";}
function resetPromotionEditor(){
  ++promotionRequest;promotionLoaded=false;promotionRows=[];promotionDirty=false;promotionEdit=null;promotionSelection.clear();
  $("promotion-form").reset();$("promotion-list").replaceChildren();$("promotion-picker").replaceChildren();$("promotion-status").textContent="";
}
function newPromotion(){
  if(busy || (promotionDirty&&!confirm("Buang perubahan promo yang belum disimpan?")))return;
  promotionEdit=null;promotionSelection.clear();$("promotion-form").reset();promotionDirty=false;
  $("promotion-save").textContent="Simpan promo";$("promotion-status").textContent="";renderPromotionPicker();
}
async function openPromotions(force=false){
  if(!authorized||busy||(!force&&promotionLoaded))return;
  const request=++promotionRequest;
  $("promotion-save").disabled=true;$("promotion-status").textContent="Memuat promo...";
  try{
    const [rows,menuRows]=await Promise.all([readPromotions(),readMenus()]);
    if(!authorized||request!==promotionRequest)return;
    promotionRows=rows;menus=menuRows;promotionLoaded=true;
    renderPromotionList();renderPromotionPicker();$("promotion-status").textContent="";
  }catch(error){if(request===promotionRequest)$("promotion-status").textContent="Gagal memuat promo: "+error.message;}
  finally{if(request===promotionRequest)$("promotion-save").disabled=!promotionLoaded;}
}
function promotionInput(){
  return {title:$("promotion-title").value,description:$("promotion-description").value,kind:$("promotion-kind").value,discount_type:$("promotion-discount-type").value,discount_value:$("promotion-discount-value").value,bundle_price:$("promotion-bundle-price").value,active:$("promotion-active").checked,banner:$("promotion-banner").checked,items:Array.from(promotionSelection,([menu_id,quantity])=>({menu_id,quantity}))};
}
function renderPromotionPicker(){
  const bundle=$("promotion-kind").value==="bundle",keyword=$("promotion-search").value.toLowerCase();
  $("promotion-discount-fields").hidden=bundle;$("promotion-bundle-fields").hidden=!bundle;
  $("promotion-picker").replaceChildren(...menus.filter(menu=>menu.nama.toLowerCase().includes(keyword)).map(menu=>{
    const row=el("label","","promo-choice"),check=el("input",""),text=el("span",menu.nama+" · "+rupiah(menu.harga)+(menu.aktif?"":" (nonaktif)"));
    check.type="checkbox";check.checked=promotionSelection.has(String(menu.id));check.setAttribute("aria-label","Pilih "+menu.nama);
    check.addEventListener("change",()=>{if(check.checked)promotionSelection.set(String(menu.id),1);else promotionSelection.delete(String(menu.id));promoDirty();renderPromotionPicker();});
    row.append(check,text);
    if(bundle&&check.checked){
      const quantity=el("input","");quantity.type="number";quantity.min="1";quantity.max="99";quantity.step="1";quantity.value=promotionSelection.get(String(menu.id));quantity.setAttribute("aria-label","Jumlah "+menu.nama);
      quantity.addEventListener("input",()=>{promotionSelection.set(String(menu.id),Number(quantity.value));promoDirty();previewPromotion();});row.append(quantity);
    }
    return row;
  }));
  $("promotion-selected").textContent=promotionSelection.size+" menu dipilih";
  previewPromotion();
}
function previewPromotion(){
  const node=$("promotion-preview");node.replaceChildren();
  if(!promotionSelection.size){node.textContent="Pilih menu untuk melihat perhitungan harga.";return;}
  try{
    const p=promotionPayload({...promotionInput(),title:$("promotion-title").value||"Pratinjau"},menus);
    const offers=buildOfferCatalog(menus,[{...p,id:"preview",active:true}]);
    const selected=p.kind==="bundle"?offers.filter(m=>m.is_bundle):offers.filter(m=>m.offer_id==="preview");
    for(const item of selected){const row=el("div",item.nama);row.append(priceDisplay(item));node.append(row);}
    if(!selected.length)node.textContent="Promo tidak tersedia: periksa menu aktif dan harga.";
  }catch(error){node.textContent=error.message;}
}
function editPromotion(p){
  if(busy||(promotionDirty&&!confirm("Buang perubahan promo yang belum disimpan?")))return;
  promotionEdit={id:p.id,version:p.version};promotionSelection=new Map(p.items.map(item=>[String(item.menu_id),item.quantity]));
  for(const [id,key] of [["title","title"],["description","description"],["kind","kind"],["discount-type","discount_type"],["discount-value","discount_value"],["bundle-price","bundle_price"]])$("promotion-"+id).value=p[key]??"";
  $("promotion-active").checked=p.active;$("promotion-banner").checked=p.banner;$("promotion-search").value="";
  $("promotion-save").textContent="Simpan perubahan promo";promotionDirty=false;$("promotion-status").textContent="";renderPromotionPicker();
  $("promotion-form").scrollIntoView({behavior:"smooth"});
}
function renderPromotionList(){
  $("promotion-list").replaceChildren(...promotionRows.map(p=>{
    const card=el("article","","promo-list-card");card.append(el("h3",p.title),el("p",(p.active?"Aktif":"Nonaktif")+" · "+(p.kind==="bundle"?"Bundling":"Diskon menu")+(p.banner?" · Banner ditampilkan":""),"promo-help"));
    card.append(el("p",p.items.map(i=>(i.quantity+"× "+(menus.find(m=>String(m.id)===String(i.menu_id))?.nama||"Menu tidak tersedia"))).join(", "),"promo-help"));
    card.append(action("Edit promo",()=>editPromotion(p)),action(p.active?"Nonaktifkan":"Aktifkan",()=>togglePromotion(p)));
    return card;
  }));
  if(!promotionRows.length)$("promotion-list").append(el("p","Belum ada promo. Buat promo pertama di bawah.","promo-help"));
}
async function persistPromotion(payload,edit){
  await requireAdmin();
  const query=edit?client.from("menu_promotions").update({...payload,version:edit.version+1}).eq("id",edit.id).eq("version",edit.version):client.from("menu_promotions").insert(payload);
  const {data,error}=await query.select("*").single();
  if(error||!data)throw new Error("Promo gagal disimpan. Muat ulang jika admin lain telah mengubahnya. "+(error?.message||""));
  return data;
}
async function savePromotion(event){
  event.preventDefault();if(!authorized||busy||!promotionLoaded)return;
  const request=promotionRequest;
  try{
    const payload=promotionPayload(promotionInput(),menus);setBusy(true);$("promotion-status").textContent="Menyimpan promo...";
    const data=await persistPromotion(payload,promotionEdit);
    if(!authorized||request!==promotionRequest)return;
    promotionRows=[data,...promotionRows.filter(p=>p.id!==data.id)];promotionEdit={id:data.id,version:data.version};promotionDirty=false;
    renderPromotionList();$("promotion-save").textContent="Simpan perubahan promo";$("promotion-status").textContent="Promo berhasil disimpan. Muat ulang halaman pelanggan untuk melihat perubahan.";
  }catch(error){if(request===promotionRequest)$("promotion-status").textContent=error.message;}
  finally{setBusy(false);}
}
async function togglePromotion(p){
  if(!authorized||busy)return;const request=promotionRequest;
  try{
    const payload=p.active?{active:false}:promotionPayload({...p,active:true},menus);setBusy(true);
    const data=await persistPromotion(payload,p);
    if(!authorized||request!==promotionRequest)return;
    promotionRows=promotionRows.map(row=>row.id===data.id?data:row);renderPromotionList();
    $("promotion-status").textContent="Status promo berhasil diperbarui.";
    if(promotionEdit?.id===p.id&&!promotionDirty){promotionEdit={id:data.id,version:data.version};$("promotion-active").checked=data.active;}
  }catch(error){if(request===promotionRequest)$("promotion-status").textContent=error.message;}
  finally{setBusy(false);}
}
$("promotion-form").addEventListener("submit",savePromotion);
$("promotion-form").addEventListener("input",event=>{if(event.target.id!=="promotion-search"){promoDirty();previewPromotion();}});
$("promotion-kind").addEventListener("change",renderPromotionPicker);
$("promotion-search").addEventListener("input",renderPromotionPicker);
$("promotion-new").addEventListener("click",newPromotion);
$("promotion-reload").addEventListener("click",()=>{if(busy||(promotionDirty&&!confirm("Buang perubahan promo yang belum disimpan?")))return;promotionDirty=false;newPromotion();openPromotions(true);});
window.addEventListener("beforeunload",event=>{if(promotionDirty){event.preventDefault();event.returnValue="";}});
