const db = {
  find(id: number) {
    return { id, name: "user" + id };
  },
};

function render(...parts: unknown[]): number {
  return parts.length;
}

export function getUser(id: number) {
  return db.find(id);
}

export function showDashboard(uid: number): number {
  const a = getUser(1);
  const b = getUser(2);
  return render(a, b, getUser(uid));
}
