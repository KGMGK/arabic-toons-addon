async function extractStreamUrl(pageUrl) {
  console.log('--- جاري محاولة جلب الرابط من: ' + pageUrl + ' ---');
  
  try {
    const res = await axios.get(pageUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'ar,en;q=0.9',
        'Referer': BASE_URL + '/'
      },
      timeout: 15000
    });

    const html = res.data;

    // بحث عن رابط m3u8
    const m3u8Regex = /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi;
    const matches = html.match(m3u8Regex);

    if (matches && matches.length > 0) {
      const foundUrl = matches[0].replace(/\\\//g, '/');
      console.log('تم العثور على رابط فيديو: ' + foundUrl);
      return foundUrl;
    }

    // إذا لم نجد m3u8، سجل الخطأ لنعرف السبب
    console.log('لم يتم العثور على رابط m3u8 في هذه الصفحة.');
    return null;

  } catch (err) {
    console.error('خطأ أثناء جلب الصفحة: ' + err.message);
    return null;
  }
}
