# easyStream

**Be there, even when you can't be there.**

easyStream is a Phase 1 MVP for Indian families who want to share a prayer meet, wedding, or family function with relatives who cannot attend in person.

The broadcaster creates an event on a phone, presses **Start Live**, and shares a WhatsApp link. Relatives open the link in a browser — no app, no login — and watch inside a personalized event frame.

MVP stores **event metadata only** (title, person, date, location, photo, live status). It does **not** store stream recordings.

## What this repository contains

| Path | Role |
| --- | --- |
| `apps/api` | Node.js / TypeScript backend: phone OTP, unlisted event URLs, live lifecycle |
| `apps/viewer` | Next.js viewer + a web **Studio** that mirrors the Android journey for demos |
| `apps/android` | Kotlin / Jetpack Compose broadcaster app (camera, start/stop, WhatsApp share) |
| `supabase/migrations` | Metadata schema for [project txwjbficiwbenbifzpok](https://supabase.com/dashboard/project/txwjbficiwbenbifzpok) |

Live ingest is **not** built from scratch. The API has a `StreamProvider` seam:

- **Demo mode (default):** the viewer plays a public HLS fixture so the product can be walked through without Mux credentials.
- **Mux:** set `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET` for real live ingest. Mux is configured without creating a VOD asset.

## Event lifecycle

`Draft → Upcoming → Live → Completed`

When the stream ends, the event page stays as a digital invitation (photo, names, date). There is no recording playback.

Events are **unlisted**. There is no public directory. The shareable URL is human-readable plus a short random suffix, for example:

`http://localhost:3000/e/rajesh-koul-prayer-meet-a7k2x9`

## Supabase

Metadata lives in Postgres. Event portraits go in the `event-photos` bucket. RLS is enabled; viewers never query Supabase directly.

1. Run `supabase/migrations/20260816120000_event_metadata.sql` in the [SQL editor](https://supabase.com/dashboard/project/txwjbficiwbenbifzpok/sql).
2. Set `SUPABASE_SERVICE_ROLE_KEY` (and optionally `SUPABASE_URL`, defaulting to `https://txwjbficiwbenbifzpok.supabase.co`) on the API.
3. Without the service role key, the API falls back to in-memory metadata for local tests only.

## Run locally

Requires Node 20+.

```bash
npm install
npm run dev:api      # http://localhost:4000
npm run dev:viewer   # http://localhost:3000
```

Open [http://localhost:3000/studio](http://localhost:3000/studio).

- Phone OTP in development is **123456**.
- Create a Prayer Meet, choose a design, preview, start live, share the link, then stop.

```bash
npm test
npm run typecheck
```

## Android app

Open `apps/android` in Android Studio.

- `BuildConfig.API_URL` defaults to `http://10.0.2.2:4000` (emulator → host).
- Point a physical device at your machine's LAN IP.
- Screens follow the PRD: Welcome → OTP → event type → details + photo → design → preview → ready → live → end.
- Share uses the Android share sheet and prefers WhatsApp when installed.

## Privacy

Family events are unlisted by default. The broadcaster sees: *Anyone with this link can watch.* Password / OTP for viewers is intentionally out of MVP scope.
