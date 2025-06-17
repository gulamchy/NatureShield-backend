// normalize.js
const unorm = require('unorm');

function normalize(text) {
  let normalized = unorm.nfd(text);
  return normalized.replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

module.exports = normalize;
