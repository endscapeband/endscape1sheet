const APP_ID = process.env.BANDSINTOWN_APP_ID || 'endscape_site';

function normalizeShows(payload) {
  const items = Array.isArray(payload) ? payload : [];
  return items
    .map((show) => ({
      date: show?.datetime || null,
      venue: show?.venue?.name || null,
      location: [show?.venue?.city, show?.venue?.region || show?.venue?.country].filter(Boolean).join(', '),
      url: show?.url || show?.offers?.[0]?.url || null
    }))
    .filter((show) => show.date)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

async function fetchEventsForArtist(artistKey) {
  const url = `https://rest.bandsintown.com/artists/${encodeURIComponent(
    artistKey
  )}/events?app_id=${encodeURIComponent(APP_ID)}&date=upcoming`;

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'ENDSCAPE-site/1.0'
    }
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return normalizeShows(data);
}

export default async function handler(req, res) {
  try {
    const candidates = [
      process.env.BANDSINTOWN_ARTIST,
      'id_15497599',
      'endscape',
      'ENDSCAPE'
    ].filter(Boolean);

    for (const artistKey of candidates) {
      const shows = await fetchEventsForArtist(artistKey);
      if (shows.length > 0) {
        res.status(200).json(shows.slice(0, 20));
        return;
      }
    }

    // Return empty list (not an error) when there are no upcoming events.
    res.status(200).json([]);
  } catch (error) {
    res.status(500).json({ error: 'Unable to load tour dates.', details: error.message });
  }
}
