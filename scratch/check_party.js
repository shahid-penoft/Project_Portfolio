import db from '../configs/db.js';

async function main() {
  const [cols] = await db.query('SHOW COLUMNS FROM governing_representatives');
  console.log('Has party col:', cols.some(c => c.Field === 'party'));

  const [partyRows] = await db.query("SELECT * FROM mla_dropdown_lists WHERE module = 'Governing Bodies' OR `key` LIKE '%party%'");
  console.log('Governing dropdown keys:', [...new Set(partyRows.map(r => r.key))]);
  console.log('Governing dropdown items:', partyRows.map(r => ({ id: r.id, key: r.key, label: r.label, value: r.value })));
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
