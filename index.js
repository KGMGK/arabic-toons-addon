const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 7000;

// السماح لأي موقع (زي web.stremio.com) بالوصول للإضافة
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ------------------------------------------------------------------
// إعدادات عامة
// ------------------------------------------------------------------
const BASE_URL = 'https://www.arabic-toons.com';
const USER_AGENT = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// قائمة الكرتونات المدعومة حاليًا
// slug: الجزء الثابت من رابط الحلقة الأولى (بدون الرقم التسلسلي ورقم الحلقة)
// firstId: رقم تسلسل الحلقة الأولى (يزيد بواحد لكل حلقة تالية)
// episodes: عدد الحلقات الكلي
const CARTOONS = {
  'tomandjerry': {
    name: 'توم وجيري',
    poster: 'https://www.arabic-toons.com/images/anime/cat_1441974636.jpg',
    urlPrefix: 'tom-and-jerry-old-1441974636',
    firstEpisodeId: 6832,
    totalEpisodes: 151
  }
};

// ------------------------------------------------------------------
// أدوات مساعدة
// ------------------------------------------------------------------

// يبني رابط صفحة حلقة معينة
function buildEpisodePageUrl(cartoonKey, episodeNumber) {
  const cartoon = CARTOONS[cartoonKey];
  if (!cartoon) return null;
  const seqId = cartoon.firstEpisodeId + (episodeNumber - 1);
  return `${BASE_URL}/${cartoon.urlPrefix}-${seqId}.html`;
}

// يجلب صفحة الحلقة ويستخرج رابط m3u8 (أو أي مصدر فيديو) منها
async function extractStreamUrl(pageUrl) {
  const res = await axios.get(pageUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'ar,en;q=0.9'
    },
    timeout: 15000
  });

  const html = res.data;

  // نبحث عن أي رابط m3u8 داخل الصفحة (مضمن مباشرة بجافاسكربت، أو داخل data attribute)
  const m3u8Regex = /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi;
  const matches = html.match(m3u8Regex);

  if (matches && matches.length > 0) {
    // ننظف أي escape زائد (\/ -> /)
    return matches[0].replace(/\\\//g, '/');
  }

  // إذا ما لقينا m3u8 مباشر، نجرب نلقط رابط iframe كبديل
  const $ = cheerio.load(html);
  const iframeSrc = $('iframe').first().attr('src');
  if (iframeSrc) {
    return iframeSrc;
  }

  return null;
}

// ------------------------------------------------------------------
// Manifest
// ------------------------------------------------------------------
const manifest = {
  id: 'com.khalifa.arabictoons',
  version: '1.0.0',
  name: 'Arabic Toons - كرتون قديم',
  description: 'إضافة تجلب الكرتون العربي القديم المدبلج من arabic-toons.com',
  logo: 'https://www.arabic-toons.com/img/logo.png',
  resources: ['catalog', 'meta', 'stream'],
  types: ['series'],
  catalogs: [
    {
      type: 'series',
      id: 'arabic-toons-classics',
      name: 'كرتون قديم مدبلج'
    }
  ],
  idPrefixes: ['at:']
};

app.get('/manifest.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(manifest);
});

// ------------------------------------------------------------------
// Catalog: قائمة الكرتونات المتوفرة
// ------------------------------------------------------------------
app.get('/catalog/series/arabic-toons-classics.json', (req, res) => {
  const metas = Object.keys(CARTOONS).map((key) => {
    const c = CARTOONS[key];
    return {
      id: `at:${key}`,
      type: 'series',
      name: c.name,
      poster: c.poster
    };
  });
  res.setHeader('Content-Type', 'application/json');
  res.json({ metas });
});

// ------------------------------------------------------------------
// Meta: تفاصيل الكرتون + قائمة الحلقات
// ------------------------------------------------------------------
app.get('/meta/series/:id.json', (req, res) => {
  const id = req.params.id; // مثال: at:tomandjerry
  const key = id.replace('at:', '');
  const cartoon = CARTOONS[key];

  if (!cartoon) {
    return res.status(404).json({ err: 'not found' });
  }

  const videos = [];
  for (let i = 1; i <= cartoon.totalEpisodes; i++) {
    videos.push({
      id: `at:${key}:1:${i}`,
      title: `الحلقة ${i}`,
      season: 1,
      episode: i
    });
  }

  res.setHeader('Content-Type', 'application/json');
  res.json({
    meta: {
      id: `at:${key}`,
      type: 'series',
      name: cartoon.name,
      poster: cartoon.poster,
      videos
    }
  });
});

// ------------------------------------------------------------------
// Stream: يجيب رابط الفيديو الفعلي لحلقة معينة (عن طريق البروكسي)
// ------------------------------------------------------------------
app.get('/stream/series/:id.json', async (req, res) => {
  const id = req.params.id; // مثال: at:tomandjerry:1:5
  const parts = id.split(':'); // ['at', 'tomandjerry', '1', '5']
  const key = parts[1];
  const episodeNumber = parseInt(parts[3], 10);

  const cartoon = CARTOONS[key];
  if (!cartoon || !episodeNumber) {
    return res.status(404).json({ streams: [] });
  }

  try {
    const pageUrl = buildEpisodePageUrl(key, episodeNumber);
    const streamUrl = await extractStreamUrl(pageUrl);

    if (!streamUrl) {
      return res.json({ streams: [] });
    }

    // نبني رابط يمر عبر سيرفرنا (بروكسي) بدل ما نعطي الرابط الأصلي مباشرة
    const publicBase = `${req.protocol}://${req.get('host')}`;
    const proxiedUrl = `${publicBase}/proxy/m3u8?url=${encodeURIComponent(streamUrl)}`;

    res.setHeader('Content-Type', 'application/json');
    res.json({
      streams: [
        {
          title: `${cartoon.name} - الحلقة ${episodeNumber}`,
          url: proxiedUrl
        }
      ]
    });
  } catch (err) {
    console.error('Stream extraction error:', err.message);
    res.json({ streams: [] });
  }
});

// ------------------------------------------------------------------
// Proxy: يمرر ملف m3u8 (playlist) ويعيد كتابة روابط المقاطع لتمر عبرنا
// ------------------------------------------------------------------
app.get('/proxy/m3u8', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('missing url');
  }

  try {
    const upstream = await axios.get(targetUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': BASE_URL + '/'
      },
      timeout: 15000,
      responseType: 'text'
    });

    const publicBase = `${req.protocol}://${req.get('host')}`;
    const lines = upstream.data.split('\n');

    const rewritten = lines.map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return line;
      }
      // نحول أي رابط نسبي إلى رابط مطلق أولاً
      const absoluteUrl = new URL(trimmed, targetUrl).toString();

      if (absoluteUrl.includes('.m3u8')) {
        return `${publicBase}/proxy/m3u8?url=${encodeURIComponent(absoluteUrl)}`;
      }
      return `${publicBase}/proxy/segment?url=${encodeURIComponent(absoluteUrl)}`;
    });

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.send(rewritten.join('\n'));
  } catch (err) {
    console.error('m3u8 proxy error:', err.message);
    res.status(502).send('proxy error');
  }
});

// ------------------------------------------------------------------
// Proxy: يمرر مقاطع الفيديو (.ts) بالبيانات الخام
// ------------------------------------------------------------------
app.get('/proxy/segment', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('missing url');
  }

  try {
    const headers = {
      'User-Agent': USER_AGENT,
      'Referer': BASE_URL + '/'
    };
    // ندعم Range requests عشان التقديم بالفيديو يشتغل صح
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const upstream = await axios.get(targetUrl, {
      headers,
      responseType: 'stream',
      timeout: 20000,
      validateStatus: () => true
    });

    res.status(upstream.status);
    if (upstream.headers['content-type']) {
      res.setHeader('Content-Type', upstream.headers['content-type']);
    }
    if (upstream.headers['content-length']) {
      res.setHeader('Content-Length', upstream.headers['content-length']);
    }
    if (upstream.headers['content-range']) {
      res.setHeader('Content-Range', upstream.headers['content-range']);
    }
    res.setHeader('Accept-Ranges', 'bytes');

    upstream.data.pipe(res);
  } catch (err) {
    console.error('segment proxy error:', err.message);
    res.status(502).send('proxy error');
  }
});

// ------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Arabic Toons addon running on port ${PORT}`);
});
