const test=require("node:test"), assert=require("node:assert/strict"), vm=require("node:vm"),fs=require("node:fs"),path=require("node:path");
function run(expression) { const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,"../settings.js"),"utf8"),ctx);return vm.runInContext(expression,ctx); }
test("WhatsApp accepts Indonesian local and international notation, rejects links",()=>{
  assert.equal(run('normalizeWhatsApp("0812-3456-7890")'),"6281234567890");
  assert.equal(run('normalizeWhatsApp("+62 812 3456 7890")'),"6281234567890");
  for(const value of ["","https://evil.test","123","62abc12345","6281234?text=bad"]) assert.throws(()=>run("normalizeWhatsApp("+JSON.stringify(value)+")"));
});
test("category priority, menu priority, and unseen menus have stable order",()=>{
  const result=run('orderedMenus([{id:"new",kategori:"FOOD"},{id:"a",kategori:"FOOD"},{id:"b",kategori:"DRINK"},{id:"c",kategori:"FOOD"}],{category_order:["DRINK","FOOD"],menu_order:["c","a","b"]}).map(m=>m.id)');
  assert.deepEqual(Array.from(result),["b","c","a","new"]);
  assert.deepEqual(Array.from(run('orderedValues(["FOOD","SNACK","DRINK"],["DRINK"])')),["DRINK","FOOD","SNACK"]);
});
test("reorder cannot move past edges and preserves input",()=>{
  assert.deepEqual(Array.from(run('moveOrder(["a","b"],"a",-1)')),["a","b"]);
  assert.deepEqual(Array.from(run('moveOrder(["a","b"],"b",-1)')),["b","a"]);
  assert.deepEqual(Array.from(run('moveOrder(["a","b"],"missing",1)')),["a","b"]);
});
test("settings preserve literal HTML as text and reject invalid/oversized values",()=>{
  const payload={store_name:"Chef's <Store>",whatsapp:"081234567890",address:"<b>Street</b>",opening_hours:"12.00–02.00 WITA",information:"A & B",category_order:["FOOD","FOOD"],menu_order:["a"]};
  const result=run("settingsPayload("+JSON.stringify(payload)+")");
  assert.equal(result.store_name,payload.store_name);assert.equal(result.address,payload.address);
  assert.equal(result.whatsapp,"6281234567890");assert.equal(result.category_order.length,1);
  assert.throws(()=>run("settingsPayload("+JSON.stringify({...payload,store_name:" "})+")"));
  assert.throws(()=>run("settingsPayload("+JSON.stringify({...payload,information:"a".repeat(2001)})+")"));
  assert.throws(()=>run("settingsPayload("+JSON.stringify({...payload,menu_order:[null]})+")"));
});
