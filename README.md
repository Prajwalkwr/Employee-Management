# Employee Management System

**Live website:** https://employee-management-gamma-inky.vercel.app

An employee management web app with a live 3D night-scene background (Three.js), built with plain HTML, CSS, and JavaScript. Records are saved in the browser's local storage, so it runs with no server or database.

## Sample logins

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| HR | `hr` | `hr1234` |
| Employee | `john` | `john123` |
| Employee | `mark` | `mark123` |

Use **Switch account** or **Log out** in the sidebar to change accounts, or click a sample account on the sign-in page.

## What each role can do

- **Admin** – manages everything, including user accounts and passwords on the Accounts page, and can restore the sample data.
- **HR** – manages employees, departments, designations, salaries, vacancies, and leave (including approving or rejecting leave), but not accounts.
- **Employee** – sees their own profile, salary, and leave; can request leave and change or cancel it while it is pending; can view vacancies.

## Features

- Employees: add, edit, view details, delete, search, and filter by department
- Departments and designations
- Salaries with automatic gross and net pay
- Vacancies
- Leave requests with approve and reject
- Role-based sign-in with Admin, HR, and Employee accounts
- Responsive layout with a mobile menu

## Run locally

Open `login.html` in a browser, or serve the folder:

```bash
python -m http.server 8080
```

Then visit http://localhost:8080.

## Note

Sign-in and data live only in the visitor's browser. This is meant for demos and learning, not real security.
