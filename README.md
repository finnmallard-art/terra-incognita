# Terra Incognita — Deploy to Vercel

This is a Vite + React app, ready to deploy as-is. It uses browser `localStorage`
as a mock backend (no real database yet) — see "Known limitation" below.

## Fastest path: deploy via Vercel CLI

```bash
npm install -g vercel
cd terra-deploy
vercel
```

Follow the prompts (link or create a project). Vercel auto-detects Vite and
builds with `npm run build`, serving the `dist/` folder. You'll get a live
`*.vercel.app` URL immediately, and can add a custom domain afterward in the
Vercel dashboard under Project → Settings → Domains.

## Alternative: deploy via GitHub (recommended for ongoing edits)

1. Push this folder to a new GitHub repo:
   ```bash
   cd terra-deploy
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/terra-incognita.git
   git push -u origin main
   ```
2. Go to vercel.com → "Add New Project" → import the GitHub repo
3. Leave all build settings as default (Vite is auto-detected)
4. Click Deploy

Every future `git push` will auto-deploy a new version.

## Local testing before you deploy

```bash
npm install
npm run dev
```

Visit the printed `localhost` URL. To test the production build exactly as
Vercel will serve it:

```bash
npm run build
npm run preview
```

## Demo accounts (seeded in localStorage on first load)

- `admin@terra.io` / `admin123` — admin dashboard
- `priya@labs.org` / `pass123` — Pro plan user
- `alex@university.edu` / `pass123` — Free plan user

## Known limitation: no real backend yet

Everything (problems, users, votes, submissions) is stored in the visitor's
own browser via `localStorage`. This means:

- Every visitor sees their own separate copy of the data — submissions one
  person makes won't show up for anyone else
- Clearing browser data wipes it
- There's no real payment processing, email sending, or OAuth — those are
  simulated (see the `README` notes inside `src/App.jsx` for the exact
  swap points and the full Supabase SQL schema)

This is fine for sharing a working demo/prototype publicly. When you're
ready to support real multi-user data, the schema and swap-in points are
already documented in `src/App.jsx`, and I can scaffold the Supabase-backed
version next.

## File structure

```
terra-deploy/
├── index.html          — HTML entry, SEO meta tags
├── package.json        — dependencies (React, Vite)
├── vite.config.js      — build config
├── vercel.json          — SPA routing rules for Vercel
└── src/
    ├── main.jsx         — mounts the React app
    ├── theme.css        — design tokens (colors, fonts) used throughout
    └── App.jsx          — the entire application (all pages, all logic)
```
Connected to GitHub + Vercel auto-deploy ✅
