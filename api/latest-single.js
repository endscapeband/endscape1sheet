function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function parseArtistIdFromUrl(url) {
  const match = String(url || '').match(/artist\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

export default async function handler(req, res) {
  try {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    const artistIdEnv = process.env.SPOTIFY_ARTIST_ID;
    const artistName = process.env.SPOTIFY_ARTIST_NAME || 'ENDSCAPE';
    const artistUrl = process.env.SPOTIFY_ARTIST_URL;

    if (!clientId || !clientSecret) {
      res.status(500).json({ error: 'Missing Spotify API environment variables.' });
      return;
    }

    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    if (!tokenResponse.ok) {
      res.status(502).json({ error: 'Spotify token request failed.' });
      return;
    }

    const tokenJson = await tokenResponse.json();
    const accessToken = tokenJson.access_token;
    let artistId = artistIdEnv || parseArtistIdFromUrl(artistUrl);

    if (!artistId) {
      const artistSearchResponse = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(
          `artist:${artistName}`
        )}&type=artist&market=US&limit=25`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      if (!artistSearchResponse.ok) {
        res.status(502).json({ error: 'Spotify artist lookup failed.' });
        return;
      }

      const artistSearchJson = await artistSearchResponse.json();
      const artistCandidates = Array.isArray(artistSearchJson?.artists?.items) ? artistSearchJson.artists.items : [];
      const targetName = normalizeName(artistName);

      const exact = artistCandidates.find((artist) => normalizeName(artist?.name) === targetName);
      const partial = artistCandidates.find((artist) => normalizeName(artist?.name).includes(targetName));
      const chosen = exact || partial || artistCandidates[0] || null;
      artistId = chosen?.id || null;
    }

    if (!artistId) {
      res.status(404).json({ error: 'Spotify artist not found.' });
      return;
    }

    const singlesResponse = await fetch(
      `https://api.spotify.com/v1/artists/${encodeURIComponent(
        artistId
      )}/albums?include_groups=single&market=US&limit=20`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    if (!singlesResponse.ok) {
      res.status(502).json({ error: 'Spotify releases request failed.' });
      return;
    }

    const singlesJson = await singlesResponse.json();
    const singles = Array.isArray(singlesJson.items) ? singlesJson.items : [];
    const artistSingles = singles.filter((single) =>
      Array.isArray(single?.artists) && single.artists.some((artist) => artist?.id === artistId)
    );
    const scopedSingles = artistSingles.length > 0 ? artistSingles : singles;

    if (scopedSingles.length === 0) {
      res.status(200).json([]);
      return;
    }

    scopedSingles.sort((a, b) => new Date(b.release_date) - new Date(a.release_date));
    const latestRelease = scopedSingles[0];

    const tracksResponse = await fetch(
      `https://api.spotify.com/v1/albums/${encodeURIComponent(latestRelease.id)}/tracks?limit=1`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    if (!tracksResponse.ok) {
      res.status(502).json({ error: 'Spotify track request failed.' });
      return;
    }

    const tracksJson = await tracksResponse.json();
    const allTracks = Array.isArray(tracksJson.items) ? tracksJson.items : [];
    const artistTrack =
      allTracks.find((track) => Array.isArray(track?.artists) && track.artists.some((artist) => artist?.id === artistId)) ||
      allTracks[0] ||
      null;
    const trackId = artistTrack?.id || null;
    const spotifyUrl = artistTrack?.external_urls?.spotify || latestRelease?.external_urls?.spotify || null;

    res.status(200).json({
      title: artistTrack?.name || latestRelease?.name || 'Latest release',
      releaseDate: latestRelease?.release_date || null,
      spotifyUrl,
      embedUrl: trackId
        ? `https://open.spotify.com/embed/track/${trackId}?utm_source=generator`
        : latestRelease?.id
          ? `https://open.spotify.com/embed/album/${latestRelease.id}?utm_source=generator`
          : null
    });
  } catch (error) {
    res.status(500).json({ error: 'Unable to load latest single.', details: error.message });
  }
}
