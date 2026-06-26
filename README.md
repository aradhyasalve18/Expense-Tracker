# 💰 Expense Tracker

A full-stack Expense Tracker web application that helps users securely manage and analyze their daily expenses. The application provides JWT-based authentication, category-wise expense management, and interactive analytics to give users better insights into their spending habits.

## 🚀 Features

* 🔐 Secure User Authentication (JWT)
* 👤 User Registration & Login
* ➕ Add, Edit & Delete Expenses
* 📂 Category-wise Expense Management
* 📅 Expense History with Date Tracking
* 📊 Interactive Analytics Dashboard
* 📱 Responsive UI for Desktop & Mobile
* 🔒 User-specific Data Isolation
* ☁️ Cloud Deployment

## 🛠️ Tech Stack

### Frontend

* React.js
* CSS3
* Axios

### Backend

* Node.js
* Express.js

### Database

* MongoDB Atlas
* Mongoose

### Authentication

* JSON Web Tokens (JWT)
* bcrypt.js

### Deployment

* Frontend: Vercel
* Backend: Render

## 📁 Project Structure

```
Expense-Tracker/
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── models/
│   ├── routes/
│   ├── middleware/
│   ├── server.js
│   └── package.json
│
└── README.md
```

## ⚙️ Installation

### Clone the repository

```bash
git clone <repository-url>
cd Expense-Tracker
```

### Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file:

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
PORT=5000
FRONTEND_URL=http://localhost:5173
```

Run the backend:

```bash
npm run dev
```

### Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env` file:

```env
VITE_API_URL=http://localhost:5000
```

Run the frontend:

```bash
npm run dev
```

## 🌐 Deployment

* **Frontend:** Vercel
* **Backend:** Render
* **Database:** MongoDB Atlas

## 🎯 Future Improvements

* Expense Budget Planning
* Monthly Reports & Export (PDF/Excel)
* Email Notifications
* Dark Mode
* Currency Selection
* Recurring Expenses
* Advanced Charts & Insights

## 👨‍💻 Author

**Aradhya Salve**

Computer Engineering Student | Full Stack Developer

Passionate about building practical web applications and continuously learning modern web technologies.

---

⭐ If you found this project useful, consider giving it a star on GitHub!
