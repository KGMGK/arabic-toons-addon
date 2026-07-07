async function extractStreamUrl(pageUrl) {
  console.log('--- DEBUG: فحص شامل للصفحة ---');
  try {
    const res = await axios.get(pageUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': BASE_URL + '/'
      },
      timeout: 15000
    });

    const html = res.data;
    const $ = cheerio.load(html);

    // 1. البحث عن أي روابط في الـ iframes
    const iframe = $('iframe').attr('src');
    if (iframe) console.log('DEBUG: وجدت iframe: ' + iframe);

    // 2. البحث عن أي روابط تحتوي على m3u8 أو mp4
    const links = [];
    $('a, source, video').each((i, el) => {
        const link = $(el).attr('src') || $(el).attr('href');
        if (link && (link.includes('m3u8') || link.includes('mp4'))) {
            links.push(link);
        }
    });

    // 3. البحث في السكربتات عن أي نص طويل يشبه الرابط
    const scriptLinks = html.match(/(https?:\/\/[^\s"'<>]+\.(m3u8|mp4|mkv))/gi);
    
    console.log('DEBUG: روابط m3u8/mp4 عثرت عليها: ', links);
    console.log('DEBUG: روابط عثرت عليها عبر السكربتات: ', scriptLinks);

    // سنأخذ أول رابط نجده
    if (links.length > 0) return links[0];
    if (scriptLinks && scriptLinks.length > 0) return scriptLinks[0];

    return null;

  } catch (err) {
    console.error('خطأ فادح: ' + err.message);
    return null;
  }
}
