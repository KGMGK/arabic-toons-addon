async function extractStreamUrl(pageUrl) {
  console.log('--- جاري محاولة جلب الرابط من: ' + pageUrl + ' ---');
  try {
    const res = await axios.get(pageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Referer': BASE_URL + '/'
      },
      timeout: 15000
    });

    const html = res.data;
    const $ = cheerio.load(html);

    // 1. محاولة البحث في وسم <source> (المشغل القياسي)
    let videoUrl = $('source').attr('src') || $('video').attr('src');
    if (videoUrl) {
      console.log('تم العثور على الرابط عبر Cheerio: ' + videoUrl);
      return videoUrl;
    }

    // 2. محاولة البحث المباشر عن رابط m3u8 عبر Regex
    const m3u8Regex = /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi;
    const matches = html.match(m3u8Regex);
    if (matches && matches.length > 0) {
      console.log('تم العثور على الرابط عبر Regex: ' + matches[0]);
      return matches[0].replace(/\\\//g, '/');
    }

    // 3. محاولة البحث في روابط الـ data-src
    const dataSrc = $('[data-src]').attr('data-src');
    if (dataSrc && dataSrc.includes('.m3u8')) {
        console.log('تم العثور على الرابط عبر data-src: ' + dataSrc);
        return dataSrc;
    }

    console.log('خطأ: لم أجد رابطاً بأي وسيلة في هذه الصفحة.');
    return null;

  } catch (err) {
    console.error('خطأ أثناء الاستخراج: ' + err.message);
    return null;
  }
}
