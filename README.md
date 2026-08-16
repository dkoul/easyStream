# easyStream

**Be there, even when you can't be there.**

easyStream is a Phase 1 MVP for Indian families who want to share a prayer meet, wedding, or family function with relatives who cannot attend in person.

The broadcaster creates an event on a phone, presses **Start Live**, and shares a WhatsApp link. Relatives open the link in a browser — no app, no login — and watch inside a personalized event frame. When the stream ends, the same URL becomes the recording.

## What this repository contains

| Path | Role |
| --- | --- |
| `apps/api` | Node.js / TypeScript backend: phone OTP, events, unlisted URLs, live lifecycle, recordings |
| `apps/viewer` | Next.js viewer + a web **Studio** that mirrors the Android journey for demos |
| `apps/android` | Kotlin / Jetpack Compose broadcaster app (camera, start/stop, WhatsApp share) |

Streaming ingest is **not** built from scratch. The API has a `StreamProvider` seam:

- **Demo mode (default):** the viewer plays a public HLS fixture so the product can be walked through without Mux credentials.
- **Mux:** set `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET` to create real live streams (RTMP ingest + HLS playback + recording).

## Event lifecycle

`Draft → Upcoming → Live → Processing → Completed`

Events are **unlisted**. There is no public directory. The shareable URL is human-readable plus a short random suffix, for example:

`http://localhost:3000/e/rajesh-koul-prayer-meet-a7k2x9`

## Run locally

Requires Node 20+.

```bash
npm install
npm run dev:api      # http://localhost:4000
npm run dev:viewer   # http://localhost:3000
```

Open [http://localhost:3000/studio](http://localhost:3000/studio).

- Phone OTP in development is **123456**.
- Create a Prayer Meet, choose a design, preview, start live, share the link, then stop. The same URL shows the recording after a short processing pause.

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
- CameraX preview supports front/rear switching. Network, battery, and microphone presence are shown in plain language.
- Real camera ingest to Mux is the next wiring step once `MUX_*` credentials exist; until then, Start Live still creates a live event page relatives can open.

## MVP acceptance (this slice)

**Broadcaster**

- Create an event in a short guided flow
- Add a photograph and choose Classic / Elegant / Traditional
- Preview what relatives will see
- Start and stop with one primary action
- See live duration, network, audio, and battery
- Get a shareable URL and share via WhatsApp / the system share sheet
- Recording is generated automatically (demo fixture, or Mux asset when configured)

**Viewer**

- Open the URL with no app and no account
- Personalized frame on mobile and desktop
- Live and recording playback, including full screen
- Unlisted: only people with the link can watch

## Privacy

Family events are unlisted by default. The broadcaster sees: *Anyone with this link can watch.* Password / OTP for viewers is intentionally out of MVP scope.

## Product hypothesis

If an older family member can start a livestream with almost no technical knowledge, and relatives can join from a WhatsApp link, families will use this when physical attendance is impossible.
