"use strict";
const CART_STORAGE_KEY="menu-digital:ppicpdjxsvylqlommdwd:cart:v1";
const CART_MAX_AGE=12*60*60*1000;
function parseSavedCart(raw,now=Date.now()) {
  try {
    const value=JSON.parse(raw);
    if(value?.version!==1 || !Number.isFinite(value.savedAt) || now-value.savedAt>CART_MAX_AGE || value.savedAt>now+60000 || !Array.isArray(value.items))return null;
    const seen=new Set(),items=[];
    for(const item of value.items.slice(0,200)) {
      if(typeof item.id!=="string"||item.id.length>100||seen.has(item.id)||!Number.isInteger(item.qty)||item.qty<1||item.qty>99)continue;
      let servings;
      if(item.servings&&typeof item.servings==="object")servings=Object.fromEntries(Object.entries(item.servings).slice(0,50).filter(([key])=>key.length<=100).map(([key,v])=>[key,{hot:Number.isInteger(v?.hot)&&v.hot>=0&&v.hot<=9801?v.hot:0,cold:Number.isInteger(v?.cold)&&v.cold>=0&&v.cold<=9801?v.cold:0}]));
      seen.add(item.id);items.push({...servings?{servings}:{},id:item.id,qty:item.qty,catatan:typeof item.catatan==="string"?item.catatan.slice(0,300):""});
    }
    return {room:typeof value.room==="string"?value.room.slice(0,20):"",items};
  }catch{return null;}
}
function readSavedCart(){try{return parseSavedCart(localStorage.getItem(CART_STORAGE_KEY));}catch{return null;}}
function writeSavedCart(selectedRoom,items){
  try{localStorage.setItem(CART_STORAGE_KEY,JSON.stringify({version:1,savedAt:Date.now(),room:selectedRoom,items:Array.from(items,item=>({id:String(item.id),qty:item.qty,catatan:item.catatan,...item.servings?{servings:item.servings}:{}}))}));return true;}catch{return false;}
}
