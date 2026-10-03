(function () {
  const next = new URLSearchParams(location.search).get("next");
  const target = next && /^[A-Za-z0-9_-]+\.html(\?[A-Za-z0-9_=&%.-]*)?$/.test(next) ? next : "index.html";

  if (Auth.current()) {
    location.replace(target);
    return;
  }

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));

  const notice = sessionStorage.getItem("ems.toast");
  sessionStorage.removeItem("ems.toast");

  const demos = Store.demoUsers().map((user) =>
    "<button type='button' class='demo-account' data-user='" + esc(user.username) + "' data-pass='" + esc(user.password) + "'>" +
      "<b>" + esc(user.role) + "</b><span>" + esc(user.name) + "</span><code>" + esc(user.username) + " / " + esc(user.password) + "</code>" +
    "</button>"
  ).join("");

  document.getElementById("app").innerHTML =
    "<main class='login-wrap'>" +
      "<section class='panel login-card'>" +
        "<div class='brand'>" +
          "<svg viewBox='0 0 44 44' fill='none' aria-hidden='true'><circle cx='22' cy='24' r='8' fill='#e0231c'/><path d='M6 12h32M10 17h24M22 8v26' stroke='#dfe7e0' stroke-width='1.6'/></svg>" +
          "<span><b>EMS</b><i>Employee system</i></span>" +
        "</div>" +
        "<h1>Sign in</h1>" +
        "<p class='lede'>Admins manage accounts, HR manages every record, and employees see their own profile, salary, and leave.</p>" +
        (notice ? "<p class='form-note'>" + esc(notice) + "</p>" : "") +
        "<form id='login-form' novalidate>" +
          "<div class='field'><label for='username'>Username</label><input id='username' name='username' autocomplete='username' autocapitalize='none' spellcheck='false' /></div>" +
          "<div class='field'><label for='password'>Password</label><input id='password' name='password' type='password' autocomplete='current-password' /></div>" +
          "<p class='err' id='login-error' role='alert' hidden></p>" +
          "<div class='form-actions'><button type='submit' class='btn'>Sign in</button></div>" +
        "</form>" +
        "<div class='demo'>" +
          "<p class='nav-kicker'>Sample accounts</p>" +
          "<p class='form-note'>Click one to sign in. If an admin has changed a password, use the new one.</p>" +
          "<div class='demo-list'>" + demos + "</div>" +
        "</div>" +
      "</section>" +
    "</main>";

  const form = document.getElementById("login-form");
  const error = document.getElementById("login-error");

  function attempt(username, password) {
    if (!username.trim() || !password) {
      error.textContent = "Enter a username and password.";
      error.hidden = false;
      return;
    }
    const user = Auth.login(username, password);
    if (!user) {
      error.textContent = "Username or password is incorrect.";
      error.hidden = false;
      form.elements.password.value = "";
      form.elements.password.focus();
      return;
    }
    sessionStorage.setItem("ems.toast", "Signed in as " + user.name + " (" + user.role + ").");
    location.href = target;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    attempt(form.elements.username.value, form.elements.password.value);
  });

  document.addEventListener("click", (event) => {
    const demo = event.target.closest(".demo-account");
    if (!demo) return;
    form.elements.username.value = demo.dataset.user;
    form.elements.password.value = demo.dataset.pass;
    attempt(demo.dataset.user, demo.dataset.pass);
  });

  form.elements.username.focus();
})();
