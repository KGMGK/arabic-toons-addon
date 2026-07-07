const express = require('express');

const app = express();
const PORT = process.env.PORT || 7000;

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const BASE_URL = 'https://www.arabic-toons.com';

const CARTOONS = {
  'tomandjerry': {
    name: 'توم وجيري',
    poster: 'https://www.arabic-toons.com/images/anime/cat_1441974636.jpg',
    urlPrefix: 'tom-and-jerry-old-1441974636',
    firstEpisodeId: 6832,
    totalEpisodes: 151
  }
};

function buildEpisodePageUrl(cartoonKey, episodeNumber) {
  const cartoon = CARTOONS[cartoonKey];
  if (!cartoon) return null;
  const seqId = cartoon.firstEpisodeId + (episodeNumber - 1);
  return `${BASE_URL}/${cartoon.urlPrefix}-${seqId}-anime-streaming.html`;
}

const manifest = {
  id: 'com.khalifa.arabictoons',
  version: '2.0.0',
  name: 'Arabic Toons - كرتون قديم',
  description: 'إضافة تعرض الكرتون العربي القديم المدبلج من arabic-toons.com وتفتح الحلقة بالمتصفح',
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

app.get('/meta/series/:id.json', (req, res) => {
  const id = req.params.id;
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

app.get('/stream/series/:id.json', (req, res) => {
  const id = req.params.id;
  const parts = id.split(':');
  const key = parts[1];
  const episodeNumber = parseInt(parts[3], 10);

  const cartoon = CARTOONS[key];
  if (!cartoon || !episodeNumber) {
    return res.status(404).json({ streams: [] });
  }

  const pageUrl = buildEpisodePageUrl(key, episodeNumber);

  res.setHeader('Content-Type', 'application/json');
  res.json({
    streams: [
      {
        name: 'فتح بالموقع',
        title: `${cartoon.name} - الحلقة ${episodeNumber}\nتفتح بصفحة الموقع بالمتصفح`,
        externalUrl: pageUrl
      }
    ]
  });
});

app.listen(PORT, () => {
  console.log(`Arabic Toons addon running on port ${PORT}`);
});
