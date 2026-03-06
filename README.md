# OAuth Practice Project

OAuth 2.0 + Passport.js practice — Express backend + Next.js frontend + MongoDB.

## Project Structure

```
oauth-practice/
├── backend/   Express + Passport.js API (port 3001)
└── frontend/  Next.js app (port 3000)
```

## Setup

### 1. Configure OAuth Apps (one-time)

**Google**
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → APIs & Services → Credentials → Create OAuth 2.0 Client ID
3. Authorized redirect URI: `http://localhost:3001/auth/google/callback`

**GitHub**
1. GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
2. Authorization callback URL: `http://localhost:3001/auth/github/callback`

**Facebook**
1. [developers.facebook.com](https://developers.facebook.com) → Create App → Consumer type
2. Add Facebook Login product → Settings → Valid OAuth Redirect URIs: `http://localhost:3001/auth/facebook/callback`

### 2. Backend

```bash
cd backend
cp .env.example .env
# Fill in MONGODB_URI and all OAuth credentials in .env
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm run dev
```

### 4. Test

1. Visit http://localhost:3000
2. Click "Login with GitHub" (easiest provider to set up)
3. Approve the OAuth prompt
4. You should land on the Dashboard with your profile loaded

## Auth Flow Recap

```
Next.js → GET /auth/github (Express)
       → GitHub consent screen
       → GET /auth/github/callback (Express)
       → Passport finds/creates user in MongoDB
       → Signs JWT
       → Redirect to http://localhost:3000/auth/callback?token=<JWT>
       → Next.js saves token to localStorage
       → Dashboard fetches /auth/me with Bearer token
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /auth/google | No | Start Google OAuth flow |
| GET | /auth/github | No | Start GitHub OAuth flow |
| GET | /auth/facebook | No | Start Facebook OAuth flow |
| GET | /auth/me | JWT required | Get current user |
| GET | /auth/logout | No | Clear session |
| GET | /api/dashboard | JWT required | Example protected route |
