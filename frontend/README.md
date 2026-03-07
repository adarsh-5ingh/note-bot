# Note Bot — Frontend

Next.js frontend for Note Bot. See the [root README](../README.md) for full project setup.

## Dev

```bash
npm install
cp .env.local.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:3001
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL (e.g. `https://your-api.onrender.com`) |

## Deploy

Deployed on Vercel. Set `NEXT_PUBLIC_API_URL` in Vercel → Settings → Environment Variables to your production backend URL, then redeploy.
