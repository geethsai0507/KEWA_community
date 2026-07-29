# Executives Club Community Portal

A web app built with TanStack Start, React, TypeScript, and Tailwind CSS.

## Prerequisites

- [Node.js](https://nodejs.org/) (v20 or later) — includes `npm`
- [Bun](https://bun.sh/) (recommended) — this project ships a `bun.lock`, which is what it's actually built and tested against

### Installing Bun

**macOS / Linux:**

```sh
curl -fsSL https://bun.sh/install | bash
```

**Windows (PowerShell):**

```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

After installing, **close and reopen your terminal** so `bun` is picked up on your `PATH`. If you installed Bun from an already-open terminal and don't want to restart it, run this first in that window:

```powershell
$env:Path += ";$env:USERPROFILE\.bun\bin"
```

## Setup (new computer)

Pick a source (Git or zip) and a package manager (Bun or npm).

### Get the code

#### Option A: Clone with Git

```sh
git clone <this-repository-url>
cd <repository-name>
```

#### Option B: From a zip file

1. Extract the zip file to a folder.
2. Open a terminal in that folder.

### Install and run

#### With Bun (recommended)

```sh
bun install
bun run dev
```

#### With npm

```sh
npm install --legacy-peer-deps
npm run dev
```

> `--legacy-peer-deps` is required because one dependency (`@hookform/resolvers`) declares a peer range npm resolves more strictly than Bun does. It's safe here — a working `bun.lock` is what actually pins the versions used.

Either way, the dev server starts at `http://localhost:8080/`.

## Hall Booking Setup

The `/hall` and `/admin` routes are backed by Firebase (Firestore + Auth) and EmailJS — there's no custom backend server. To run them locally:

1. Create a Firebase project (Firestore in production mode, Authentication with the Email/Password provider enabled) and copy the Web App config values into a `.env` file at the repo root — see `.env.example` for the required `VITE_FIREBASE_*` variables.
2. Create one admin user under Authentication → Users in the Firebase console (there's no self-registration UI by design), and set `VITE_ADMIN_EMAIL` in `.env` to that email.
3. Deploy the security rules that actually enforce authorization (`firestore.rules` in the repo root — client-side checks alone aren't sufficient): `bunx firebase-tools deploy --only firestore:rules` (requires `firebase login` first).
4. Create an [EmailJS](https://www.emailjs.com/) account, an email service, and the four templates referenced in `src/lib/hall/email.ts`, then set `VITE_EMAILJS_SERVICE_ID` and `VITE_EMAILJS_PUBLIC_KEY` in `.env`.

Without this setup, `/hall` and `/admin` will fail at runtime (Firestore reads/writes rejected or misconfigured), even though the rest of the site works.

## Available scripts

| Command | Bun | npm |
| --- | --- | --- |
| Start dev server | `bun run dev` | `npm run dev` |
| Build for production | `bun run build` | `npm run build` |
| Build in dev mode | `bun run build:dev` | `npm run build:dev` |
| Preview production build | `bun run preview` | `npm run preview` |
| Lint | `bun run lint` | `npm run lint` |
| Format with Prettier | `bun run format` | `npm run format` |

## Tech stack

- [TanStack Start](https://tanstack.com/start) (routing/SSR)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
