// Loads tools/engine.js, tools/btceth/configs.js and tools/top50/top.js into one context for Node, as the page holds them.
const fs = require("fs"), path = require("path"), vm = require("vm");
module.exports = function load() {
  const ctx = { console, Math, Date, JSON, Number, String, Array, Object, Infinity, NaN, isNaN, parseFloat, parseInt };
  vm.createContext(ctx);
  for (const f of ["../engine.js", "../btceth/configs.js", "top.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), ctx, { filename: f });
  return ctx;
};
