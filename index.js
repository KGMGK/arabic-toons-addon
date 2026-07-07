const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 10000;

// السماح بالوصول
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const BASE_URL = 'https://www.arabic-toons.com';

// إعدادات الكرتونات
const CARTOONS = {
  'tomandjerry': {
    name: 'توم وجيري',
    poster: 'https://www.arabic-toons.com/images/anime/cat_1441974636.jpg',
    urlPrefix: 'tom-and-jerry-old-1441974636',
    firstEpisodeId: 6832,
    totalEpisodes: 151,
    urlSuffix: ''
  },
  'ranzealmudhisha': {
    name: 'رانزي المدهشة',
    poster: 'https://www.arabic-toons.com/images/anime/cat_1441907424.jpg',
    urlPrefix: 'ranze-almudhisha',
    firstEpisodeId: 1441907424,
    totalEpisodes: 34,
    urlSuffix: '-anime-streaming'
  }
};

// أدوات المساعدة
function buildEpisodePageUrl(cartoonKey, episodeNumber) {
  const cartoon = CARTOONS[cartoonKey];
  if (!cartoon) return null;
  const seqId = cartoon.firstEpisodeId + (episodeNumber - 1);
  return `${BASE_URL}/${cartoon.urlPrefix}-${seqId}${cartoon.urlSuffix}.html`;
}

async function extractStreamUrl(pageUrl) {
  console.log('--- جاري محاولة جلب الصفحة من: ' + pageUrl + ' ---');
  try {
    const res = await axios.get(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Referer': 'https://www.google.com/',
        'Accept-Language': 'ar-SA,ar;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      timeout: 15000
    });

    console.log('تم الوصول للموقع بنجاح (Status: ' + res.status + ')');
    const html = res.data;

    // بحث عن رابط m3u8
    const m3u8Regex = /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi;
    const matches = html.match(m3u8Regex);

    if (matches && matches.length > 0) {
      console.log('تم العثور على رابط فيديو: ' + matches[0]);
      return matches[0].replace(/\\\//g, '/');
    }

    console.log('تحذير: الصفحة وصلت ولكن لم نجد رابط الفيديو فيها.');
    return null;
  } catch (err) {
    console.error('خطأ فادح في الاتصال بالموقع: ' + err.message);
    return null;
  }
}

// Manifest
app.get('/manifest.json', (req, res) => {
  res.json({
    id: 'com.khalifa.arabictoons',
    version: '1.0.0',
    name: 'Arabic Toons - كرتون قديم',
    resources: ['catalog', 'meta', 'stream'],
    types: ['series'],
    catalogs: [{ type: 'series', id: 'arabic-toons-classics', name: 'كرتون قديم مدبلج' }],
    idPrefixes: ['at:']
  });
});

// Catalog
app.get('/catalog/series/arabic-toons-classics.json', (req, res) => {
  res.json({ metas: Object.keys(CARTOONS).map(key => ({ id: `at:${key}`, type: 'series', name: CARTOONS[key].name, poster: CARTOONS[key].poster })) });
});

// Meta
app.get('/meta/series/:id.json', (req, res) => {
  const key = req.params.id.replace('at:', '');
  const cartoon = CARTOONS[key];
  if (!cartoon) return res.status(404).json({ err: 'not found' });
  const videos = Array.from({ length: cartoon.totalEpisodes }, (_, i) => ({
    id: `at:${key}:1:${i + 1}`, title: `الحلقة ${i + 1}`, season: 1, episode: i + 1
  }));
  res.json({ meta: { id: `at:${key}`, type: 'series', name: cartoon.name, poster: cartoon.poster, videos } });
});

// Stream
app.get('/stream/series/:id.json', async (req, res) => {
  const parts = req.params.id.split(':');
  const key = parts[1];
  const episodeNumber = parseInt(parts[3], 10);
  console.log('--- طلب تشغيل: ' + key + ' حلقة ' + episodeNumber + ' ---');

  const cartoon = CARTOONS[key];
  if (!cartoon) return res.status(404).json({ streams: [] });

  const pageUrl = buildEpisodePageUrl(key, episodeNumber);
  const streamUrl = await extractStreamUrl(pageUrl);

  if (!streamUrl) return res.json({ streams: [] });

  const publicBase = `${req.protocol}://${req.get('host')}`;
  res.json({ streams: [{ title: `${cartoon.name} - الحلقة ${episodeNumber}`, url: `${publicBase}/proxy/m3u8?url=${encodeURIComponent(streamUrl)}` }] });
});

// Proxy
app.get('/proxy/m3u8', async (req, res) => {
  try {
    const upstream = await axios.get(req.query.url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': BASE_URL + '/' } });
    const publicBase = `${req.protocol}://${req.get('host')}`;
    const rewritten = upstream.data.split('\n').map(line => {
      if (!line.trim() || line.startsWith('#')) return line;
      const abs = new URL(line.trim(), req.query.url).toString();
      return abs.includes('.m3u8') ? `${publicBase}/proxy/m3u8?url=${encodeURIComponent(abs)}` : `${publicBase}/proxy/segment?url=${encodeURIComponent(abs)}`;
    });
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(rewritten.join('\n'));
  } catch (err) { res.status(502).send('proxy error'); }
});

app.get('/proxy/segment', async (req, res) => {
  try {
    const upstream = await axios.get(req.query.url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': BASE_URL + '/' }, responseType: 'stream' });
    upstream.data.pipe(res);
  } catch (err) { res.status(502).send('proxy error'); }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Arabic Toons addon running on port ${PORT}`);
});
