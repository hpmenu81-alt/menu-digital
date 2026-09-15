const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const source = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");
function context() {
  return vm.createContext({ supabase: { createClient: () => ({}) }, URL, document: {} });
}
test("prices reject empty, zero, negative, fractions, unsafe numbers and malformed values", () => {
  const ctx = context(); vm.runInContext(source("common.js"), ctx);
  for (const value of ["", " ", "0", "-10000", "1.5", "12abc", "Infinity", "9007199254740992"]) {
    assert.throws(() => vm.runInContext("validPrice(" + JSON.stringify(value) + ")", ctx));
  }
  assert.equal(vm.runInContext('validPrice("25000")', ctx), 25000);
});
test("editing never overwrites inactive status; new menus start active", () => {
  const ctx = context(); vm.runInContext(source("common.js"), ctx);
  const values = { nama: "Chef's Special", harga: "25000", kategori: " food ", deskripsi: "<b>Text</b>", best_seller: false, promo: false };
  const edit = vm.runInContext("menuPayload(" + JSON.stringify(values) + ", true)", ctx);
  assert.equal(Object.hasOwn(edit, "aktif"), false);
  assert.equal(edit.nama, values.nama);
  assert.equal(edit.kategori, "FOOD");
  assert.equal(vm.runInContext("menuPayload(" + JSON.stringify(values) + ", false).aktif", ctx), true);
});
test("whitespace-only categories are rejected", () => {
  const ctx = context(); vm.runInContext(source("common.js"), ctx);
  assert.throws(() => vm.runInContext('menuPayload({nama:"Tea",harga:"100",kategori:" ",deskripsi:""}, false)', ctx));
});
test("application code has no data-to-HTML or inline event construction", () => {
  for (const file of ["common.js", "admin.js", "customer.js"]) {
    assert.doesNotMatch(source(file), /innerHTML|outerHTML|insertAdjacentHTML|eval\(/);
    assert.doesNotMatch(source(file), /setAttribute\(["']on/);
  }
});
test("menu pagination keeps records beyond the first page and requests only active customer rows", async () => {
  let requests = 0, activeFilters = 0;
  const client = { from: () => ({ select() { return this; }, order() { return this; }, eq(field, value) { assert.equal(field, "aktif"); assert.equal(value, true); activeFilters++; return this; }, async range(start) { requests++; return { data: Array.from({ length: start === 0 ? 500 : 2 }, (_, n) => ({ id: start + n })) }; } }) };
  const ctx = vm.createContext({ supabase: { createClient: () => client } });
  vm.runInContext(source("common.js"), ctx);
  const result = await vm.runInContext("readMenus(true)", ctx);
  assert.equal(result.length, 502); assert.equal(requests, 2); assert.equal(activeFilters, 2);
});
