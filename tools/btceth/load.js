// Loads tools/engine.js and tools/btceth/configs.js into one context for Node (tests and replay), exactly as the page holds them.
const fs = require("fs"), path = require("path"), vm = require("vm");
module.exports = function load() {
  const ctx = { console, Math, Date, JSON, Number, String, Array, Object, Infinity, NaN, isNaN, parseFloat, parseInt };
  vm.createContext(ctx);
  for (const f of ["../engine.js", "configs.js"]) vm.runInContext(fs.readFileSync(path.join(__dirname, f), "utf8"), ctx, { filename: f });
  return ctx;
};
