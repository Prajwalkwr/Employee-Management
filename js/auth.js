/* Browser-only sign-in. It separates roles in the interface; it is not a security boundary. */
const Auth = (() => {
  const KEY = "ems.session.v1";

  function current() {
    const id = Number(localStorage.getItem(KEY));
    return id ? Store.get("users", id) : null;
  }

  function login(username, password) {
    const name = String(username || "").trim().toLowerCase();
    const user = Store.all("users").find((row) => row.username === name && row.password === password);
    if (!user) return null;
    localStorage.setItem(KEY, String(user.id));
    return user;
  }

  function logout() {
    localStorage.removeItem(KEY);
  }

  return { current, login, logout };
})();
