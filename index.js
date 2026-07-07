async function extractStreamUrl(pageUrl) {
  console.log('--- جاري محاولة جلب الرابط من: ' + pageUrl + ' ---');
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

    // 1. البحث في نصوص السكربتات (هنا يختبئ رابط الفيديو عادةً)
    const scripts = $('script');
    let foundUrl = null;
    
    scripts.each((i, el) => {
      const scriptContent = $(el).html();
      if (scriptContent && scriptContent.includes('.m3u8')) {
        const match = scriptContent.match(/https?:\/\/[^"'\s]+\.m3u8/);
        if (match) {
          foundUrl = match[0];
        }
      }
    });

    if (foundUrl) {
      console.log('تم العثور على الرابط داخل السكربتات: ' + foundUrl);
      return foundUrl.replace(/\\\//g, '/');
    }

    // 2. البحث التقليدي في حالة فشل السكربتات
    const m3u8Regex = /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi;
    const matches = html.match(m3u8Regex);
    if (matches && matches.length > 0) {
      console.log('تم العثور على الرابط عبر Regex: ' + matches[0]);
      return matches[0].replace(/\\\//g, '/');
    }

    console.log('فشل: الرابط ليس في HTML ولا داخل السكربتات.');
    return null;

  } catch (err) {
    console.error('خطأ الاتصال: ' + err.message);
    return null;
  }
}
