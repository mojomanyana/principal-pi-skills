// format.js — formatting helper
function formatUser(u) {
  return u.name.toUpperCase();   // line 3 — throws when u is undefined
}

module.exports = { formatUser };
