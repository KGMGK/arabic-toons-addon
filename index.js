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

    const $ = cheerio.load(res.data);

    // 1. البحث عن أي iframe (عادة المشغلات تكون هنا)
    const iframeSrc = $('iframe').attr('src');
    if (iframeSrc) {
        console.log('تم العثور على iframe: ' + iframeSrc);
        // إذا كان رابط الـ iframe نفسه يحتوي على m3u8 سنعيده مباشرة
        if (iframeSrc.includes('.m3u8')) return iframeSrc;
        return iframeSrc; // نعيد الـ iframe كمحاولة أخيرة
    }

    // 2. البحث عن رابط فيديو مباشر في وسوم الفيديو
    const videoSrc = $('video').attr('src') || $('source').attr('src');
    if (videoSrc) {
        console.log('تم العثور على video/source: ' + videoSrc);
        return videoSrc;
    }

    console.log('خطأ: لم أجد iframe ولا رابط فيديو مباشر.');
    return null;

  } catch (err) {
    console.error('خطأ الاتصال: ' + err.message);
    return null;
  }
}
