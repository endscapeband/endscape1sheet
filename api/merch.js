const STORE_URL = 'https://endscape.sumupstore.com/products';
const STORE_ORIGIN = 'https://endscape.sumupstore.com';

function absoluteUrl(url) {
  if (!url) {
    return null;
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (url.startsWith('//')) {
    return `https:${url}`;
  }

  return new URL(url, STORE_ORIGIN).toString();
}

function normalizeProduct(product) {
  const url = absoluteUrl(product.url);
  const image = absoluteUrl(product.image);

  if (!product.title || !url) {
    return null;
  }

  return {
    title: product.title.trim(),
    price: (product.price || '').trim() || null,
    image,
    url
  };
}

function extractJsonLdProducts(html) {
  const matches = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  const products = [];

  const visit = (node) => {
    if (!node || typeof node !== 'object') {
      return;
    }

    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }

    const type = node['@type'];
    if (type === 'Product') {
      products.push(
        normalizeProduct({
          title: node.name,
          price: node.offers?.price ? `${node.offers.priceCurrency || ''} ${node.offers.price}`.trim() : null,
          image: Array.isArray(node.image) ? node.image[0] : node.image,
          url: node.url
        })
      );
    }

    Object.values(node).forEach(visit);
  };

  matches.forEach((match) => {
    try {
      visit(JSON.parse(match[1]));
    } catch (_) {
      // Ignore invalid JSON-LD blocks and continue.
    }
  });

  return products.filter(Boolean);
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractHtmlProducts(html) {
  const anchorMatches = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
  const seen = new Set();
  const products = [];

  anchorMatches.forEach((match) => {
    const href = match[1];
    const inner = match[2];

    if (!/sumupstore\.com|^\/(products|product|p)\//i.test(href) && !/href="\/products\//i.test(match[0])) {
      return;
    }

    const url = absoluteUrl(href);
    if (!url || url.endsWith('/products') || seen.has(url)) {
      return;
    }

    const imageMatch = inner.match(/<img[^>]*src="([^"]+)"/i);
    const priceMatch =
      inner.match(/([A-Z]{3}\s?\d+(?:[.,]\d{2})?)/i) ||
      inner.match(/([£$€]\s?\d+(?:[.,]\d{2})?)/i);
    const text = decodeEntities(inner.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    const title = text
      .replace(priceMatch?.[1] || '', '')
      .replace(/^(buy|shop now|details)\b/gi, '')
      .trim();

    if (!title) {
      return;
    }

    seen.add(url);
    products.push(
      normalizeProduct({
        title,
        price: priceMatch?.[1] || null,
        image: imageMatch?.[1] || null,
        url
      })
    );
  });

  return products.filter(Boolean);
}

export default async function handler(req, res) {
  try {
    const response = await fetch(STORE_URL, {
      headers: {
        'User-Agent': 'ENDSCAPE-site/1.0',
        Accept: 'text/html,application/xhtml+xml'
      }
    });

    if (!response.ok) {
      res.status(502).json({ error: 'Unable to fetch SumUp store page.' });
      return;
    }

    const html = await response.text();
    const products = extractJsonLdProducts(html);
    const merged = products.length > 0 ? products : extractHtmlProducts(html);

    res.status(200).json(merged.slice(0, 24));
  } catch (error) {
    res.status(500).json({ error: 'Unable to load merch.', details: error.message });
  }
}
