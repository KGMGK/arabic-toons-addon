const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 10000;

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const BASE_URL = 'https://www.arabic-toons.com';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

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

async function extractStreamUrl(pageUrl) {
  console.log('DEBUG: محاولة جلب رابط من: ' + pageUrl);
  try {
    const res = await axios.get(pageUrl, {
      headers: { 'User-Agent': USER_AGENT, 'Referer': BASE_URL + '/' },
      timeout: 15000
    });
    
    console.log('DEBUG: تم جلب الصفحة. الحالة: ' + res.status);
    const html = res.data;

    // البحث المباشر
    const m3u8Regex = /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi;
    const matches = html.match(m3u8Regex);

    if (matches && matches.length > 0) {
      console.log('DEBUG: تم العثور على الرابط: ' + matches[0]);
      return matches[0].replace(/\\\//g, '/');
    }

    // هنا يكمن السر: إذا لم يجد الرابط، اطبع جزء من الصفحة لنعرف أين هو
    console.log('DEBUG: لم أجد رابط m3u8. إليك أول 500 حرف من الصفحة:');
    console.log(html.substring(0, 500));
    
    return null;
  } catch (err) {
    console.error('DEBUG: خطأ في axios: ' + err.message);
    return null;
  }
}

// الـ Stream Route
app.get('/stream/series/:id.json', async (req, res) => {
  const parts = req.params.id.split(':');
  const key = parts[1];
  const episodeNumber = parseInt(parts[3], 10);
  const cartoon = CARTOONS[key];
  if (!cartoon) return res.status(404).json({ streams: [] });

  const pageUrl = `${BASE_URL}/${cartoon.urlPrefix}-${cartoon.firstEpisodeId + (episodeNumber - 1)}${cartoon.urlSuffix}.html`;
  console.log('DEBUG: الرابط المطلوب: ' + pageUrl);
  
  const streamUrl = await extractStreamUrl(pageUrl);
  if (!streamUrl) return res.json({ streams: [] });

  const publicBase = `${req.protocol}://${req.get('host')}`;
  res.json({ streams: [{ title: `${cartoon.name} - الحلقة ${episodeNumber}`, url: `${publicBase}/proxy/m3u8?url=${encodeURIComponent(streamUrl)}` }] });
});

// Proxy routes (كما هي)
app.get('/proxy/m3u8', async (req, res) => {
  try {
    const upstream = await axios.get(req.query.url, { headers: { 'User-Agent': USER_AGENT, 'Referer': BASE_URL + '/' } });
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
    const upstream = await axios.get(req.query.url, { headers: { 'User-Agent': USER_AGENT, 'Referer': BASE_URL + '/' }, responseType: 'stream' });
    upstream.data.pipe(res);
  } catch (err) { res.status(502).send('proxy error'); }
});

app.get('/manifest.json', (req, res) => {
  res.json({ id: 'com.khalifa.arabictoons', version: '1.0.0', name: 'Arabic Toons', resources: ['catalog', 'meta', 'stream'], types: ['series'], catalogs: [{ type: 'series', id: 'arabic-toons-classics', name: 'كرتون قديم مدبلج' }], idPrefixes: ['at:'] });
});
app.get('/catalog/series/arabic-toons-classics.json', (req, res) => { res.json({ metas: Object.keys(CARTOONS).map(k => ({ id: `at:${k}`, type: 'series', name: CARTOONS[k].name, poster: CARTOONS[k].poster })) }); });
app.get('/meta/series/:id.json', (req, res) => {
  const k = req.params.id.replace('at:', '');
  const c = CARTOONS[k];
  res.json({ meta: { id: `at:${k}`, type: 'series', name: c.name, poster: c.poster, videos: Array.from({ length: c.totalEpisodes }, (_, i) => ({ id: `at:${k}:1:${i+1}`, title: `الحلقة ${i+1}`, season: 1, episode: i+1 })) } });
});

app.listen(PORT, '0.0.0.0', () => console.log(`Running on ${PORT}`));
