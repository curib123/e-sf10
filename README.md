# e-sf10

A React-based web application for managing ESF10 forms (student records, enrollments, grades, teachers, and related school data).

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v14 or higher (LTS recommended)
- **npm** (bundled with Node.js)

> Tip: Node 18+ is recommended for best compatibility with modern tooling.

### 1) Clone the repository
```bash
git clone https://github.com/curib123/e-sf10.git
cd e-sf10
```

### 2) Install dependencies
```bash
npm install
```

### 3) Configure environment variables
Create a `.env` file in the project root with the following entries:

```env
# Base URL of your API (the backend exposes /esf10 routes)
REACT_APP_API_BASE_URL=http://localhost:3001/esf10

# Base URL for serving uploaded/public assets (e.g., school logos)
REACT_APP_API_LOGO_URL=http://localhost:3001
```

> After changing `.env`, **restart** the dev server so Create React App can pick up the new values.

### 4) Run the app in development
```bash
npm start
```
The app will be available at **http://localhost:3000**.

> Make sure your backend server is running at **http://localhost:3001** and exposes the `/esf10` routes (e.g., `GET /esf10/teachers`, `DELETE /esf10/enrollments/delete/:enrollment_id`, etc.).

---

## 🧩 Project Structure (high level)

```
e-sf10/
├─ public/
├─ src/
│  ├─ components/          # Reusable UI elements (e.g., StatusModal, filters, inputs)
│  ├─ pages/               # Page-level screens (e.g., EnrollmentUpsert.jsx)
│  ├─ screens/             # List/detail views (e.g., student_enrollment_list.js)
│  ├─ helpers/             # Utilities (formatters, API helpers, etc.)
│  ├─ auth/                # Authentication screens & helpers
│  ├─ main/                # Layouts / navigation (e.g., dashboard & sidebar)
│  └─ App.js               # App entry / routes
├─ .env                    # Environment config (not committed)
├─ package.json
└─ README.md
```

> Exact files may differ as the project evolves, but the layout above reflects common conventions used in this repository.

---

## ⚙️ Environment Variables

| Name                         | Required | Example                             | Description |
|-----------------------------|----------|-------------------------------------|-------------|
| `REACT_APP_API_BASE_URL`    | ✅       | `http://localhost:3001/esf10`       | Base URL for all API requests. |
| `REACT_APP_API_LOGO_URL`    | ✅       | `http://localhost:3001`             | Host for public assets (e.g., logos). |

**Notes**
- Environment variable names **must** start with `REACT_APP_` to be accessible in the browser (Create React App convention).
- When switching environments (local → staging → prod), update `.env` and restart the dev server.

---

## 🛠️ Available Scripts

- **Development**
  ```bash
  npm start
  ```
- **Production Build**
  ```bash
  npm run build
  ```

> Additional scripts (tests/lint) may be present depending on your local `package.json`.

---

## 🔌 Backend Expectations

The frontend assumes a running backend that serves ESF10 endpoints under `REACT_APP_API_BASE_URL`. Examples include (but are not limited to):

- `GET /esf10/teachers`
- `GET /esf10/students/:lrn/details`
- `DELETE /esf10/enrollments/delete/:enrollment_id`
- `PATCH /esf10/teachers/toggle-status/:teacher_id`
- `POST /esf10/grades/create-or-update`

Ensure the backend:
- Listens on **http://localhost:3001** during local development.
- Handles CORS for **http://localhost:3000** if needed.
- Uses the same route prefixes expected by the frontend code (`/esf10/...`).

---

## 🧪 Troubleshooting

- **Blank page or env not picked up** → Restart the dev server after editing `.env`.
- **API errors (4xx/5xx)** → Confirm `REACT_APP_API_BASE_URL` is correct and the backend is running.
- **CORS issues** → Enable CORS on the backend to allow the React dev origin (`http://localhost:3000`).
- **Auth issues** → Clear `sessionStorage` and log in again (the app stores tokens in `sessionStorage`).

---

## 🤝 Contributing

1. Create a branch from `main` or the active development branch.
2. Commit with clear messages.
3. Open a Pull Request with a concise description of changes.

---

## 📄 License

Add a `LICENSE` file to define usage terms for this project.

---

## 📫 Support

If you encounter issues or have suggestions, please open an issue in the repository.
