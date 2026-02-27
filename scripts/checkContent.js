import db from '../configs/db.js';
const [r] = await db.query(
    `SELECT e.event_name, COUNT(ec.id) as cnt
     FROM events e LEFT JOIN event_content ec ON ec.event_id=e.id
     GROUP BY e.id ORDER BY e.id`
);
console.log(r.map(x => `${x.cnt >= 4 ? '✅' : '❌'} ${x.event_name.slice(0, 50).padEnd(52)} [${x.cnt} paras]`).join('\n'));
process.exit(0);
