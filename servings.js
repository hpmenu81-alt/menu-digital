"use strict";
// Only existing menu names explicitly offering both temperatures need a choice.
function temperatureMenu(menu){return /panas/i.test(menu.nama)&&/dingin/i.test(menu.nama);}
function servingParts(item){
  return item.is_bundle?(item.serving_parts||[]):temperatureMenu(item)?[{id:String(item.id),nama:item.nama,quantity:1}]:[];
}
function normalizeServings(item,stored={}){
  const result={};
  for(const part of servingParts(item)){
    const required=part.quantity*item.qty,old=stored?.[part.id];
    const count=value=>Number.isInteger(value)&&value>=0?value:0;
    const hot=Math.min(required,count(old?.hot)),cold=Math.min(required-hot,count(old?.cold));
    result[part.id]={hot,cold};
  }
  return result;
}
function servingsComplete(item){return servingParts(item).every(p=>{const v=item.servings?.[p.id];return v&&Number.isInteger(v.hot)&&Number.isInteger(v.cold)&&v.hot>=0&&v.cold>=0&&v.hot+v.cold===p.quantity*item.qty;});}
function servingDescription(item){return servingParts(item).map(p=>p.nama+": "+item.servings[p.id].hot+" panas, "+item.servings[p.id].cold+" dingin").join("; ");}
