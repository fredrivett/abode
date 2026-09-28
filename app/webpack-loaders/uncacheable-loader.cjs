// Pass-through webpack loader that opts a module out of the persistent cache.
// Applied to the Tailwind entry stylesheet — see next.config.ts.
module.exports = function uncacheableLoader(source, map, meta) {
  this.cacheable(false);
  this.callback(null, source, map, meta);
};
