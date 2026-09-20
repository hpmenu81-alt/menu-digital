"use strict";
let promotionRows=[], promotionLoaded=false, promotionRequest=0, promotionEdit=null, promotionDirty=false;
let promotionSelection=new Map();
let promotionImageUrl="",promotionImagePreview=null;
function clearPromotionImage(){if(promotionImagePreview)URL.revokeObjectURL(promotionImagePreview);promotionImagePreview=null;$("promotion-image-file").value="";}
function validateBannerFile(file){
  const types={"image/jpeg":"jpg","image/png":"png","image/webp":"webp"};
  if(file&&(!types[file.type]||file.size===0||file.size>5*1024*1024))throw new Error("Gunakan JPG, PNG, atau WebP maksimal 5 MB.");
  return file?types[file.type]:null;
}
function promoDirty(){promotionDirty=true;$("promotion-status").textContent="Ada perubahan promo yang belum disimpan.";}
function resetPromotionEditor(){
  clearPromotionImage();promotionImageUrl="";$("promotion-banner-preview").replaceChildren();
  ++promotionRequest;promotionLoaded=false;promotionRows=[];promotionDirty=false;promotionEdit=null;promotionSelection.clear();
  $("promotion-form").reset();$("promotion-list").replaceChildren();$("promotion-picker").replaceChildren();$("promotion-status").textContent="";
}
function newPromotion(){
  if(busy || (promotionDirty&&!confirm("Buang perubahan promo yang belum disimpan?")))return;
  clearPromotionImage();promotionImageUrl="";
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
  return {banner_image_url:promotionImageUrl,banner_position:$("promotion-position").value,title:$("promotion-title").value,description:$("promotion-description").value,kind:$("promotion-kind").value,discount_type:$("promotion-discount-type").value,discount_value:$("promotion-discount-value").value,bundle_price:$("promotion-bundle-price").value,active:$("promotion-active").checked,banner:$("promotion-banner").checked,starts_at:fromWitaInput($("promotion-start").value),ends_at:fromWitaInput($("promotion-end").value),items:Array.from(promotionSelection,([menu_id,quantity])=>({menu_id,quantity}))};
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
  $("promotion-banner-preview").replaceChildren();
  if(!promotionSelection.size){node.textContent="Pilih menu untuk melihat perhitungan harga.";return;}
  try{
    const p=promotionPayload({...promotionInput(),title:$("promotion-title").value||"Pratinjau"},menus);
    const offers=buildOfferCatalog(menus,[{...p,id:"preview",active:true,starts_at:null,ends_at:null}]);
    const selected=p.kind==="bundle"?offers.filter(m=>m.is_bundle):offers.filter(m=>m.offer_id==="preview");
    if(selected.length)$("promotion-banner-preview").append(promotionBanner(p,selected,null,promotionImagePreview));
    for(const item of selected){const row=el("div",item.nama);row.append(priceDisplay(item));node.append(row);}
    if(!selected.length)node.textContent="Promo tidak tersedia: periksa menu aktif dan harga.";
  }catch(error){node.textContent=error.message;}
}
function editPromotion(p){
  if(busy||(promotionDirty&&!confirm("Buang perubahan promo yang belum disimpan?")))return;
  clearPromotionImage();promotionImageUrl=p.banner_image_url||"";$("promotion-position").value=p.banner_position||0;
  promotionEdit={id:p.id,version:p.version};promotionSelection=new Map(p.items.map(item=>[String(item.menu_id),item.quantity]));
  for(const [id,key] of [["title","title"],["description","description"],["kind","kind"],["discount-type","discount_type"],["discount-value","discount_value"],["bundle-price","bundle_price"]])$("promotion-"+id).value=p[key]??"";
  $("promotion-active").checked=p.active;$("promotion-banner").checked=p.banner;$("promotion-search").value="";
  $("promotion-start").value=toWitaInput(p.starts_at);$("promotion-end").value=toWitaInput(p.ends_at);
  $("promotion-save").textContent="Simpan perubahan promo";promotionDirty=false;$("promotion-status").textContent="";renderPromotionPicker();
  $("promotion-form").scrollIntoView({behavior:"smooth"});
}
function renderPromotionList(){
  $("promotion-list").replaceChildren(...orderedBanners(promotionRows).filter(p=>$("promotion-archive-filter").value==="archived"?p.archived:!p.archived).map(p=>{
    const card=el("article","","promo-list-card");card.append(el("h3",p.title),el("p",promotionStatus(p)+" · "+(p.kind==="bundle"?"Bundling":"Diskon menu")+(p.banner?" · Banner diaktifkan":""),"promo-help"),el("p",scheduleLabel(p),"promo-help"));
    card.append(el("p",p.items.map(i=>(i.quantity+"× "+(menus.find(m=>String(m.id)===String(i.menu_id))?.nama||"Menu tidak tersedia"))).join(", "),"promo-help"));
    if(p.archived)card.append(action("Pulihkan promo",()=>archivePromotion(p,false)));
    else card.append(action("Edit promo",()=>editPromotion(p)),action(p.active?"Nonaktifkan":"Aktifkan",()=>togglePromotion(p)),action("Arsipkan",()=>archivePromotion(p,true)));
    if(p.banner)card.append(el("p","Urutan banner: "+(p.banner_position||0),"promo-help"));
    return card;
  }));
  if(!$("promotion-list").children.length)$("promotion-list").append(el("p",$("promotion-archive-filter").value==="archived"?"Belum ada promo di arsip.":"Belum ada promo. Buat promo pertama di bawah.","promo-help"));
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
    const payload=promotionPayload(promotionInput(),menus),file=$("promotion-image-file").files[0],extension=validateBannerFile(file);
    setBusy(true);$("promotion-status").textContent="Menyimpan promo...";
    if(file){
      await requireAdmin();
      const path="banner-"+crypto.randomUUID()+"."+extension;
      const {error}=await client.storage.from("menu-images").upload(path,file,{contentType:file.type});
      if(error)throw error;
      if(!authorized||request!==promotionRequest)return;
      payload.banner_image_url=client.storage.from("menu-images").getPublicUrl(path).data.publicUrl;
    }
    const data=await persistPromotion(payload,promotionEdit);
    if(!authorized||request!==promotionRequest)return;
    promotionRows=[data,...promotionRows.filter(p=>p.id!==data.id)];promotionEdit={id:data.id,version:data.version};promotionDirty=false;
    promotionImageUrl=data.banner_image_url||"";clearPromotionImage();previewPromotion();
    renderPromotionList();adminPromotionRows=promotionRows;renderAdmin();$("promotion-save").textContent="Simpan perubahan promo";$("promotion-status").textContent="Promo berhasil disimpan. Muat ulang halaman pelanggan untuk melihat perubahan.";
  }catch(error){if(request===promotionRequest)$("promotion-status").textContent=error.message;}
  finally{setBusy(false);}
}
async function togglePromotion(p){
  if(!authorized||busy)return;const request=promotionRequest;
  try{
    const payload=p.active?{active:false}:promotionPayload({...p,active:true},menus);setBusy(true);
    const data=await persistPromotion(payload,p);
    if(!authorized||request!==promotionRequest)return;
    promotionRows=promotionRows.map(row=>row.id===data.id?data:row);adminPromotionRows=promotionRows;renderPromotionList();renderAdmin();
    $("promotion-status").textContent="Status promo berhasil diperbarui.";
    if(promotionEdit?.id===p.id&&!promotionDirty){promotionEdit={id:data.id,version:data.version};$("promotion-active").checked=data.active;}
  }catch(error){if(request===promotionRequest)$("promotion-status").textContent=error.message;}
  finally{setBusy(false);}
}
async function archivePromotion(p,archived){
  if(!authorized||busy||(promotionDirty&&!confirm("Buang perubahan promo yang belum disimpan?")))return;
  const request=promotionRequest;
  try{setBusy(true);const data=await persistPromotion({archived,active:false},p);
    if(!authorized||request!==promotionRequest)return;
    promotionRows=promotionRows.map(row=>row.id===p.id?data:row);adminPromotionRows=promotionRows;
    if(promotionEdit?.id===p.id){setBusy(false);promotionDirty=false;newPromotion();}
    renderPromotionList();renderAdmin();$("promotion-status").textContent=archived?"Promo diarsipkan dan dinonaktifkan.":"Promo dipulihkan dalam keadaan nonaktif. Periksa jadwal dan harga sebelum mengaktifkan.";
  }catch(error){if(request===promotionRequest)$("promotion-status").textContent=error.message;}finally{setBusy(false);}
}
$("promotion-archive-filter").addEventListener("change",renderPromotionList);
$("promotion-form").addEventListener("submit",savePromotion);
$("promotion-form").addEventListener("input",event=>{if(event.target.id!=="promotion-search"){promoDirty();previewPromotion();}});
$("promotion-kind").addEventListener("change",renderPromotionPicker);
$("promotion-search").addEventListener("input",renderPromotionPicker);
$("promotion-image-file").addEventListener("change",()=>{
  if(promotionImagePreview)URL.revokeObjectURL(promotionImagePreview);promotionImagePreview=null;
  try{const file=$("promotion-image-file").files[0];validateBannerFile(file);if(file)promotionImagePreview=URL.createObjectURL(file);promoDirty();previewPromotion();}
  catch(error){$("promotion-image-file").value="";previewPromotion();$("promotion-status").textContent=error.message;}
});
$("promotion-image-remove").addEventListener("click",()=>{clearPromotionImage();promotionImageUrl="";promoDirty();previewPromotion();});
$("promotion-new").addEventListener("click",newPromotion);
$("promotion-reload").addEventListener("click",()=>{if(busy||(promotionDirty&&!confirm("Buang perubahan promo yang belum disimpan?")))return;promotionDirty=false;newPromotion();openPromotions(true);});
window.addEventListener("beforeunload",event=>{if(promotionDirty){event.preventDefault();event.returnValue="";}});
