"use strict";
let promotionClockOffset=0;
function promotionNow(){return Date.now()+promotionClockOffset;}
function promotionStatus(p,now=promotionNow()) {
  if(p.archived)return "Diarsipkan";
  if(!p.active)return "Nonaktif";
  if(p.starts_at && Date.parse(p.starts_at)>now)return "Terjadwal";
  if(p.ends_at && Date.parse(p.ends_at)<=now)return "Berakhir";
  return "Berjalan";
}
function promotionRunning(p,now=promotionNow()){return promotionStatus(p,now)==="Berjalan";}
function fromWitaInput(value){
  if(!value)return null;
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error("Tanggal/jam promo tidak valid.");
  const stamp=Date.parse(value+":00+08:00");
  if(!Number.isFinite(stamp))throw new Error("Tanggal/jam promo tidak valid.");
  const result=new Date(stamp).toISOString();
  if(toWitaInput(result)!==value)throw new Error("Tanggal/jam promo tidak valid.");
  return result;
}
function toWitaInput(value){return value?new Date(Date.parse(value)+8*3600000).toISOString().slice(0,16):"";}
function scheduleLabel(p){return (p.starts_at?"Mulai "+toWitaInput(p.starts_at).replace("T"," "):"Mulai langsung")+" · "+(p.ends_at?"Selesai "+toWitaInput(p.ends_at).replace("T"," "):"Tanpa batas akhir")+" WITA";}
function promotionPayload(input, rows) {
  const title=String(input.title||"").trim(), description=String(input.description||"").trim();
  if (!title || title.length>100 || description.length>500) throw new Error("Isi judul promo (maksimal 100 karakter) dan keterangan maksimal 500 karakter.");
  if (!["discount","bundle"].includes(input.kind)) throw new Error("Jenis promo tidak valid.");
  if (!Array.isArray(input.items) || !input.items.length || input.items.length>50) throw new Error("Pilih 1–50 menu untuk promo.");
  const seen=new Set();
  const items=input.items.map(item=>{
    const menu=rows.find(row=>String(row.id)===String(item.menu_id)), quantity=Number(item.quantity);
    if (!menu || seen.has(String(item.menu_id)) || !Number.isInteger(quantity) || quantity<1 || quantity>99) throw new Error("Menu atau jumlah isi paket tidak valid.");
    if (input.active && !menu.aktif) throw new Error("Aktifkan semua menu yang dipilih sebelum mengaktifkan promo.");
    seen.add(String(item.menu_id));
    return {menu_id:String(item.menu_id),quantity:input.kind==="bundle"?quantity:1};
  });
  const result={title,description,kind:input.kind,items,active:!!input.active,banner:!!input.banner,discount_type:"percent",discount_value:0,bundle_price:null};
  result.banner_image_url=String(input.banner_image_url||"").trim();
  if(result.banner_image_url){let url;try{url=new URL(result.banner_image_url);}catch{}if(!url||url.protocol!=="https:"||url.username||url.password||result.banner_image_url.length>2048)throw new Error("URL gambar banner harus HTTPS yang valid.");}
  result.banner_position=Number(input.banner_position??0);
  if(!Number.isInteger(result.banner_position)||result.banner_position<0||result.banner_position>9999)throw new Error("Urutan banner harus 0–9999.");
  for(const key of ["starts_at","ends_at"]){
    result[key]=input[key]||null;
    if(result[key]&&!Number.isFinite(Date.parse(result[key])))throw new Error("Tanggal/jam promo tidak valid.");
  }
  if(result.starts_at&&result.ends_at&&Date.parse(result.ends_at)<=Date.parse(result.starts_at))throw new Error("Waktu selesai harus setelah waktu mulai.");
  if (input.kind==="bundle") {
    result.bundle_price=validPrice(input.bundle_price);
    const normal=items.reduce((sum,item)=>sum+Number(rows.find(row=>String(row.id)===item.menu_id).harga)*item.quantity,0);
    if (result.bundle_price>=normal || result.bundle_price>2147483647) throw new Error("Harga paket harus lebih rendah dari total harga normal isi paket.");
  } else {
    result.discount_type=input.discount_type; result.discount_value=Number(input.discount_value);
    if (!["percent","amount"].includes(result.discount_type) || !Number.isInteger(result.discount_value) || result.discount_value<1 || result.discount_value>2147483647 || (result.discount_type==="percent" && result.discount_value>99)) throw new Error("Diskon persen harus 1–99; potongan rupiah harus bilangan bulat positif.");
    if (items.some(item=>discountPrice(rows.find(row=>String(row.id)===item.menu_id).harga,result)<1)) throw new Error("Diskon terlalu besar. Harga setiap menu setelah diskon harus minimal Rp 1.");
  }
  return result;
}
function discountPrice(base,promo) {
  return promo.discount_type==="percent" ? Math.round(Number(base)*(100-Number(promo.discount_value))/100) : Number(base)-Number(promo.discount_value);
}
function buildOfferCatalog(rows,promotions,now=promotionNow()) {
  const active=promotions.filter(p=>promotionRunning(p,now)), result=rows.map(menu=>{
    let price=Number(menu.harga), offer=null;
    for (const p of active.filter(p=>p.kind==="discount" && p.items.some(i=>String(i.menu_id)===String(menu.id)))) {
      const candidate=discountPrice(menu.harga,p);
      if(Number.isSafeInteger(candidate) && candidate>=1 && candidate<price) {price=candidate;offer=p;}
    }
    return {...menu,harga:price,original_price:Number(menu.harga),offer_id:offer?.id,offer_title:offer?.title};
  });
  for(const p of active.filter(p=>p.kind==="bundle")) {
    const parts=p.items.map(item=>({menu:rows.find(m=>String(m.id)===String(item.menu_id)),quantity:item.quantity}));
    if(!parts.length || parts.some(part=>!part.menu || !part.menu.aktif || part.menu.tersedia===false)) continue;
    const normal=parts.reduce((sum,part)=>sum+Number(part.menu.harga)*part.quantity,0), price=Number(p.bundle_price);
    if(!Number.isSafeInteger(price)||price<1||price>=normal)continue;
    const contents=parts.map(part=>part.quantity+"× "+part.menu.nama).join(" + ");
    result.push({id:"bundle:"+p.id,nama:p.title,kategori:"PAKET",harga:price,original_price:normal,deskripsi:p.description,contents,foto_url:parts[0].menu.foto_url,aktif:true,promo:true,offer_id:p.id,offer_title:p.title,is_bundle:true,serving_parts:parts.filter(part=>/panas/i.test(part.menu.nama)&&/dingin/i.test(part.menu.nama)).map(part=>({id:String(part.menu.id),nama:part.menu.nama,quantity:part.quantity}))});
  }
  return result;
}
function priceDisplay(menu) {
  const node=el("div","","price-display");
  if(Number(menu.original_price)>Number(menu.harga)) {
    node.append(el("del",rupiah(menu.original_price),"price-old"));
    node.append(el("span","Hemat "+rupiah(menu.original_price-menu.harga),"price-saving"));
  }
  node.append(el("strong",rupiah(menu.harga),"price-new"));
  return node;
}
function orderedBanners(rows){return [...rows].sort((a,b)=>(a.banner_position||0)-(b.banner_position||0)||String(a.title).localeCompare(String(b.title),"id")||String(a.id).localeCompare(String(b.id)));}
function promotionBanner(p,candidates,onAction,previewImage){
  const first=candidates[0],banner=el("article","","promo-banner"+(p.kind==="bundle"?" bundle":"")),copy=el("div","","promo-banner-copy");
  const image=menuImage(p.banner_image_url||first.foto_url,p.title);
  if(previewImage)image.src=previewImage;
  image.className="promo-banner-image";
  if(p.banner_image_url||previewImage)banner.classList.add("custom-image");
  copy.append(el("span",p.kind==="bundle"?"Paket bundling":p.discount_type==="percent"?"Diskon "+p.discount_value+"%":"Potongan "+rupiah(p.discount_value),"promo-label"),el("h3",p.title),el("p",p.description||""));
  if(p.kind==="bundle")copy.append(el("p",first.contents),priceDisplay(first));
  else copy.append(el("p",candidates.map(m=>m.nama).join(" · ")));
  const button=action(p.kind==="bundle"?"Tambah paket +":"Lihat menu promo",onAction||(()=>{}),"promo-cta");
  if(!onAction)button.disabled=true;
  copy.append(button);banner.append(image,copy);return banner;
}
async function readPromotions(activeOnly=false) {
  const {data:clock,error:clockError}=await client.rpc("menu_server_time");
  if(clockError||typeof clock!=="string"||!Number.isFinite(Date.parse(clock)))throw new Error("Waktu promo belum bisa diperiksa. Coba lagi.");
  promotionClockOffset=Date.parse(clock)-Date.now();
  const rows=[];
  for(let offset=0;;offset+=500) {
    let query=client.from("menu_promotions").select("*").order("created_at",{ascending:false}).order("id");
    if(activeOnly)query=query.eq("active",true);
    const {data,error}=await query.range(offset,offset+499);
    if(error)throw error;
    rows.push(...data);if(data.length<500)return rows;
  }
}
