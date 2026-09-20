"use strict";
const MENU_PUBLIC_URL="https://hpmenu81-alt.github.io/menu-digital/";
function roomPayload(input){
  const code=String(input.code||"").trim().toUpperCase(),label=String(input.label||"").trim(),floor=String(input.floor||"").trim(),position=Number(input.position);
  if(!/^[A-Z0-9][A-Z0-9_-]{0,19}$/.test(code))throw new Error("Kode room: 1–20 huruf, angka, garis bawah atau tanda hubung.");
  if(!label||label.length>60||floor.length>60)throw new Error("Isi nama room dan gunakan maksimal 60 karakter.");
  if(!Number.isInteger(position)||position<0||position>9999)throw new Error("Urutan room harus 0–9999.");
  return {code,label,floor,position,active:!!input.active};
}
async function readRooms(activeOnly=false){
  const rows=[];
  for(let offset=0;;offset+=500){
    let query=client.from("menu_rooms").select("code,label,floor,position,active,version").order("position").order("code");
    if(activeOnly)query=query.eq("active",true);
    const {data,error}=await query.range(offset,offset+499);if(error)throw error;
    if(!Array.isArray(data)||data.some(r=>!/^[A-Z0-9][A-Z0-9_-]{0,19}$/.test(r.code)||!r.label))throw new Error("Daftar room tidak valid.");
    rows.push(...data);if(data.length<500)return rows;
  }
}
function roomLink(code){const url=new URL(MENU_PUBLIC_URL);url.searchParams.set("room",code);return url.href;}
function fillRoomSelect(select,rows,selected=""){
  const placeholder=el("option","Pilih Room Karaoke 🎤");placeholder.value="";placeholder.disabled=true;select.replaceChildren(placeholder);
  const groups=new Map();
  for(const room of rows.filter(r=>r.active)){
    let parent=select;
    if(room.floor){if(!groups.has(room.floor)){const group=el("optgroup","");group.label=room.floor;groups.set(room.floor,group);select.append(group);}parent=groups.get(room.floor);}
    const option=el("option",room.label===room.code?room.code:room.code+" — "+room.label);option.value=room.code;parent.append(option);
  }
  select.value=rows.some(r=>r.active&&r.code===selected)?selected:"";
}
