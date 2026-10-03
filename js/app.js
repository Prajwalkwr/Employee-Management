(function () {
  const pageEntity = document.body.dataset.entity;
  const me = Auth.current();
  let dialogResolve = null;

  const ROLES = ["Admin", "HR", "Employee"];

  /* write: full control · read: list and details · self: only records tied to the account's employee */
  const ACCESS = {
    Admin: { employees: "write", designations: "write", departments: "write", salaries: "write", vacancies: "write", leaves: "write", users: "write" },
    HR: { employees: "write", designations: "write", departments: "write", salaries: "write", vacancies: "write", leaves: "write" },
    Employee: { employees: "self", salaries: "self", leaves: "self", vacancies: "read" }
  };

  const NAV = [
    ["employees", "index.html", "Employees", "My profile"],
    ["designations", "designation.html", "Designations"],
    ["departments", "department.html", "Departments"],
    ["salaries", "salary.html", "Salaries", "My salary"],
    ["vacancies", "vacancy.html", "Vacancies"],
    ["leaves", "leave.html", "Leave", "My leave"],
    ["users", "accounts.html", "Accounts"]
  ];

  function level(entity) {
    return me ? (ACCESS[me.role] || {})[entity] || null : null;
  }

  function owns(entity, row) {
    if (!me || !me.employeeId || !row) return false;
    return entity === "employees" ? row.id === me.employeeId : row.employeeId === me.employeeId;
  }

  function can(action, entity, row) {
    const lv = level(entity);
    if (!lv) return false;
    if (entity === "users" && action === "delete" && row && row.id === me.id) return false;
    if (lv === "write") return true;
    if (action === "view") return lv === "read" || !row || owns(entity, row);
    if (lv === "self" && entity === "leaves") {
      if (action === "create") return Boolean(me.employeeId);
      if (action === "edit" || action === "delete") return owns(entity, row) && row.status === "Pending";
    }
    return false;
  }

  function homeHref() {
    return level("employees") === "self" && me.employeeId ? "employeeDetails.html?id=" + me.employeeId : "index.html";
  }

  function employeeOptions() {
    return Store.all("employees").map((row) => ({ value: row.id, label: row.firstName + " " + row.lastName }));
  }

  const SCHEMAS = {
    employees: {
      key: "employees",
      title: "Employees",
      listTitle: "Employee list",
      singular: "Employee",
      blurb: "Keep every person on the books: contact details, department, designation, and the note that came with them.",
      selfBlurb: "Your profile, salary, and leave, as HR has recorded them.",
      addLabel: "Add new employee",
      deleteNote: "Their salary records, leave records, and employee login will also be removed.",
      routes: {
        list: "index.html",
        create: "addNewEmpoyee.html",
        edit: (id) => "updateEmpoyee.html?id=" + id,
        view: (id) => "employeeDetails.html?id=" + id
      },
      fields: [
        { key: "firstName", label: "First name", required: true },
        { key: "lastName", label: "Last name", required: true },
        { key: "email", label: "Email", type: "email", required: true },
        { key: "address", label: "Address", required: true, wide: true },
        { key: "phone", label: "Phone", type: "tel", required: true },
        { key: "joinDate", label: "Join date", type: "date", required: true },
        { key: "departmentId", label: "Department", type: "select", required: true, options: () => Store.all("departments").map((row) => ({ value: row.id, label: row.name })) },
        { key: "designationId", label: "Designation", type: "select", required: true, options: () => Store.all("designations").map((row) => ({ value: row.id, label: row.name })) },
        { key: "remark", label: "Remark", type: "textarea", wide: true }
      ],
      columns: [
        { key: "id", label: "Id" },
        { key: "firstName", label: "First" },
        { key: "lastName", label: "Last" },
        { key: "email", label: "Email" },
        { key: "address", label: "Address" },
        { key: "phone", label: "Phone" },
        { key: "departmentId", label: "Department", value: (row) => nameOf("departments", row.departmentId, "name") },
        { key: "joinDate", label: "Join date", value: (row) => fmtDate(row.joinDate) },
        { key: "remark", label: "Remark" }
      ],
      validate(data, errors, id) {
        if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) errors.email = "Enter a valid email address.";
        if (data.phone && !/^[0-9+\-\s()]{7,16}$/.test(data.phone)) errors.phone = "Enter a phone number with 7 to 16 digits.";
        if (data.email && Store.all("employees").some((row) => row.email.toLowerCase() === data.email.toLowerCase() && row.id !== id)) {
          errors.email = "An employee with this email already exists.";
        }
      },
      extras(record) {
        const salaries = Store.all("salaries").filter((row) => row.employeeId === record.id);
        const leaves = Store.all("leaves").filter((row) => row.employeeId === record.id);
        const salaryRows = salaries.length
          ? salaries.map((row) => "<tr><td>" + money(row.basic) + "</td><td>" + money(row.allowance) + "</td><td>" + money(row.tax) + "</td><td>" + money(row.net) + "</td><td>" + esc(row.remark || "—") + "</td></tr>").join("")
          : "<tr><td colspan='5'>No salary record yet.</td></tr>";
        const leaveRows = leaves.length
          ? leaves.map((row) => "<tr><td>" + esc(row.subject) + "</td><td>" + esc(row.duration) + "</td><td>" + esc(fmtDate(row.date)) + "</td><td>" + pill(row.status) + "</td></tr>").join("")
          : "<tr><td colspan='4'>No leave records yet.</td></tr>";
        const staff = level("leaves") === "write";
        const salaryAdd = can("create", "salaries")
          ? "<div class='form-actions'><a class='btn btn-ghost' href='salary.html?action=new&employee=" + record.id + "'>Add salary</a></div>"
          : "";
        const leaveAdd = can("create", "leaves")
          ? "<div class='form-actions'><a class='btn btn-ghost' href='leave.html?action=new" + (staff ? "&employee=" + record.id : "") + "'>" + (staff ? "Add leave" : "Request leave") + "</a></div>"
          : "";
        let account = "";
        if (level("users") === "write") {
          const login = Store.all("users").find((row) => row.employeeId === record.id);
          account = "<div><h3>Login</h3>" + (login
            ? "<p>" + esc(login.username) + " · " + esc(login.role) + "</p><div class='form-actions'><a class='btn btn-ghost' href='accounts.html?action=edit&id=" + login.id + "'>Edit login</a></div>"
            : "<p class='form-note'>No login yet.</p><div class='form-actions'><a class='btn btn-ghost' href='accounts.html?action=new&employee=" + record.id + "'>Create login</a></div>") +
            "</div>";
        }
        return (
          "<div class='extras'>" +
            "<div><h3>Salary</h3><table class='mini'><thead><tr><th>Basic</th><th>Allowance</th><th>Tax</th><th>Net</th><th>Remark</th></tr></thead><tbody>" + salaryRows + "</tbody></table>" + salaryAdd + "</div>" +
            "<div><h3>Leave</h3><table class='mini'><thead><tr><th>Subject</th><th>Duration</th><th>Date</th><th>Status</th></tr></thead><tbody>" + leaveRows + "</tbody></table>" + leaveAdd + "</div>" +
            account +
          "</div>"
        );
      }
    },
    designations: {
      key: "designations",
      title: "Designations",
      listTitle: "Designation list",
      singular: "Designation",
      blurb: "Name the roles people hold, and keep a short remark about what that role is for.",
      addLabel: "Add designation",
      routes: {
        list: "designation.html",
        create: "designation.html?action=new",
        edit: (id) => "designation.html?action=edit&id=" + id,
        view: (id) => "designation.html?action=view&id=" + id
      },
      fields: [
        { key: "name", label: "Designation name", required: true },
        { key: "remark", label: "Remark", type: "textarea", required: true, wide: true }
      ],
      columns: [
        { key: "id", label: "Id" },
        { key: "name", label: "Designation name" },
        { key: "remark", label: "Remark" }
      ],
      validate(data, errors, id) {
        if (data.name && Store.all("designations").some((row) => row.name.toLowerCase() === data.name.toLowerCase() && row.id !== id)) {
          errors.name = "A designation with this name already exists.";
        }
      },
      extras(record) {
        return peopleTable(Store.all("employees").filter((row) => row.designationId === record.id));
      }
    },
    departments: {
      key: "departments",
      title: "Departments",
      listTitle: "Department list",
      singular: "Department",
      blurb: "Track where each team sits, who leads it, and the number used on internal records.",
      addLabel: "Add department",
      deleteNote: "This removes the department from this browser.",
      routes: {
        list: "department.html",
        create: "department.html?action=new",
        edit: (id) => "department.html?action=edit&id=" + id,
        view: (id) => "department.html?action=view&id=" + id
      },
      fields: [
        { key: "name", label: "Department name", required: true },
        { key: "location", label: "Location", required: true },
        { key: "block", label: "Block", required: true },
        { key: "hod", label: "Head of department", required: true },
        { key: "number", label: "Department number", required: true }
      ],
      columns: [
        { key: "id", label: "Id" },
        { key: "name", label: "Department name" },
        { key: "location", label: "Location" },
        { key: "block", label: "Block" },
        { key: "hod", label: "HOD" },
        { key: "number", label: "Number" }
      ],
      validate(data, errors, id) {
        if (data.name && Store.all("departments").some((row) => row.name.toLowerCase() === data.name.toLowerCase() && row.id !== id)) {
          errors.name = "A department with this name already exists.";
        }
      },
      extras(record) {
        return peopleTable(Store.all("employees").filter((row) => row.departmentId === record.id));
      }
    },
    salaries: {
      key: "salaries",
      title: "Salaries",
      selfTitle: "My salary",
      listTitle: "Salary list",
      singular: "Salary",
      blurb: "Gross pay is basic salary plus allowance. Net pay is gross minus tax.",
      selfBlurb: "Your salary records. Gross is basic plus allowance, and net is gross minus tax.",
      addLabel: "Add salary",
      formNote: "Gross and net update as you type. Tax cannot be higher than gross pay.",
      routes: {
        list: "salary.html",
        create: "salary.html?action=new",
        edit: (id) => "salary.html?action=edit&id=" + id,
        view: (id) => "salary.html?action=view&id=" + id
      },
      fields: [
        { key: "employeeId", label: "Employee", type: "select", required: true, wide: true, options: employeeOptions },
        { key: "basic", label: "Basic salary (NPR)", type: "number", required: true, money: true },
        { key: "allowance", label: "Allowance (NPR)", type: "number", required: true, money: true },
        { key: "tax", label: "Tax (NPR)", type: "number", required: true, money: true },
        { key: "gross", label: "Gross salary (NPR)", type: "readonly", money: true },
        { key: "net", label: "Net salary (NPR)", type: "readonly", money: true },
        { key: "remark", label: "Remark", type: "textarea", wide: true }
      ],
      columns: [
        { key: "id", label: "Id" },
        { key: "employeeId", label: "Employee", value: (row) => personName(row.employeeId) },
        { key: "basic", label: "Basic", value: (row) => money(row.basic) },
        { key: "allowance", label: "Allowance", value: (row) => money(row.allowance) },
        { key: "tax", label: "Tax", value: (row) => money(row.tax) },
        { key: "gross", label: "Gross", value: (row) => money(row.gross) },
        { key: "net", label: "Net", value: (row) => money(row.net) },
        { key: "remark", label: "Remark" }
      ],
      beforeSave(data) {
        data.basic = Number(data.basic) || 0;
        data.allowance = Number(data.allowance) || 0;
        data.tax = Number(data.tax) || 0;
        data.gross = data.basic + data.allowance;
        data.net = data.gross - data.tax;
        data.employeeId = Number(data.employeeId);
        return data;
      },
      validate(data, errors) {
        ["basic", "allowance", "tax"].forEach((key) => {
          if (data[key] !== "" && data[key] !== undefined && Number(data[key]) < 0) errors[key] = "Use a number that is zero or greater.";
        });
        if (Number(data.tax) > Number(data.basic) + Number(data.allowance)) errors.tax = "Tax cannot be greater than basic salary plus allowance.";
      }
    },
    vacancies: {
      key: "vacancies",
      title: "Vacancies",
      listTitle: "Vacancy list",
      singular: "Vacancy",
      blurb: "Publish open roles with the count, the company, and the experience you expect.",
      selfBlurb: "Open roles across the company.",
      addLabel: "Add vacancy",
      routes: {
        list: "vacancy.html",
        create: "vacancy.html?action=new",
        edit: (id) => "vacancy.html?action=edit&id=" + id,
        view: (id) => "vacancy.html?action=view&id=" + id
      },
      fields: [
        { key: "position", label: "Position", required: true },
        { key: "count", label: "Number of vacancies", type: "number", required: true, min: 1 },
        { key: "company", label: "Company name", required: true },
        { key: "qualification", label: "Qualification", required: true },
        { key: "experience", label: "Experience", required: true },
        { key: "remark", label: "Remark", type: "textarea", wide: true }
      ],
      columns: [
        { key: "id", label: "Id" },
        { key: "position", label: "Position" },
        { key: "count", label: "Openings" },
        { key: "company", label: "Company" },
        { key: "qualification", label: "Qualification" },
        { key: "experience", label: "Experience" },
        { key: "remark", label: "Remark" }
      ],
      beforeSave(data) {
        data.count = Number(data.count) || 0;
        return data;
      },
      validate(data, errors) {
        if (data.count !== "" && (!Number.isInteger(Number(data.count)) || Number(data.count) < 1)) {
          errors.count = "Enter at least 1 opening.";
        }
      }
    },
    leaves: {
      key: "leaves",
      title: "Leave",
      selfTitle: "My leave",
      listTitle: "Leave list",
      singular: "Leave",
      blurb: "Record a request, then approve or reject it from the list. Pending items stay marked until you decide.",
      selfBlurb: "Request time off and follow its status. You can change or cancel a request while it is still pending.",
      addLabel: "Add leave",
      selfAddLabel: "Request leave",
      routes: {
        list: "leave.html",
        create: "leave.html?action=new",
        edit: (id) => "leave.html?action=edit&id=" + id,
        view: (id) => "leave.html?action=view&id=" + id
      },
      fields: [
        { key: "employeeId", label: "Employee", type: "select", required: true, hideFor: ["Employee"], options: employeeOptions },
        { key: "subject", label: "Subject of leave", required: true },
        { key: "duration", label: "Leave duration", required: true, placeholder: "3 Days" },
        { key: "date", label: "Leave date", type: "date", required: true },
        { key: "status", label: "Status", type: "select", required: true, hideFor: ["Employee"], options: () => ["Pending", "Approved", "Rejected"].map((status) => ({ value: status, label: status })) },
        { key: "remark", label: "Remark", type: "textarea", wide: true }
      ],
      columns: [
        { key: "id", label: "Id" },
        { key: "employeeId", label: "Employee", value: (row) => personName(row.employeeId) },
        { key: "subject", label: "Subject" },
        { key: "duration", label: "Duration" },
        { key: "date", label: "Date", value: (row) => fmtDate(row.date) },
        { key: "status", label: "Status", html: (row) => pill(row.status) },
        { key: "remark", label: "Remark" }
      ],
      beforeSave(data) {
        data.employeeId = Number(data.employeeId);
        if (!data.status) data.status = "Pending";
        return data;
      }
    },
    users: {
      key: "users",
      title: "Accounts",
      listTitle: "Account list",
      singular: "Account",
      blurb: "Create a login for each person and choose what they can reach. Admins manage accounts, HR manages every record, and employees see only their own profile, salary, and leave.",
      addLabel: "Add account",
      deleteNote: "They will no longer be able to sign in. Their employee record is kept.",
      formNote: "Employee accounts must be linked to an employee record. When updating, leave the password blank to keep the current one.",
      routes: {
        list: "accounts.html",
        create: "accounts.html?action=new",
        edit: (id) => "accounts.html?action=edit&id=" + id,
        view: (id) => "accounts.html?action=view&id=" + id
      },
      fields: [
        { key: "name", label: "Display name", required: true },
        { key: "username", label: "Username", required: true, placeholder: "sita" },
        { key: "password", label: "Password", type: "password", secret: true, required: "create" },
        { key: "role", label: "Role", type: "select", required: true, options: () => ROLES.map((role) => ({ value: role, label: role })) },
        { key: "employeeId", label: "Linked employee", type: "select", wide: true, options: employeeOptions }
      ],
      columns: [
        { key: "id", label: "Id" },
        { key: "name", label: "Name" },
        { key: "username", label: "Username" },
        { key: "role", label: "Role" },
        { key: "employeeId", label: "Linked employee", value: (row) => (row.employeeId ? personName(row.employeeId) : "—") }
      ],
      beforeSave(data) {
        data.username = String(data.username || "").toLowerCase();
        data.employeeId = Number(data.employeeId) || null;
        return data;
      },
      validate(data, errors, id) {
        const users = Store.all("users");
        const username = String(data.username || "").toLowerCase();
        if (username && !/^[a-z0-9._-]{3,24}$/.test(username)) {
          errors.username = "Use 3 to 24 letters, numbers, dots, dashes, or underscores.";
        } else if (username && users.some((row) => row.username === username && row.id !== id)) {
          errors.username = "That username is already taken.";
        }
        if (data.password !== undefined && data.password !== "" && data.password.length < 6) {
          errors.password = "Use at least 6 characters.";
        }
        const linked = Number(data.employeeId) || null;
        if (data.role === "Employee" && !linked) errors.employeeId = "Link an employee record to an Employee account.";
        if (linked && users.some((row) => row.employeeId === linked && row.id !== id)) {
          errors.employeeId = "That employee already has a login.";
        }
        if (id && id === me.id && data.role && data.role !== "Admin") {
          errors.role = "You can't remove the Admin role from the account you're signed in with.";
        }
      }
    }
  };

  const schema = SCHEMAS[pageEntity];

  function params() {
    return new URLSearchParams(location.search);
  }

  function currentId() {
    const n = Number(params().get("id"));
    return Number.isInteger(n) && n > 0 ? n : null;
  }

  function currentPage() {
    return (location.pathname.split("/").pop() || "index.html") + location.search;
  }

  function resolveView() {
    let view = document.body.dataset.page || "list";
    let mode = document.body.dataset.mode || "";
    if (view === "list") {
      const action = params().get("action");
      if (action === "new") { view = "form"; mode = "create"; }
      else if (action === "edit") { view = "form"; mode = "edit"; }
      else if (action === "view") view = "detail";
    }
    if (view === "form" && !mode) mode = currentId() ? "edit" : "create";
    return { view, mode };
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[ch]));
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    const parts = String(iso).split("-");
    if (parts.length !== 3) return String(iso);
    return parts[0] + "/" + parts[1] + "/" + parts[2];
  }

  function money(value) {
    const n = Number(value) || 0;
    return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  function nameOf(entity, id, key) {
    const row = Store.get(entity, id);
    return row ? row[key] : "—";
  }

  function personName(id) {
    const row = Store.get("employees", id);
    return row ? row.firstName + " " + row.lastName : "—";
  }

  function peopleTable(rows) {
    const body = rows.length
      ? rows.map((row) => "<tr><td><a href='employeeDetails.html?id=" + row.id + "'>" + esc(row.firstName + " " + row.lastName) + "</a></td><td>" + esc(row.email) + "</td><td>" + esc(row.phone) + "</td></tr>").join("")
      : "<tr><td colspan='3'>No employees assigned.</td></tr>";
    return "<div class='extras'><div><h3>Employees</h3><table class='mini'><thead><tr><th>Name</th><th>Email</th><th>Phone</th></tr></thead><tbody>" + body + "</tbody></table></div></div>";
  }

  function pill(status) {
    const key = String(status || "pending").toLowerCase();
    return "<span class='pill pill-" + esc(key) + "'>" + esc(status || "Pending") + "</span>";
  }

  function rowLabel(row) {
    if (!row) return schema.singular;
    if (row.firstName || row.lastName) return (row.firstName + " " + row.lastName).trim();
    return row.name || row.position || row.subject || schema.singular;
  }

  function isSelf() {
    return level(schema.key) === "self";
  }

  function listTitle() {
    return isSelf() && schema.selfTitle ? schema.selfTitle : schema.title;
  }

  function addLabel() {
    return isSelf() && schema.selfAddLabel ? schema.selfAddLabel : schema.addLabel;
  }

  function visibleFields() {
    return schema.fields.filter((field) => !(field.hideFor && field.hideFor.includes(me.role)));
  }

  function toast(message) {
    const el = document.getElementById("toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 2800);
  }

  function consumeToast() {
    const message = sessionStorage.getItem("ems.toast");
    if (!message) return;
    sessionStorage.removeItem("ems.toast");
    toast(message);
  }

  function flash(message) {
    sessionStorage.setItem("ems.toast", message);
  }

  function closeDialog(result) {
    const dialog = document.getElementById("dialog");
    dialog.hidden = true;
    dialog.innerHTML = "";
    if (dialogResolve) {
      const resolve = dialogResolve;
      dialogResolve = null;
      resolve(result);
    }
  }

  function confirmDialog(opts) {
    const dialog = document.getElementById("dialog");
    dialog.hidden = false;
    dialog.innerHTML =
      "<div class='dialog-card' role='dialog' aria-modal='true' aria-labelledby='dialog-title'>" +
        "<h2 id='dialog-title'>" + esc(opts.title) + "</h2>" +
        "<p>" + esc(opts.message) + "</p>" +
        "<div class='form-actions'>" +
          "<button type='button' class='btn btn-ghost' data-act='dialog-cancel'>Cancel</button>" +
          "<button type='button' class='btn " + (opts.danger ? "btn-danger" : "") + "' data-act='dialog-ok'>" + esc(opts.confirmLabel || "Confirm") + "</button>" +
        "</div>" +
      "</div>";
    const ok = dialog.querySelector("[data-act='dialog-ok']");
    if (ok) ok.focus();
    return new Promise((resolve) => { dialogResolve = resolve; });
  }

  function shell(inner) {
    const pending = level("leaves") === "write" ? Store.all("leaves").filter((row) => row.status === "Pending").length : 0;
    const links = NAV.filter(([key]) => level(key)).map(([key, href, label, selfLabel]) => {
      const self = level(key) === "self";
      const url = key === "employees" && self ? homeHref() : href;
      const text = self && selfLabel ? selfLabel : label;
      const badge = key === "leaves" && pending ? "<span class='badge'>" + pending + "</span>" : "";
      return "<a class='nav-link" + (key === schema.key ? " active" : "") + "' href='" + url + "'>" + esc(text) + badge + "</a>";
    }).join("");

    document.getElementById("app").innerHTML =
      "<div class='shell' id='shell'>" +
        "<button type='button' class='scrim' data-act='close-menu' aria-label='Close menu'></button>" +
        "<aside class='side'>" +
          "<a class='brand' href='" + homeHref() + "'>" +
            "<svg viewBox='0 0 44 44' fill='none' aria-hidden='true'><circle cx='22' cy='24' r='8' fill='#e0231c'/><path d='M6 12h32M10 17h24M22 8v26' stroke='#dfe7e0' stroke-width='1.6'/></svg>" +
            "<span><b>EMS</b><i>Employee system</i></span>" +
          "</a>" +
          "<p class='nav-kicker'>Records</p>" +
          "<nav class='nav' aria-label='Primary'>" + links + "</nav>" +
          "<div class='side-foot'>" +
            "<div class='who'><b>" + esc(me.name) + "</b><span>" + esc(me.role) + " · " + esc(me.username) + "</span></div>" +
            "<div class='actions'>" +
              "<button type='button' class='btn btn-ghost btn-sm' data-act='switch'>Switch account</button>" +
              "<button type='button' class='btn btn-ghost btn-sm' data-act='logout'>Log out</button>" +
            "</div>" +
            "<p>Saved in this browser only.</p>" +
            (me.role === "Admin" ? "<button type='button' class='btn btn-ghost btn-sm' data-act='reset'>Restore sample data</button>" : "") +
          "</div>" +
        "</aside>" +
        "<div class='main'>" + inner + "</div>" +
      "</div>";
  }

  function hero(title, lede) {
    const text = lede || (level(schema.key) === "write" ? schema.blurb : schema.selfBlurb || schema.blurb);
    return (
      "<header class='hero'>" +
        "<button type='button' class='menu-btn' data-act='menu' aria-expanded='false' aria-controls='shell'>Menu</button>" +
        "<p class='eyebrow'><i class='dot'></i> Employee Management System</p>" +
        "<h1>" + esc(title) + "</h1>" +
        "<p class='lede'>" + esc(text) + "</p>" +
      "</header>"
    );
  }

  function emptyBlock(message) {
    const add = can("create", schema.key) ? "<a class='btn' href='" + schema.routes.create + "'>" + esc(addLabel()) + "</a>" : "";
    return "<div class='empty'><p>" + esc(message) + "</p>" + add + "</div>";
  }

  function actionsFor(row) {
    const parts = [];
    if (can("view", schema.key, row)) parts.push("<a class='btn btn-sm btn-ghost' href='" + schema.routes.view(row.id) + "'>Details</a>");
    if (can("edit", schema.key, row)) parts.push("<a class='btn btn-sm btn-ghost' href='" + schema.routes.edit(row.id) + "'>Update</a>");
    if (schema.key === "leaves" && row.status === "Pending" && level("leaves") === "write") {
      parts.push("<button type='button' class='btn btn-sm' data-act='status' data-id='" + row.id + "' data-status='Approved'>Approve</button>");
      parts.push("<button type='button' class='btn btn-sm btn-danger' data-act='status' data-id='" + row.id + "' data-status='Rejected'>Reject</button>");
    }
    if (can("delete", schema.key, row)) {
      parts.push("<button type='button' class='btn btn-sm btn-danger' data-act='delete' data-id='" + row.id + "'>" + (isSelf() ? "Cancel" : "Delete") + "</button>");
    }
    return "<div class='actions'>" + parts.join("") + "</div>";
  }

  function cell(col, row) {
    if (col.html) return col.html(row);
    const value = col.value ? col.value(row) : row[col.key];
    if (value === undefined || value === null || value === "") return "—";
    return esc(value);
  }

  function haystack(row) {
    return schema.columns.map((col) => {
      const value = col.value ? col.value(row) : row[col.key];
      return value == null ? "" : String(value);
    }).join(" ").toLowerCase();
  }

  function stats() {
    if (schema.key !== "employees") return "";
    const items = [
      ["Employees", Store.all("employees").length],
      ["Departments", Store.all("departments").length],
      ["Open roles", Store.all("vacancies").reduce((sum, row) => sum + (Number(row.count) || 0), 0)],
      ["Pending leave", Store.all("leaves").filter((row) => row.status === "Pending").length]
    ];
    return "<div class='stats'>" + items.map(([label, value]) => "<div class='stat'><b>" + value + "</b><span>" + label + "</span></div>").join("") + "</div>";
  }

  const searchState = { q: "", dept: "" };

  function renderList() {
    const rows = Store.all(schema.key).filter((row) => !isSelf() || owns(schema.key, row));
    const title = listTitle();
    const filters = schema.key === "employees"
      ? "<div class='filters'>" +
          "<input type='search' id='search' placeholder='Search employees' aria-label='Search employees' />" +
          "<select id='filter-dept' aria-label='Filter by department'><option value=''>All departments</option>" +
            Store.all("departments").map((row) => "<option value='" + row.id + "'>" + esc(row.name) + "</option>").join("") +
          "</select>" +
        "</div>"
      : "<div class='filters'><input type='search' id='search' placeholder='Search " + esc(title.toLowerCase()) + "' aria-label='Search " + esc(title) + "' /></div>";

    const head = schema.columns.map((col) => "<th scope='col'>" + esc(col.label) + "</th>").join("") + "<th scope='col'>Actions</th>";
    const body = rows.map((row) => {
      const dept = schema.key === "employees" ? " data-dept='" + esc(row.departmentId) + "'" : "";
      return "<tr data-row data-hay='" + esc(haystack(row)) + "'" + dept + ">" +
        schema.columns.map((col) => "<td>" + cell(col, row) + "</td>").join("") +
        "<td>" + actionsFor(row) + "</td></tr>";
    }).join("");

    const table = rows.length
      ? filters + "<p class='form-note' id='match-count'></p><div class='table-wrap'><table class='data'><thead><tr>" + head + "</tr></thead><tbody>" + body + "</tbody></table></div><p class='empty' id='no-match' hidden>No records match this search.</p>"
      : emptyBlock(isSelf() ? "Nothing is recorded for you yet." : "No " + title.toLowerCase() + " yet.");

    const addBtn = rows.length && can("create", schema.key)
      ? "<a class='btn' href='" + schema.routes.create + "'>" + esc(addLabel()) + "</a>"
      : "";

    shell(
      hero(title) +
      "<section class='panel'>" +
        "<div class='panel-head'><div><h2>" + esc(isSelf() ? title : schema.listTitle) + "</h2><p id='record-count'>" + rows.length + " record" + (rows.length === 1 ? "" : "s") + "</p></div>" + addBtn + "</div>" +
        (level(schema.key) === "write" ? stats() : "") + table +
      "</section>"
    );
    const search = document.getElementById("search");
    if (search && searchState.q) search.value = searchState.q;
    const dept = document.getElementById("filter-dept");
    if (dept && searchState.dept) dept.value = searchState.dept;
    applyFilters();
  }

  function applyFilters() {
    const q = searchState.q.trim().toLowerCase();
    const dept = searchState.dept;
    const rows = Array.from(document.querySelectorAll("[data-row]"));
    if (!rows.length) return;
    let shown = 0;
    rows.forEach((row) => {
      const textOk = !q || (row.dataset.hay || "").includes(q);
      const deptOk = !dept || row.dataset.dept === dept;
      const visible = textOk && deptOk;
      row.hidden = !visible;
      if (visible) shown += 1;
    });
    const note = document.getElementById("match-count");
    const empty = document.getElementById("no-match");
    if (note) note.textContent = "Showing " + shown + " of " + rows.length;
    if (empty) empty.hidden = shown !== 0;
  }

  function control(field, value, error, mode) {
    const id = field.key;
    const val = value == null ? "" : value;
    const hint = field.secret && mode === "edit" ? "Leave blank to keep the current password" : field.placeholder;
    const placeholder = hint ? " placeholder='" + esc(hint) + "'" : "";
    const required = field.required === true || (field.required === "create" && mode === "create");
    let input;
    if (field.type === "textarea") {
      input = "<textarea id='" + id + "' name='" + id + "'" + placeholder + ">" + esc(val) + "</textarea>";
    } else if (field.type === "select") {
      const options = field.options ? field.options() : [];
      const missing = val !== "" && !options.some((opt) => String(opt.value) === String(val));
      const opts = (missing ? [{ value: val, label: "Unavailable record" }] : []).concat(options);
      input = "<select id='" + id + "' name='" + id + "'>" +
        "<option value=''>" + (required ? "Select" : "None") + "</option>" +
        opts.map((opt) => "<option value='" + esc(opt.value) + "'" + (String(opt.value) === String(val) ? " selected" : "") + ">" + esc(opt.label) + "</option>").join("") +
        "</select>";
      if (!options.length && required) {
        input += "<p class='err'>Add a " + (field.key === "employeeId" ? "employee" : "related record") + " before saving this.</p>";
      }
    } else if (field.type === "readonly") {
      input = "<input id='" + id + "' name='" + id + "' value='" + esc(val === "" ? "0" : val) + "' readonly tabindex='-1' />";
    } else if (field.secret) {
      input = "<input id='" + id + "' name='" + id + "' type='password' autocomplete='new-password' value=''" + placeholder + " />";
    } else {
      const type = field.type || "text";
      const min = field.type === "number" ? " min='" + (field.min == null ? 0 : field.min) + "' step='1'" : "";
      input = "<input id='" + id + "' name='" + id + "' type='" + type + "' value='" + esc(val) + "'" + placeholder + min + " />";
    }
    return "<div class='field" + (field.wide ? " wide" : "") + (error ? " has-error" : "") + "'>" +
      "<label for='" + id + "'>" + esc(field.label) + (required ? " *" : "") + "</label>" +
      input +
      (error ? "<p class='err'>" + esc(error) + "</p>" : "") +
      "</div>";
  }

  function blankValues() {
    const values = {};
    schema.fields.forEach((field) => {
      if (field.type === "readonly" && (field.key === "gross" || field.key === "net")) values[field.key] = 0;
    });
    if (schema.key === "leaves") values.status = "Pending";
    const preset = Number(params().get("employee"));
    if (["salaries", "leaves", "users"].includes(schema.key) && Number.isInteger(preset) && preset > 0) {
      values.employeeId = preset;
      if (schema.key === "users") {
        const person = Store.get("employees", preset);
        values.role = "Employee";
        if (person) values.name = person.firstName + " " + person.lastName;
      }
    }
    return values;
  }

  function renderForm(mode, errors, values) {
    const existing = mode === "edit" ? Store.get(schema.key, currentId()) : null;
    if (mode === "edit" && !existing) {
      renderMissing();
      return;
    }
    const allowed = mode === "edit" ? can("edit", schema.key, existing) : can("create", schema.key);
    if (!allowed) {
      renderDenied(mode === "edit" && schema.key === "leaves" && owns("leaves", existing)
        ? "Only pending requests can be changed. This one is " + String(existing.status).toLowerCase() + "."
        : undefined);
      return;
    }
    const source = values || existing || blankValues();
    if (schema.key === "salaries") {
      const basic = Number(source.basic) || 0;
      const allowance = Number(source.allowance) || 0;
      const tax = Number(source.tax) || 0;
      source.gross = basic + allowance;
      source.net = source.gross - tax;
    }
    const title = mode === "edit"
      ? "Update " + schema.singular.toLowerCase()
      : (isSelf() && schema.selfAddLabel ? schema.selfAddLabel : "Add " + schema.singular.toLowerCase());
    const errorKeys = Object.keys(errors || {});
    const fields = visibleFields().map((field) => control(field, source[field.key], errors && errors[field.key], mode)).join("");
    shell(
      hero(title) +
      "<section class='panel'>" +
        "<div class='panel-head'><div><h2>" + esc(title) + "</h2><p>Fields marked * are required.</p></div></div>" +
        (errorKeys.length ? "<div class='banner'>Check the highlighted fields and save again.</div>" : "") +
        "<form data-form novalidate data-mode='" + mode + "' data-id='" + (existing ? existing.id : "") + "'" + (schema.key === "salaries" ? " data-salary-calc" : "") + ">" +
          "<div class='form-grid'>" + fields + "</div>" +
          (schema.formNote ? "<p class='form-note'>" + esc(schema.formNote) + "</p>" : "") +
          "<div class='form-actions'>" +
            "<button type='submit' class='btn'>" + (mode === "edit" ? "Update" : isSelf() ? "Send request" : "Create") + "</button>" +
            "<a class='btn btn-ghost' href='" + schema.routes.list + "'>Cancel</a>" +
          "</div>" +
        "</form>" +
      "</section>"
    );
    if (errorKeys.length) {
      const first = document.querySelector(".field.has-error input, .field.has-error select, .field.has-error textarea");
      if (first) first.focus();
    }
  }

  function renderDetail() {
    const record = Store.get(schema.key, currentId());
    if (!record) {
      renderMissing();
      return;
    }
    if (!can("view", schema.key, record)) {
      renderDenied("You can only see records that belong to you.");
      return;
    }
    const rows = schema.fields.filter((field) => !field.secret).map((field) => {
      let value;
      if (field.type === "select") {
        const match = (field.options() || []).find((opt) => String(opt.value) === String(record[field.key]));
        value = match ? match.label : "—";
      } else if (field.type === "date") value = fmtDate(record[field.key]);
      else if (field.money || field.type === "readonly") value = money(record[field.key]);
      else value = record[field.key] || "—";
      return "<div><dt>" + esc(field.label) + "</dt><dd>" + (field.key === "status" ? pill(record.status) : esc(value)) + "</dd></div>";
    }).join("");
    const back = !(isSelf() && schema.key === "employees") ? "<a class='btn btn-ghost' href='" + schema.routes.list + "'>Back</a>" : "";
    const edit = can("edit", schema.key, record) ? "<a class='btn' href='" + schema.routes.edit(record.id) + "'>Edit</a>" : "";
    const del = can("delete", schema.key, record)
      ? "<button type='button' class='btn btn-danger' data-act='delete' data-id='" + record.id + "' data-from='detail'>" + (isSelf() ? "Cancel request" : "Delete") + "</button>"
      : "";
    shell(
      hero(rowLabel(record)) +
      "<section class='panel'>" +
        "<div class='panel-head'><div><h2>" + esc(schema.singular) + " details</h2><p>Id " + record.id + "</p></div>" +
          "<div class='actions'>" + back + edit + del + "</div></div>" +
        "<dl class='kv'>" + rows + "</dl>" +
        (schema.extras ? schema.extras(record) : "") +
      "</section>"
    );
  }

  function renderMissing() {
    shell(
      hero("Not found") +
      "<section class='panel'><div class='empty'><p>That " + esc(schema.singular.toLowerCase()) + " is not in the saved records.</p>" +
      "<a class='btn' href='" + schema.routes.list + "'>Back to " + esc(listTitle().toLowerCase()) + "</a></div></section>"
    );
  }

  function renderDenied(message) {
    shell(
      hero("No access", "Signed in as " + me.name + " (" + me.role + ").") +
      "<section class='panel'><div class='empty'><p>" + esc(message || "Your account doesn't include this page. Ask an admin if you need it, or switch to another account.") + "</p>" +
      "<a class='btn' href='" + homeHref() + "'>Go to your home page</a></div></section>"
    );
  }

  function render() {
    if (!schema) {
      document.getElementById("app").innerHTML = "<p style='padding:24px'>This page is not wired to a record type.</p>";
      return;
    }
    if (!me) {
      location.replace("login.html?next=" + encodeURIComponent(currentPage()));
      return;
    }
    if (!level(schema.key)) {
      renderDenied();
      consumeToast();
      return;
    }
    const state = resolveView();
    if (state.view === "list" && schema.key === "employees" && isSelf()) {
      if (me.employeeId && Store.get("employees", me.employeeId)) {
        location.replace(homeHref());
        return;
      }
      renderDenied("This account isn't linked to an employee record yet. Ask an admin to link it on the Accounts page.");
      consumeToast();
      return;
    }
    if (state.view === "form") renderForm(state.mode);
    else if (state.view === "detail") renderDetail();
    else renderList();
    consumeToast();
  }

  function readForm(form) {
    const mode = form.dataset.mode;
    const data = {};
    const errors = {};
    const id = Number(form.dataset.id) || null;
    visibleFields().forEach((field) => {
      if (field.type === "readonly") return;
      const el = form.elements[field.key];
      const value = el ? String(el.value) : "";
      const raw = field.secret ? value : value.trim();
      if (field.secret && raw === "" && mode === "edit") return;
      const required = field.required === true || (field.required === "create" && mode === "create");
      if (required && !raw.trim()) {
        errors[field.key] = "This field is required.";
        data[field.key] = "";
        return;
      }
      if (field.type === "number") {
        if (raw === "") data[field.key] = 0;
        else if (!Number.isFinite(Number(raw))) errors[field.key] = "Enter a valid number.";
        else data[field.key] = Number(raw);
      } else if (field.type === "select" && raw !== "" && /^\d+$/.test(raw)) {
        data[field.key] = Number(raw);
      } else {
        data[field.key] = raw;
      }
    });
    if (schema.validate) schema.validate(data, errors, id);
    return { data, errors, id };
  }

  function onSubmit(event) {
    const form = event.target.closest("[data-form]");
    if (!form) return;
    event.preventDefault();
    const mode = form.dataset.mode;
    const existing = mode === "edit" ? Store.get(schema.key, Number(form.dataset.id)) : null;
    const allowed = mode === "edit" ? existing && can("edit", schema.key, existing) : can("create", schema.key);
    if (!allowed) {
      toast("Your account can't save this.");
      return;
    }
    const { data, errors, id } = readForm(form);
    if (Object.keys(errors).length) {
      const values = {};
      visibleFields().forEach((field) => {
        values[field.key] = form.elements[field.key] ? form.elements[field.key].value : "";
      });
      renderForm(mode, errors, values);
      return;
    }
    const submit = form.querySelector("[type='submit']");
    if (submit) submit.disabled = true;
    let payload = schema.beforeSave ? schema.beforeSave({ ...data }) : data;
    if (isSelf()) {
      payload.employeeId = me.employeeId;
      if (schema.key === "leaves") payload.status = "Pending";
    }
    if (mode === "edit") {
      if (!Store.update(schema.key, id, payload)) {
        toast("That record is no longer available.");
        location.href = schema.routes.list;
        return;
      }
      flash(schema.singular + " updated.");
    } else {
      Store.create(schema.key, payload);
      flash(isSelf() && schema.key === "leaves" ? "Leave request sent." : schema.singular + " created.");
    }
    location.href = schema.routes.list;
  }

  async function removeRecord(id, fromDetail) {
    const row = Store.get(schema.key, id);
    if (!row) {
      toast("That record is already gone.");
      render();
      return;
    }
    if (!can("delete", schema.key, row)) {
      toast(schema.key === "users" && row.id === me.id
        ? "You can't delete the account you're signed in with."
        : "Your account can't delete this.");
      return;
    }
    if (schema.key === "departments" && Store.all("employees").some((item) => item.departmentId === id)) {
      toast("Move employees out of this department before deleting it.");
      return;
    }
    if (schema.key === "designations" && Store.all("employees").some((item) => item.designationId === id)) {
      toast("Move employees off this designation before deleting it.");
      return;
    }
    const self = isSelf();
    const ok = await confirmDialog({
      title: self ? "Cancel this leave request?" : "Delete " + rowLabel(row) + "?",
      message: self ? "HR will no longer see it." : schema.deleteNote || "This removes the record from this browser.",
      confirmLabel: self ? "Cancel request" : "Delete",
      danger: true
    });
    if (!ok) return;
    if (schema.key === "employees") {
      Store.removeWhere("leaves", (item) => item.employeeId === id);
      Store.removeWhere("salaries", (item) => item.employeeId === id);
      Store.all("users").filter((user) => user.employeeId === id).forEach((user) => {
        if (user.role === "Employee") Store.remove("users", user.id);
        else Store.update("users", user.id, { employeeId: null });
      });
    }
    Store.remove(schema.key, id);
    const message = self ? "Leave request cancelled." : schema.singular + " deleted.";
    if (fromDetail) {
      flash(message);
      location.href = schema.routes.list;
      return;
    }
    toast(message);
    render();
  }

  async function onClick(event) {
    if (event.target.id === "dialog") {
      closeDialog(false);
      return;
    }
    if (event.target.closest("[data-act='dialog-cancel']")) { closeDialog(false); return; }
    if (event.target.closest("[data-act='dialog-ok']")) { closeDialog(true); return; }

    const menu = event.target.closest("[data-act='menu']");
    if (menu) {
      const shellEl = document.getElementById("shell");
      const open = shellEl.classList.toggle("nav-open");
      menu.setAttribute("aria-expanded", String(open));
      return;
    }
    if (event.target.closest("[data-act='close-menu']")) {
      document.getElementById("shell").classList.remove("nav-open");
      return;
    }

    if (event.target.closest("[data-act='switch']")) {
      Auth.logout();
      location.href = "login.html";
      return;
    }
    if (event.target.closest("[data-act='logout']")) {
      Auth.logout();
      flash("Signed out.");
      location.href = "login.html";
      return;
    }

    if (event.target.closest("[data-act='reset']")) {
      if (!me || me.role !== "Admin") return;
      const ok = await confirmDialog({
        title: "Restore sample data?",
        message: "This replaces every employee, department, designation, salary, vacancy, leave, and account saved in this browser.",
        confirmLabel: "Restore",
        danger: true
      });
      if (!ok) return;
      Store.reset();
      flash("Sample data restored.");
      location.href = schema.routes.list;
      return;
    }

    const statusBtn = event.target.closest("[data-act='status']");
    if (statusBtn) {
      if (level("leaves") !== "write") return;
      const id = Number(statusBtn.dataset.id);
      const status = statusBtn.dataset.status;
      if (!Store.get("leaves", id)) { toast("That leave request is gone."); render(); return; }
      Store.update("leaves", id, { status });
      toast("Leave marked " + status.toLowerCase() + ".");
      render();
      return;
    }

    const del = event.target.closest("[data-act='delete']");
    if (del) {
      await removeRecord(Number(del.dataset.id), del.dataset.from === "detail");
    }
  }

  function onInput(event) {
    if (event.target.id === "search") {
      searchState.q = event.target.value;
      applyFilters();
      return;
    }
    if (event.target.id === "filter-dept") {
      searchState.dept = event.target.value;
      applyFilters();
      return;
    }
    const form = event.target.closest("[data-salary-calc]");
    if (!form) return;
    const basic = Number(form.elements.basic.value) || 0;
    const allowance = Number(form.elements.allowance.value) || 0;
    const tax = Number(form.elements.tax.value) || 0;
    if (form.elements.gross) form.elements.gross.value = String(basic + allowance);
    if (form.elements.net) form.elements.net.value = String(basic + allowance - tax);
  }

  document.addEventListener("click", onClick);
  document.addEventListener("submit", onSubmit);
  document.addEventListener("input", onInput);
  document.addEventListener("change", onInput);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const dialog = document.getElementById("dialog");
    if (dialog && !dialog.hidden) closeDialog(false);
    const shellEl = document.getElementById("shell");
    if (shellEl) shellEl.classList.remove("nav-open");
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth > 860) {
      const shellEl = document.getElementById("shell");
      if (shellEl) shellEl.classList.remove("nav-open");
    }
  });

  render();
})();
