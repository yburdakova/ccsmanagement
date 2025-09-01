// ================================
// Time utils
// ================================

function formatMySQLDatetime(date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000) 
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
}

function parseSqliteDate(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    return new Date(raw.replace(' ', 'T'));
  }
  if (raw instanceof Date) return raw;
  throw new Error('Unsupported date format: ' + raw);
}

function parseMysqlDate(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') {
    return new Date(raw.replace(' ', 'T') + 'Z'); 
  }
  if (raw instanceof Date) return raw;
  throw new Error('Unsupported date format: ' + raw);
}

function diffMinutes(start, end) {
  return Math.round(((end.getTime() - start.getTime()) / 60000) * 100) / 100;

}

module.exports = {
  formatMySQLDatetime,
  parseSqliteDate,
  parseMysqlDate,
  diffMinutes,
}