# Note Bot

**Live:** [https://thenotebot.vercel.app](https://thenotebot.vercel.app)

A full-stack note-taking app with a rich WYSIWYG editor, image uploads, dark mode, pinned notes, public sharing, and OAuth login (Google, GitHub, Facebook).

## Project Structure

```
note-bot/
├── backend/   Express + Passport.js + MongoDB API
└── frontend/  Next.js app (deployed on Vercel)
```

## Features

- **Rich editor** — Bold, italic, headings (H1/H2), bullet & ordered lists, inline code, code blocks
- **Image support** — Paste or upload images (stored on Cloudinary), click to open lightbox
- **Dark mode** — System-aware toggle, preference saved in localStorage
- **Pin notes** — Pinned notes always appear at the top of the dashboard
- **Public sharing** — Toggle a note public to share it; appears in the Explore feed
- **Tags** — Add tags to notes, filter dashboard by tag
- **Search** — Full-text search across title and content
- **OAuth login** — Google, GitHub, Facebook via Passport.js + JWT

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 (App Router), TipTap, tiptap-markdown, ReactMarkdown |
| Backend | Express 5, Passport.js, JWT, Mongoose |
| Database | MongoDB Atlas |
| Storage | Cloudinary (image uploads) |
| Auth | OAuth 2.0 (Google, GitHub, Facebook) + JWT |
| Deploy | Frontend: Vercel — Backend: Render |

## Local Setup

### 1. Configure OAuth Apps

**Google**
1. [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → Create OAuth 2.0 Client ID
2. Authorized redirect URI: `http://localhost:3001/auth/google/callback`

**GitHub**
1. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
2. Authorization callback URL: `http://localhost:3001/auth/github/callback`

**Facebook**
1. [developers.facebook.com](https://developers.facebook.com) → Create App → Consumer
2. Facebook Login → Settings → Valid OAuth Redirect URIs: `http://localhost:3001/auth/facebook/callback`

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill in all values in .env
npm run dev
```

**Required env vars:**
```
PORT=3001
MONGODB_URI=
JWT_SECRET=
JWT_EXPIRES_IN=7d
SESSION_SECRET=
CLIENT_URL=http://localhost:3000
CLIENT_URL_PROD=https://your-app.vercel.app
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

### 3. Frontend

```bash
cd frontend
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:3001
npm run dev
```

### 4. Open

Visit [http://localhost:3000](http://localhost:3000) and sign in with any provider.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /auth/google | No | Start Google OAuth |
| GET | /auth/github | No | Start GitHub OAuth |
| GET | /auth/facebook | No | Start Facebook OAuth |
| GET | /auth/me | JWT | Get current user |
| GET | /auth/logout | No | Clear session |
| GET | /api/notes | JWT | List user's notes (search, tag filter) |
| POST | /api/notes | JWT | Create a note |
| PUT | /api/notes/:id | JWT | Update a note |
| DELETE | /api/notes/:id | JWT | Delete a note |
| GET | /api/feed | JWT | Public notes from all users |
| POST | /api/upload | JWT | Upload image to Cloudinary |

## Auth Flow

```
Browser → GET /auth/github (Express)
        → GitHub consent screen
        → GET /auth/github/callback (Express)
        → Passport finds/creates user in MongoDB
        → Signs JWT
        → Redirects to /auth/callback?token=<JWT> (Next.js)
        → Token saved to localStorage
        → Dashboard loads
```
