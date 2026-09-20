"use strict";
let operationsRequest=0,adminRooms=[],roomsLoaded=false,roomEdit=null,roomDirty=false,historyCursor=null,historyLoading=false,historyRequest=0;
function resetOperations(){
  ++operationsRequest;++historyRequest;adminRooms=[];roomsLoaded=false;roomEdit=null;roomDirty=false;historyCursor=null;historyLoading=false;
  $("room-form").reset();$("room-code").disabled=false;$("room-list").replaceChildren();$("room-qr").replaceChildren();$("history-list").replaceChildren();$("dashboard-cards").replaceChildren();
  for(const id of ["room-status","history-status","dashboard-status"])$(id).textContent="";
}
function dashboardCounts(rows,promos,rooms){return [["Menu aktif",rows.filter(m=>m.aktif).length],["Siap dipesan",rows.filter(m=>m.aktif&&m.tersedia!==false).length],["Habis sementara",rows.filter(m=>m.aktif&&m.tersedia===false).length],["Menu nonaktif",rows.filter(m=>!m.aktif).length],["Promo berjalan",promos.filter(p=>promotionRunning(p)).length],["Room aktif",rooms.filter(r=>r.active).length]];}
async function refreshDashboard(){
  if(!authorized||busy)return;const request=++operationsRequest;$("dashboard-status").textContent="Memuat ringkasan...";
  try{const [rows,promos,rooms]=await Promise.all([readMenus(),readPromotions(),readRooms()]);
    if(!authorized||request!==operationsRequest)return;
    menus=rows;adminPromotionRows=promos;adminRooms=rooms;
    $("dashboard-cards").replaceChildren(...dashboardCounts(rows,promos,rooms).map(([label,count])=>{const node=el("article","","dashboard-card");node.append(el("strong",String(count)),el("span",label));return node;}));
    $("dashboard-status").textContent="Diperbarui "+new Date().toLocaleString("id-ID",{timeZone:"Asia/Makassar"})+" WITA. Promo berjalan mengikuti status aktif dan jadwal.";
  }catch(error){if(request===operationsRequest){$("dashboard-cards").replaceChildren();$("dashboard-status").textContent="Gagal memuat ringkasan. "+error.message;}}
}
function newRoom(){
  if(busy||(roomDirty&&!confirm("Buang perubahan room yang belum disimpan?")))return;
  roomEdit=null;roomDirty=false;$("room-form").reset();$("room-code").disabled=false;$("room-status").textContent="";$("room-save").textContent="Simpan room";
}
async function openRooms(force=false){
  if(!authorized||busy||(!force&&roomsLoaded))return;const request=++operationsRequest;$("room-status").textContent="Memuat room...";$("room-save").disabled=true;
  try{const rows=await readRooms();if(!authorized||request!==operationsRequest)return;adminRooms=rows;roomsLoaded=true;renderRooms();$("room-status").textContent="";}
  catch(error){if(request===operationsRequest)$("room-status").textContent="Gagal memuat room: "+error.message;}
  finally{if(request===operationsRequest)$("room-save").disabled=!roomsLoaded;}
}
function editRoom(row){
  if(busy||(roomDirty&&!confirm("Buang perubahan room yang belum disimpan?")))return;
  roomEdit={code:row.code,version:row.version};roomDirty=false;
  for(const key of ["code","label","floor","position"])$("room-"+key).value=row[key];
  $("room-active").checked=row.active;$("room-code").disabled=true;$("room-save").textContent="Simpan perubahan room";$("room-status").textContent="Kode tetap agar QR lama tetap menuju room yang sama.";$("room-form").scrollIntoView({behavior:"smooth"});
}
function renderRooms(){
  const keyword=$("room-search").value.toLowerCase();
  const rows=adminRooms.filter(r=>[r.code,r.label,r.floor].join(" ").toLowerCase().includes(keyword));
  $("room-list").replaceChildren(...rows.map(row=>{
    const node=el("article","","operation-card");node.append(el("h3",row.code+" — "+row.label),el("p",(row.floor||"Tanpa kelompok")+" · Urutan "+row.position+" · "+(row.active?"Aktif":"Nonaktif"),"promo-help"));
    const controls=el("div","","operation-controls");controls.append(action("Edit room",()=>editRoom(row)),action(row.active?"Nonaktifkan room":"Aktifkan room",()=>toggleRoom(row)));
    if(row.active)controls.append(action("Lihat / unduh QR",()=>showRoomQR(row)));
    node.append(controls);return node;
  }));
  if(!rows.length)$("room-list").append(el("p","Tidak ada room yang cocok."));
}
async function persistRoom(payload,edit){
  await requireAdmin();
  const query=edit?client.from("menu_rooms").update({...payload,version:edit.version+1}).eq("code",edit.code).eq("version",edit.version):client.from("menu_rooms").insert(payload);
  const {data,error}=await query.select("*").single();
  if(error||!data)throw new Error("Room gagal disimpan. Kode mungkin sudah digunakan atau data berubah; muat ulang lalu coba lagi. "+(error?.message||""));
  return data;
}
async function saveRoom(event){
  event.preventDefault();if(!authorized||busy||!roomsLoaded)return;const request=operationsRequest;
  try{const payload=roomPayload(Object.fromEntries(["code","label","floor","position"].map(k=>[k,$("room-"+k).value]).concat([["active",$("room-active").checked]])));setBusy(true);
    const data=await persistRoom(payload,roomEdit);if(!authorized||request!==operationsRequest)return;
    adminRooms=[data,...adminRooms.filter(r=>r.code!==data.code)].sort((a,b)=>a.position-b.position||a.code.localeCompare(b.code));roomEdit={code:data.code,version:data.version};roomDirty=false;renderRooms();$("room-qr").replaceChildren();$("room-status").textContent="Room tersimpan. Muat ulang halaman pelanggan untuk melihat perubahan.";
  }catch(error){if(request===operationsRequest)$("room-status").textContent=error.message;}finally{setBusy(false);}
}
async function toggleRoom(row){
  if(!authorized||busy)return;const request=operationsRequest;
  try{setBusy(true);const data=await persistRoom({active:!row.active},row);if(!authorized||request!==operationsRequest)return;
    adminRooms=adminRooms.map(r=>r.code===row.code?data:r);renderRooms();$("room-qr").replaceChildren();
    if(roomEdit?.code===row.code&&!roomDirty){roomEdit={code:data.code,version:data.version};$("room-active").checked=data.active;}
    $("room-status").textContent=data.active?"Room diaktifkan.":"Room dinonaktifkan. QR lama akan meminta pelanggan memilih room aktif.";
  }catch(error){if(request===operationsRequest)$("room-status").textContent=error.message;}finally{setBusy(false);}
}
function roomQRCanvas(row){
  const qr=qrcode(0,"M");qr.addData(roomLink(row.code));qr.make();const size=qr.getModuleCount(),cell=10,margin=4,width=(size+margin*2)*cell;
  const canvas=el("canvas","");canvas.width=width;canvas.height=width+72;const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,width,canvas.height);ctx.fillStyle="#000";
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(qr.isDark(y,x))ctx.fillRect((x+margin)*cell,(y+margin)*cell,cell,cell);
  ctx.font="bold 24px sans-serif";ctx.textAlign="center";ctx.fillText("ROOM "+row.code,width/2,width+24,width-30);ctx.font="16px sans-serif";ctx.fillText("Scan untuk membuka menu",width/2,width+53);
  canvas.setAttribute("aria-label","QR menu untuk room "+row.code);canvas.setAttribute("role","img");return canvas;
}
function showRoomQR(row){
  const node=$("room-qr");node.replaceChildren();
  try{const canvas=roomQRCanvas(row),link=el("a","Unduh QR PNG","download-qr");link.href=canvas.toDataURL("image/png");link.download="room-"+row.code+".png";
    const url=el("input","");url.readOnly=true;url.value=roomLink(row.code);url.setAttribute("aria-label","Tautan menu room "+row.code);
    node.append(el("h3","QR Room "+row.code),canvas,url,link,el("p","Kode room tetap. Simpan atau cetak PNG, lalu coba pindai dengan kamera HP.","promo-help"));node.scrollIntoView({behavior:"smooth"});
  }catch{node.append(el("p","QR belum dapat dibuat. Muat ulang halaman lalu coba lagi."));}
}
const historyFields={harga:"Harga",tersedia:"Tersedia",aktif:"Menu aktif",active:"Aktif",archived:"Arsip",title:"Judul promo",nama:"Nama menu",label:"Nama room",floor:"Kelompok room",position:"Urutan room",code:"Kode room",banner:"Banner",banner_image_url:"Gambar banner",banner_position:"Urutan banner",starts_at:"Mulai promo",ends_at:"Selesai promo",discount_value:"Nilai diskon",bundle_price:"Harga paket",items:"Isi promo",store_name:"Nama toko",whatsapp:"WhatsApp",deskripsi:"Deskripsi",description:"Keterangan",foto_url:"Foto",kategori:"Kategori",best_seller:"Favorit",discount_type:"Jenis diskon",kind:"Jenis promo",category_order:"Urutan kategori",menu_order:"Urutan menu",address:"Alamat",opening_hours:"Jam buka",information:"Informasi"};
function historyValue(value,key){
  if(value===null||value===undefined)return "—";if(typeof value==="boolean")return value?"Ya":"Tidak";
  if(["harga","bundle_price"].includes(key))return rupiah(value);
  if(["starts_at","ends_at"].includes(key))return new Date(value).toLocaleString("id-ID",{timeZone:"Asia/Makassar"})+" WITA";
  if(key==="items"&&Array.isArray(value))return value.map(i=>(i.quantity+"× "+(menus.find(m=>String(m.id)===String(i.menu_id))?.nama||i.menu_id))).join(", ");
  if(key==="menu_order"&&Array.isArray(value))return value.map(id=>menus.find(m=>String(m.id)===String(id))?.nama||id).join(", ");
  return typeof value==="object"?JSON.stringify(value):String(value);
}
async function loadHistory(more=false){
  if(!authorized||busy||(more&&historyLoading))return;
  const request=++historyRequest;historyLoading=true;$("history-more").disabled=true;$("history-status").textContent="Memuat riwayat...";
  if(!more){historyCursor=null;$("history-list").replaceChildren();}
  try{let query=client.from("menu_audit_log").select("id,created_at,actor_id,actor_label,entity,record_label,operation,changes").order("id",{ascending:false});
    const filter=$("history-filter").value;if(filter!="all")query=query.eq("entity",filter);if(more&&historyCursor)query=query.lt("id",historyCursor);
    const {data,error}=await query.limit(30);if(error)throw error;if(!authorized||request!==historyRequest)return;
    const fragment=document.createDocumentFragment();
    for(const row of data){const card=el("article","","operation-card"),details=el("details",""),list=el("dl","","audit-changes");
      card.append(el("h3",({INSERT:"Menambahkan",UPDATE:"Mengubah",DELETE:"Menghapus"})[row.operation]+" "+row.record_label),el("p",row.actor_label+" · "+new Date(row.created_at).toLocaleString("id-ID",{timeZone:"Asia/Makassar"})+" WITA","promo-help"));
      details.append(el("summary","Lihat perubahan"));
      for(const [key,change] of Object.entries(row.changes)){if(key==="id")continue;list.append(el("dt",historyFields[key]||key),el("dd",historyValue(change.before,key)+" → "+historyValue(change.after,key)));}
      details.append(list);card.append(details);fragment.append(card);
    }
    $("history-list").append(fragment);historyCursor=data.length?data[data.length-1].id:historyCursor;
    $("history-more").hidden=data.length<30;$("history-status").textContent=$("history-list").children.length?"Riwayat terbaru ditampilkan lebih dahulu.":"Belum ada perubahan tercatat sejak fitur ini dipasang.";
  }catch(error){if(request===historyRequest)$("history-status").textContent="Gagal memuat riwayat: "+error.message;}
  finally{if(request===historyRequest){historyLoading=false;$("history-more").disabled=false;}}
}
$("dashboard-refresh").addEventListener("click",refreshDashboard);
$("room-form").addEventListener("submit",saveRoom);
$("room-form").addEventListener("input",()=>{roomDirty=true;$("room-status").textContent="Ada perubahan room yang belum disimpan.";});
$("room-new").addEventListener("click",newRoom);
$("room-search").addEventListener("input",renderRooms);
$("room-reload").addEventListener("click",()=>{if(busy||(roomDirty&&!confirm("Buang perubahan room yang belum disimpan?")))return;roomDirty=false;newRoom();openRooms(true);});
$("history-filter").addEventListener("change",()=>loadHistory());
$("history-refresh").addEventListener("click",()=>loadHistory());
$("history-more").addEventListener("click",()=>loadHistory(true));
window.addEventListener("beforeunload",event=>{if(roomDirty){event.preventDefault();event.returnValue="";}});
