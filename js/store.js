/* Records live in this browser. Nothing is sent to a server. */
const Store = (() => {
  const KEY = "ems.records.v1";
  const TABLES = ["employees", "departments", "designations", "salaries", "vacancies", "leaves"];

  function seedUsers() {
    return [
      { id: 1, name: "System Admin", username: "admin", password: "admin123", role: "Admin", employeeId: null },
      { id: 2, name: "HR Manager", username: "hr", password: "hr1234", role: "HR", employeeId: null },
      { id: 3, name: "John Wick", username: "john", password: "john123", role: "Employee", employeeId: 2 },
      { id: 4, name: "Mark Otto", username: "mark", password: "mark123", role: "Employee", employeeId: 1 }
    ];
  }

  function seed() {
    return {
      version: 1,
      employees: [
        { id: 1, firstName: "Mark", lastName: "Otto", email: "mark@gmail.com", address: "Kathmandu", phone: "9808982515", joinDate: "2022-07-07", departmentId: 1, designationId: 1, remark: "Hello" },
        { id: 2, firstName: "John", lastName: "Wick", email: "john@gmail.com", address: "Kathmandu", phone: "9808982567", joinDate: "2022-01-01", departmentId: 2, designationId: 2, remark: "Joined as an intern" },
        { id: 3, firstName: "Sita", lastName: "Sharma", email: "sita@gmail.com", address: "Lalitpur", phone: "9812345678", joinDate: "2023-03-15", departmentId: 1, designationId: 2, remark: "Supports payroll and hiring" }
      ],
      departments: [
        { id: 1, name: "HR Department", location: "Kathmandu", block: "A", hod: "Keshav Yadav", number: "1" },
        { id: 2, name: "IT Department", location: "Kathmandu", block: "B", hod: "Dipesh Kumar Sah", number: "2" }
      ],
      designations: [
        { id: 1, name: "Administrative", remark: "Handle all the works" },
        { id: 2, name: "Developer", remark: "Code the software" }
      ],
      salaries: [
        { id: 1, employeeId: 1, basic: 30000, allowance: 2000, tax: 3900, gross: 32000, net: 28100, remark: "Monthly structure" },
        { id: 2, employeeId: 2, basic: 80000, allowance: 2000, tax: 3900, gross: 82000, net: 78100, remark: "Monthly structure" }
      ],
      vacancies: [
        { id: 1, position: "Manager", count: 1, company: "Himalayan Works", qualification: "MBA", experience: "2 Years", remark: "Salary as per experience" }
      ],
      leaves: [
        { id: 1, employeeId: 2, subject: "Tours", duration: "3 Days", date: "2022-12-01", status: "Pending", remark: "Please consider" },
        { id: 2, employeeId: 3, subject: "Family visit", duration: "1 Day", date: "2024-02-10", status: "Approved", remark: "Approved by HR" }
      ],
      users: seedUsers()
    };
  }

  function normalize(data) {
    data.salaries.forEach((row) => {
      row.basic = Number(row.basic) || 0;
      row.allowance = Number(row.allowance) || 0;
      row.tax = Number(row.tax) || 0;
      row.gross = row.basic + row.allowance;
      row.net = row.gross - row.tax;
      row.employeeId = Number(row.employeeId) || row.employeeId;
    });
    data.leaves.forEach((row) => {
      if (!row.status) row.status = "Pending";
      row.employeeId = Number(row.employeeId) || row.employeeId;
    });
    data.employees.forEach((row) => {
      row.departmentId = Number(row.departmentId) || row.departmentId;
      row.designationId = Number(row.designationId) || row.designationId;
    });
    data.vacancies.forEach((row) => {
      row.count = Number(row.count) || 0;
    });
    data.users.forEach((row) => {
      row.username = String(row.username || "").trim().toLowerCase();
      row.employeeId = Number(row.employeeId) || null;
    });
    return data;
  }

  function valid(data) {
    return data && data.version === 1 && TABLES.every((key) => Array.isArray(data[key]));
  }

  let data = load();

  function load() {
    try {
      const parsed = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!valid(parsed)) return seed();
      if (!Array.isArray(parsed.users)) parsed.users = seedUsers();
      return normalize(parsed);
    } catch (err) {
      return seed();
    }
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function all(entity) {
    return data[entity].map((row) => ({ ...row }));
  }

  function get(entity, id) {
    const row = data[entity].find((item) => item.id === Number(id));
    return row ? { ...row } : null;
  }

  function nextId(entity) {
    return data[entity].reduce((max, row) => Math.max(max, row.id), 0) + 1;
  }

  function create(entity, payload) {
    const row = { ...payload, id: nextId(entity) };
    data[entity].push(row);
    normalize(data);
    save();
    return row.id;
  }

  function update(entity, id, payload) {
    const index = data[entity].findIndex((item) => item.id === Number(id));
    if (index < 0) return false;
    data[entity][index] = { ...data[entity][index], ...payload, id: Number(id) };
    normalize(data);
    save();
    return true;
  }

  function remove(entity, id) {
    data[entity] = data[entity].filter((item) => item.id !== Number(id));
    save();
  }

  function removeWhere(entity, pred) {
    data[entity] = data[entity].filter((item) => !pred(item));
    save();
  }

  function reset() {
    data = seed();
    save();
  }

  function demoUsers() {
    return seedUsers().map(({ name, username, password, role }) => ({ name, username, password, role }));
  }

  return { all, get, create, update, remove, removeWhere, reset, demoUsers };
})();
