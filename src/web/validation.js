const { dayStart } = require('../history/service');
function apiError(code, status = 400) {
  return Object.assign(Error(code), { code, status });
}
function positive(value, name, min = 1) {
  if (!Number.isSafeInteger(value) || value < min) throw apiError('INVALID_' + name);
  return value;
}
function cleanNvr(n) {
  const { secret, password, ...safe } = n;
  return safe;
}
function cleanImage(i, nas) {
  const { localPath, nasPath, relativePath, absentTours, ...safe } = i;
  return {
    ...safe,
    availability:
      i.state === 'transferred' && !nas.status().available && i.availability !== 'missing'
        ? 'unavailable'
        : i.availability,
  };
}
function range(query) {
  if (query.day) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(query.day) || !Number.isFinite(dayStart(query.day)))
      throw apiError('INVALID_DATE');
    const from = dayStart(query.day);
    return { from, to: from + 86400000 };
  }
  const from = query.from == null ? 0 : Number(query.from),
    to = query.to == null ? Date.now() + 1 : Number(query.to);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) throw apiError('INVALID_DATE');
  return { from, to };
}

module.exports = { apiError, positive, cleanNvr, cleanImage, range };
