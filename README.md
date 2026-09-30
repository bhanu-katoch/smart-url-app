# 🤖 AI-Powered Smart URL Shortener

An AI-powered URL shortener that generates **semantic, human-readable URLs** using OpenAI instead of random short IDs.

### Example

```text
Original:
https://example.com/d/e/1FAIpQLSfTZr7MS1ji7FDrXLNfsQAyeEE6fKrvTPhYQlxHZTcwsVJ6ITYE

Generated:
https://your-domain.com/learning/react-guide
```

## ✨ Features

* 🔐 JWT-based authentication
* 🤖 AI-generated project names and URL slugs
* 🔗 Human-readable URLs: `/project/ai-slug`
* 📁 Multiple links under each project
* 🚫 Duplicate project/slug prevention using MongoDB unique constraints
* 🔄 AI slug regeneration when conflicts occur
* 📊 Dashboard with link status and click counts
* 👤 User-specific URL ownership and authorization
* ✏️ Create, update, delete and redirect URLs
* 🧪 Jest + Supertest API testing

## 🛠️ Tech Stack

**Frontend:** React, Vite, CSS
**Backend:** Node.js, Express.js
**Database:** MongoDB, Mongoose
**Authentication:** JWT, bcrypt
**AI:** OpenAI API
**Testing:** Jest, Supertest

## 📂 Structure

```text
smart-url/
├── client/       # React + Vite
├── server/       # Node + Express
├── README.md
└── .gitignore
```

## ⚙️ Environment Variables

Create `server/.env`:

```env
PORT=5001
MONGODB_URI=
OPENAI_API_KEY=
JWT_SECRET=your_jwt_secret
CLIENT_URL=http://localhost:5173
BASE_URL=http://localhost:5001
```

Add your MongoDB URI and OpenAI API key manually.

## 🚀 Run Locally

### Backend

```bash
cd server
npm install
npm run dev
```

### Frontend

```bash
cd client
npm install
npm run dev
```

Frontend:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:5001
```

## 🔗 URL Flow

```text
User URL
   ↓
OpenAI
   ↓
Project + Semantic Slug
   ↓
Duplicate Check
   ↓
MongoDB
   ↓
/project/slug
   ↓
Redirect + Click Tracking
```

## 🧪 Testing

```bash
cd server
npm test
```

Tests cover authentication, URL operations, AI slug generation, duplicate handling, and authorization.

![Tests](https://github.com/bhanu-katoch/smart-url-app/actions/workflows/test.yml/badge.svg)

## 👨‍💻 Author

**Bhanu Katoch**

Built with React, Node.js, MongoDB, OpenAI API, JWT, Jest and Supertest.
