function createLogger({
  write = (line) => process.stdout.write(line + '\n'),
  now = Date.now,
} = {}) {
  const seen = new Map();
  return function log(event, fields = {}) {
    const key = [event, fields.cameraId, fields.code].join(':');
    const prior = seen.get(key);
    if (prior && now() - prior.time < 60000) {
      prior.suppressed++;
      return;
    }
    const row = { time: new Date(now()).toISOString(), event };
    for (const field of ['cameraId', 'jobId', 'code', 'imageId'])
      if (fields[field] != null) row[field] = fields[field];
    if (prior?.suppressed) row.suppressed = prior.suppressed;
    if (seen.size >= 1024) seen.delete(seen.keys().next().value);
    seen.set(key, { time: now(), suppressed: 0 });
    write(JSON.stringify(row));
  };
}
module.exports = { createLogger };
