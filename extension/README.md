# Save to NoteZ — Chrome Extension

A minimal Manifest V3 clipper that saves the current tab's URL into your NoteZ folders.

## Setup (development)

1. Replace `SUPABASE_URL` and `YOUR_ANON_KEY` in `popup.js` with your project values.
2. Replace `NOTEZ_ORIGIN` with your deployed app URL.
3. Open `chrome://extensions`, enable Developer Mode, click "Load unpacked", select this folder.

## How it works

1. Reads the Supabase JWT from the active NoteZ tab's localStorage (no separate auth flow).
2. Creates a `sources` row via the Supabase REST API, then calls the `process-source` edge function.
3. All existing SSRF protections in `process-source` apply — the extension cannot bypass them.

## Build for production

Replace the hardcoded constants with a build step (e.g. `envsubst` or a webpack build) that
injects the environment variables at package time. Never ship your service-role key in an extension.
