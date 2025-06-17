// invasiveList.js
const fs = require('fs');
const normalize = require('./normalize');

const rawList = fs.readFileSync('invasive_species.txt', 'utf-8');
const INVASIVE_LIST = new Set(
  rawList
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(normalize)
);

module.exports = INVASIVE_LIST;
