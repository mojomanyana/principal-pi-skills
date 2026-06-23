// greet.js — users is a known, populated array
const { formatUser } = require('./format');

const users = [
  { id: 1, name: 'Ada' },
  { id: 2, name: 'Lin' },
];

function greet(id) {
  const u = users.find(x => x.id === id);   // undefined when id is not found
  return 'Hi ' + formatUser(u);             // line 8
}

module.exports = { greet };
