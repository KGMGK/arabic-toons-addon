const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

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
const USER_AGENT = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

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
  return `${BASE_URL}/${cartoon.urlPrefix}-${seqId}.html`;
}

async function extractStreamUrl(pageUrl) {
  const res = await axios.get(pageUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'ar,en;q=0.9'
    },
    timeout: 15000
  });

  const html = res.data;

  const m3u8Regex = /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi;
  const matches = html.match(m3u8Regex);

  if (matches && matches.length > 0) {
    return matches[0].replace(/\\\//g, '/');
  }

  const $ = cheerio.load(html);
  const iframeSrc = $('iframe').first().attr('src');
  if (iframeSrc) {
    return iframeSrc;
  }

  return null;
}

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

app.get('/stream/series/:id.json', async (req, res) => {
  const id = req.params.id;
  const parts = id.split(':');
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

    const publicBase = `${req.protocol}://${req.get('host')}`;
    const proxiedUrl = `${publicBase}/proxy/m3u8?url=${encodeURIComponent(streamUrl)}`;

    res.setHeader('Content-Type', 'application/
