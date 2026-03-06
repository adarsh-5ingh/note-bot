# Deployment Guide

## 1. Push to GitHub

Create a repo on github.com and push this folder:
```bash
cd oauth-practice
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/notes-app.git
git push -u origin main
```

---

## 2. Deploy Backend → Render (free)

1. Go to render.com → New → Web Service
2. Connect your GitHub repo
3. Settings:
   - Root directory: `backend`
   - Build command: `npm install`
   - Start command: `npm start`
4. Add Environment Variables (from your `.env` file):
   - `MONGODB_URI`
   - `SESSION_SECRET`
   - `JWT_SECRET`
   - `JWT_EXPIRES_IN` = `7d`
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_CALLBACK_URL` = `https://YOUR-RENDER-URL.onrender.com/auth/google/callback`
   - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`
   - `GITHUB_CALLBACK_URL` = `https://YOUR-RENDER-URL.onrender.com/auth/github/callback`
   - `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET`
   - `FACEBOOK_CALLBACK_URL` = `https://YOUR-RENDER-URL.onrender.com/auth/facebook/callback`
   - `CLIENT_URL` = `http://localhost:3000` (keep for local dev)
   - `CLIENT_URL_PROD` = `https://YOUR-VERCEL-URL.vercel.app` (add after Vercel deploy)
5. Deploy → copy the Render URL (e.g. `https://notes-app-api.onrender.com`)

> Update callback URLs in Google/GitHub/Facebook developer consoles to use the Render URL.

---

## 3. Deploy Frontend → Vercel (free)

1. Go to vercel.com → New Project → Import your GitHub repo
2. Settings:
   - Root directory: `frontend`
   - Framework: Next.js (auto-detected)
3. Add Environment Variable:
   - `NEXT_PUBLIC_API_URL` = `https://YOUR-RENDER-URL.onrender.com`
4. Deploy → copy the Vercel URL
5. Go back to Render → add `CLIENT_URL_PROD` = your Vercel URL → redeploy

---

## 4. Update OAuth Callback URLs

For each provider, add the production callback URLs alongside the localhost ones:

**Google** (console.cloud.google.com → Credentials → your OAuth client):
- Add: `https://YOUR-RENDER-URL.onrender.com/auth/google/callback`

**GitHub** (Settings → Developer Settings → OAuth Apps):
- Update callback URL to: `https://YOUR-RENDER-URL.onrender.com/auth/github/callback`

**Facebook** (developers.facebook.com → Facebook Login → Settings):
- Add: `https://YOUR-RENDER-URL.onrender.com/auth/facebook/callback`
