# RSVP PDF Reader

A private, internet-accessible web app to read your own PDFs one word at a time
(Rapid Serial Visual Presentation). Upload a PDF, and it shows a single word at
the center of the screen with the optimal-recognition-point letter highlighted,
plus a context line where the current word stays in the middle. Adjust reading
speed, jump between pages, and your progress is saved automatically per account.

Built with **Next.js + Supabase**, deployable to **Vercel**, using the
**0xProto Nerd Font**.

## Features

- One-word-at-a-time RSVP reader with ORP pivot highlighting
- Context line that keeps the highlighted word centered
- Upload your own PDFs (text extracted in the browser)
- OCR fallback for scanned/image PDFs (client-side via Tesseract.js)
- Adjustable speed (100-900 wpm), page navigation, seek within a page
- Two reading modes: RSVP (word-by-word) and Paragraph mode
- Theme selector: Dark / Night / Sepia
- Auto-saved reading progress (page, word, speed) per user
- Private single-account login (Supabase Auth)
- Keyboard shortcuts: Space (play/pause), Left/Right (word), Up/Down (speed)

## Tech stack

| Concern        | Choice                                         |
| -------------- | ---------------------------------------------- |
| Framework      | Next.js 15 (App Router) + TypeScript           |
| Styling        | Tailwind CSS v4                                |
| Auth / DB      | Supabase (Postgres + Auth)                     |
| File storage   | Supabase Storage (`pdfs` bucket)               |
| PDF extraction | `pdfjs-dist` (runs client-side)                |
| Font           | 0xProto Nerd Font (self-hosted woff2)          |
| Hosting        | Vercel                                         |

## 1. Set up Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. In the dashboard go to **SQL Editor -> New query**, paste the contents of
   [`supabase/schema.sql`](supabase/schema.sql), and click **Run**. This creates
   the `documents` and `reading_progress` tables (with row-level security) and a
   private `pdfs` storage bucket.
3. Create your single private account: **Authentication -> Users -> Add user**,
   enter your email + a password, and tick **Auto Confirm User**.
4. (Recommended) Disable public sign-ups: **Authentication -> Providers ->
   Email**, turn **Allow new users to sign up** off, so only you can log in.
5. Copy your API keys from **Project Settings -> API**:
   - Project URL -> `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 2. Run locally

```bash
# 1. Configure environment
cp .env.local.example .env.local   # then edit with your Supabase values

# 2. Install dependencies (also copies the PDF worker into /public)
npm install

# 3. Start the dev server
npm run dev
```

Open http://localhost:3000 and sign in with the account you created.

> The first `npm install` runs a `postinstall` step that copies the pdf.js
> worker into `public/pdf.worker.min.mjs`. The 0xProto Nerd Font files are
> already included under `public/fonts/`.

## 3. Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In [Vercel](https://vercel.com), **Add New -> Project** and import the repo.
3. Add environment variables in project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy. Your reader is now reachable anywhere via the Vercel URL.

> In Supabase, add your Vercel domain under **Authentication -> URL
> Configuration -> Site URL / Redirect URLs** so auth works in production.

## Notes

- **Scanned PDFs**: the app attempts OCR fallback for image-only pages.
  Very low-quality scans may still fail.
- All data is scoped to your user via row-level security, and PDF files live in
  a private storage bucket keyed by your user id.

## Project structure

```
app/
  login/page.tsx           Login screen
  (app)/layout.tsx         Authenticated shell (header + sign out)
  (app)/library/page.tsx   Upload + list documents
  (app)/reader/[id]/page.tsx  RSVP reader
components/                Rsvp, ContextLine, Controls, Reader, upload, etc.
lib/
  pdf.ts                   Client-side PDF text extraction
  tokenize.ts              Word tokenizer + ORP pivot
  progress.ts              Load/save reading progress
  supabase/                Browser + server + middleware clients
supabase/schema.sql        Database + storage setup
scripts/copy-pdf-worker.mjs  Copies pdf.js worker to /public on install
```
