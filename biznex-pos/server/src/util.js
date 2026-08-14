/** Local-timezone helpers. SQLite stores datetimes via datetime('now','localtime')
 *  as 'YYYY-MM-DD HH:MM:SS', so all JS-generated timestamps and query bounds
 *  must use the same local 'YYYY-MM-DD HH:MM:SS' / 'YYYY-MM-DD' formats. */

const pad = (n) => String(n).padStart(2, '0');

/** Local date as 'YYYY-MM-DD'. */
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Local datetime as 'YYYY-MM-DD HH:MM:SS'. */
export function localIso(d = new Date()) {
  return `${localDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
