async function extractStreamUrl(pageUrl) {
  console.log('--- محاولة جلب الرابط من: ' + pageUrl + ' ---');
  try {
    const res = await axios.get(pageUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': BASE_URL + '/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
      },
      timeout: 15000
    });

    const html = res.data;
    
    // سأطبع هنا محتوى الصفحة عشان نشوف ليش ما يلقى الرابط
    console.log('--- تم استلام محتوى الصفحة (أول 1000 حرف): ---');
    console.log(html.substring(0, 1000));

    // بحث عن رابط m3u8
    const m3u8Regex = /https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>]*/gi;
    const matches = html.match(m3u8Regex);

    if (matches && matches.length > 0) {
      console.log('تم العثور على رابط فيديو في الصفحة!');
      return matches[0].replace(/\\\//g, '/');
    }

    console.log('فشل العثور على رابط m3u8 في المحتوى المستلم.');
    return null;
  } catch (err) {
    console.error('خطأ الاتصال بالموقع:', err.message);
    return null;
  }
}
