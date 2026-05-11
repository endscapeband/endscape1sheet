# Dynamic Data Endpoints

These serverless endpoints power automatic content updates on the site:

- `GET /api/latest-single`
  - Uses Spotify Web API to fetch ENDSCAPE's most recent single.
  - Requires `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_ARTIST_ID`.

- `GET /api/tour-dates`
  - Uses the official Bandsintown REST API endpoint:
    `https://rest.bandsintown.com/artists/{artist}/events?app_id={APP_ID}&date=upcoming`
  - Tries artist keys in order: `BANDSINTOWN_ARTIST`, `id_15497599`, `endscape`, `ENDSCAPE`.
  - Optional env vars:
    - `BANDSINTOWN_APP_ID` (defaults to `endscape_site`)
    - `BANDSINTOWN_ARTIST` (override artist key)

- `GET /api/merch`
  - Fetches `https://endscape.sumupstore.com/products`
  - Attempts product extraction from JSON-LD first, then falls back to generic HTML parsing
  - Returns product `title`, `price`, `image`, and `url` for homepage merch cards

Notes:
- These endpoints are intended for serverless hosting (for example Vercel style `/api/*.js` routes).
- If the site is opened as static files only (`file://`), API calls will fail and front-end fallbacks are shown.
