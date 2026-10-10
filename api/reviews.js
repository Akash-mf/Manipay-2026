/**
 * ManiPay — live Google reviews (runs on Railway via server.js; also works as a Vercel function)
 * GET /api/reviews  →  { rating, total, url, reviews:[...] }
 *
 * Needs these environment variables in Railway → your service → Variables (or Vercel → Settings → Environment Variables):
 *   GOOGLE_PLACES_API_KEY  (or GOOGLE_MAPS_API_KEY)  — key with "Places API (New)" enabled
 *   GOOGLE_PLACE_ID        (optional) — overrides the built-in Place ID below.
 * Google returns at most 5 reviews through this API. They're shown LATEST FIRST (newest date first);
 * only 4★ and 5★ reviews are kept — set MIN_STARS = 1 to show every rating. The result is kept in memory for 3 hours, so Google is asked
 * at most 8 times a day — well inside the 1,000 free requests a month.
 */
// Your listing's Google Maps CID (from the maps link: 0xb1a6acbdddda2516). Used to pick the right place.
const LISTING_CID = '12801108922318071062';
// Place ID for the same listing (derived from 0x3a526342de644e0b:0xb1a6acbdddda2516 in the maps link).
// Lets the function load reviews directly; if Google ever rejects it, it falls back to a search.
const LISTING_PLACE_ID = 'ChIJC05k3kJjUjoRFiXa3b2sprE';
const SEARCH = {
  textQuery: 'ManiPay Credit Card Services, Vijayalakshmipuram Main Rd, Ambattur, Chennai 600053',
  locationBias: { circle: { center: { latitude: 13.125212, longitude: 80.153243 }, radius: 600 } }
};
let cachedPlaceId = null;
const CACHE_MS = 3 * 60 * 60 * 1000; // 3 hours
const MIN_STARS = 4;                 // show only top-rated reviews
let cache = null;                    // { at, data }

async function findPlaceId(key) {
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.googleMapsUri'
    },
    body: JSON.stringify(SEARCH)
  });
  if (!r.ok) throw new Error('Place search failed (' + r.status + ')');
  const data = await r.json();
  if (!data.places || !data.places.length) throw new Error('Listing not found');
  const exact = data.places.find(function (p) { return (p.googleMapsUri || '').indexOf('cid=' + LISTING_CID) !== -1; });
  return (exact || data.places[0]).id;
}

module.exports = async function handler(req, res) {
  const key = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    res.status(503).json({ error: 'Reviews are not configured: add GOOGLE_PLACES_API_KEY in Vercel.' });
    return;
  }
  if (cache && Date.now() - cache.at < CACHE_MS) {
    res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=10800, stale-while-revalidate=86400');
    res.status(200).json(cache.data);
    return;
  }
  try {
    const details = function (id) {
      return fetch('https://places.googleapis.com/v1/places/' + encodeURIComponent(id) + '?languageCode=en', {
        headers: {
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'id,displayName,rating,userRatingCount,reviews,googleMapsUri'
        }
      });
    };
    let r = await details(process.env.GOOGLE_PLACE_ID || cachedPlaceId || LISTING_PLACE_ID);
    if ((r.status === 400 || r.status === 404) && !process.env.GOOGLE_PLACE_ID) {
      cachedPlaceId = await findPlaceId(key); // built-in ID not accepted → find the listing by name
      r = await details(cachedPlaceId);
    }
    if (!r.ok) throw new Error('Place details failed (' + r.status + ')');
    const p = await r.json();

    const reviews = (p.reviews || [])
      .map(function (v) {
        const a = v.authorAttribution || {};
        return {
          name: a.displayName || 'Google user',
          profile: a.uri || '',
          photo: a.photoUri || '',
          rating: v.rating || 0,
          text: (v.text && v.text.text) || (v.originalText && v.originalText.text) || '',
          when: v.relativePublishTimeDescription || '',
          time: v.publishTime || ''
        };
      })
      .filter(function (v) { return v.text && v.rating >= MIN_STARS; })
      .sort(function (a, b) { return (b.time || '').localeCompare(a.time || ''); }); // latest first

    const data = {
      placeId: p.id,
      name: p.displayName && p.displayName.text,
      rating: p.rating || null,
      total: p.userRatingCount || 0,
      url: p.googleMapsUri || ('https://www.google.com/maps?cid=' + LISTING_CID),
      reviews: reviews
    };
    cache = { at: Date.now(), data: data };
    // Browsers keep it 10 min; a CDN (if any) keeps it 3 hours
    res.setHeader('Cache-Control', 'public, max-age=600, s-maxage=10800, stale-while-revalidate=86400');
    res.status(200).json(data);
  } catch (err) {
    if (cache) { // Google hiccup → keep showing the last good reviews
      res.setHeader('Cache-Control', 'no-store');
      res.status(200).json(cache.data);
      return;
    }
    cachedPlaceId = process.env.GOOGLE_PLACE_ID ? cachedPlaceId : null;
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({ error: err.message });
  }
};
