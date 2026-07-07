// --- استبدل الكود القديم بـ CARTOONS هذا ---
const CARTOONS = {
  'tomandjerry': {
    name: 'توم وجيري',
    poster: 'https://www.arabic-toons.com/images/anime/cat_1441974636.jpg',
    urlPrefix: 'tom-and-jerry-old-1441974636',
    firstEpisodeId: 6832,
    totalEpisodes: 151,
    urlSuffix: '' // لا يحتاج إضافة
  },
  'ranzealmudhisha': {
    name: 'رانزي المدهشة',
    poster: 'https://www.arabic-toons.com/images/anime/cat_1441907424.jpg',
    urlPrefix: 'ranze-almudhisha',
    firstEpisodeId: 1441907424,
    totalEpisodes: 34,
    urlSuffix: '-anime-streaming' // هذا هو الجزء الناقص
  }
};

// --- استبدل دالة buildEpisodePageUrl بهذه الدالة ---
function buildEpisodePageUrl(cartoonKey, episodeNumber) {
  const cartoon = CARTOONS[cartoonKey];
  if (!cartoon) return null;
  const seqId = cartoon.firstEpisodeId + (episodeNumber - 1);
  const suffix = cartoon.urlSuffix || ''; 
  return `${BASE_URL}/${cartoon.urlPrefix}-${seqId}${suffix}.html`;
}
