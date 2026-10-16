'use strict';
const fs = require('node:fs');
const { analyze } = require('../js/engine');
const { DEMO_PACKETS } = require('../js/demo-packets');
function snapshot(packet) {
  const result = analyze(packet);
  return JSON.parse(JSON.stringify(result, (_, value) =>
    value && typeof value.n === 'bigint' ? value.toString() : typeof value === 'bigint' ? String(value) : value));
}
if (require.main === module) {
  const target = process.argv[2];
  const data = DEMO_PACKETS.map(packet => ({ id: packet.id, result: snapshot(packet) }));
  if (target) fs.writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
  else console.log(JSON.stringify(data.map(x => ({ id: x.id, summary: x.result.summary, offer: x.result.offer })), null, 2));
}
module.exports = { snapshot };
