function error(code) {
  return Object.assign(new Error(code), { code });
}
module.exports = { error };
