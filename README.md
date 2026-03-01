# Event Guest Check-In System

A secure fullstack web application for managing event guest check-ins with QR code generation, role-based access control, and email notifications.

## Stack

| Layer    | Technology |
|----------|-----------|
| Backend  | Node.js + Express |
| Database | SQLite (via better-sqlite3) |
| Auth     | JWT + bcrypt |
| Frontend | React + Vite + Tailwind CSS |
| QR Codes | `qrcode` npm package |
| Email    | Nodemailer |
| Cards    | html2canvas (PNG export) |

---

## Quick Start

### 1. Backend

```bash
cd backend
cp .env.example .env        # then edit .env with your settings
npm install
npm run dev                 # starts on http://localhost:4000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                 # starts on http://localhost:5173
```

---

## Default Credentials

| Role    | Username  | Password     |
|---------|-----------|--------------|
| Admin   | `admin`   | `Admin@123`  |
| Manager | `manager` | `Manager@123`|

Credentials are seeded on first startup and can be changed via `.env`.

---

## Environment Variables (`backend/.env`)

| Variable          | Description |
|-------------------|-------------|
| `PORT`            | Backend port (default: 4000) |
| `JWT_SECRET`      | Secret key for JWT signing — **change in production** |
| `FRONTEND_URL`    | Frontend URL for QR code links (default: http://localhost:5173) |
| `SMTP_HOST`       | SMTP server host |
| `SMTP_PORT`       | SMTP port (587 for TLS, 465 for SSL) |
| `SMTP_USER`       | SMTP username / email address |
| `SMTP_PASS`       | SMTP password or app password |
| `SMTP_FROM`       | From display name + email |
| `ADMIN_USERNAME`  | Admin username (seeded on first run) |
| `ADMIN_PASSWORD`  | Admin password |
| `MANAGER_USERNAME`| Manager username |
| `MANAGER_PASSWORD`| Manager password |

---

## Features

### Authentication
- JWT-based authentication (8-hour sessions)
- bcrypt password hashing
- Role-based access: **Admin** and **Manager** only
- No public registration

### Admin
- Add parent guests (name, phone, email, seat number)
- Add children linked to a parent
- View full guest list with check-in status
- Edit / delete guests
- Check in / check out guests
- View and download guest cards (PNG)

### Manager
- View full guest list (read-only)
- Check in / check out guests by scanning QR or entering backup code
- Cannot add, edit, or delete guests

### Guest Cards
- Each guest gets a unique QR code (links to their detail page)
- A 10-character alphanumeric backup code (format: `XXXX-XXXX-XX`)
- Cards downloadable as PNG via the dashboard
- Cards emailed automatically when SMTP is configured

### Public Guest Detail Page
- Accessible at `/guest/:uniqueCode` without login
- Shows guest info (name, phone, email, seat)
- Parents see their children's backup codes
- **No check-in button** unless accessed by logged-in staff

### Check-In Flow
1. Staff scans QR code → browser opens `/guest/:code` with check-in button visible
2. Or staff enters backup code in Check In panel → guest found → check in / out

---

## Security
- All `/api/guests/*` routes require a valid JWT
- Only `/api/public/guest/:code` and `/api/auth/login` are public
- Role checks enforced server-side (`requireRole` middleware)
- Frontend redirects unauthenticated users to `/login`
- QR pages use a separate unauthenticated axios instance to avoid redirect loops

---

## Project Structure

```
├── backend/
│   ├── src/
│   │   ├── db/database.js       # SQLite init + user seeding
│   │   ├── middleware/auth.js   # JWT + role middleware
│   │   ├── routes/
│   │   │   ├── auth.js          # POST /api/auth/login
│   │   │   ├── guests.js        # Protected guest CRUD + check-in
│   │   │   └── public.js        # GET /api/public/guest/:code
│   │   ├── services/
│   │   │   ├── qrService.js     # QR code generation
│   │   │   └── emailService.js  # Nodemailer email sending
│   │   ├── utils/codeGen.js     # unique_code + backup_code generators
│   │   └── index.js             # Express app entry point
│   ├── data/                    # SQLite DB (auto-created)
│   └── .env
│
└── frontend/
    └── src/
        ├── context/AuthContext.jsx     # Auth state + login/logout
        ├── utils/api.js               # Axios instance with JWT interceptor
        ├── components/
        │   ├── Layout.jsx             # Nav + shell
        │   ├── GuestCard.jsx          # QR card modal + PNG download
        │   ├── GuestFormModal.jsx     # Add/edit guest form
        │   └── ConfirmModal.jsx       # Delete confirmation
        └── pages/
            ├── LoginPage.jsx          # Login form
            ├── AdminDashboard.jsx     # Admin routes (/admin/*)
            ├── ManagerDashboard.jsx   # Manager routes (/manager/*)
            ├── CheckInPanel.jsx       # Shared check-in UI
            └── GuestDetailPage.jsx    # Public + staff guest detail
```
