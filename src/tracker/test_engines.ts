async function testEngines() {
  const targets = [
    { name: '1. FB Illuminati', q: 'site:facebook.com "illuminati" "Whatsapp"' },
    { name: '2. Insta Spellcaster', q: 'site:instagram.com "spellcaster" "Whatsapp"' },
    { name: '3. Guestbook Spell', q: 'inurl:"guestbook" spell whatsapp' },
    { name: '4. FB BTC Recovery', q: 'site:facebook.com "btc recovery" "Whatsapp"' },
    { name: '5. Insta BTC Recovery', q: 'site:instagram.com "btc recovery" "Whatsapp"' },
    { name: '6. Amazon Publisher', q: '"book publisher" "amazon" "chat"' },
  ];

  for (const t of targets) {
    console.log(`\n================ Testing ${t.name} ================`);

    // Try variant 1: Yahoo search
    try {
      const yUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(t.q)}`;
      const yRes = await fetch(yUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
      });
      const yText = await yRes.text();
      console.log(`Yahoo (${t.name}) status: ${yRes.status}, length: ${yText.length}`);

      const phoneRegex = /(?:\+?\d{1,4}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,5}|\+\d{10,15}/g;
      const stripped = yText.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                            .replace(/<[^>]+>/g, ' ')
                            .replace(/\s+/g, ' ');
      const phones = (stripped.match(phoneRegex) || []).filter(p => p.length >= 10 && !p.startsWith('1787') && !p.startsWith('1120'));
      console.log('Yahoo sample phones:', Array.from(new Set(phones)).slice(0, 8));
    } catch (e: any) {
      console.log('Yahoo err:', e.message);
    }

    // Try variant 2: Bing search
    try {
      const bUrl = `https://www.bing.com/search?q=${encodeURIComponent(t.q)}`;
      const bRes = await fetch(bUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
      });
      const bText = await bRes.text();
      console.log(`Bing (${t.name}) status: ${bRes.status}, length: ${bText.length}`);
      const strippedB = bText.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                             .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                             .replace(/<[^>]+>/g, ' ')
                             .replace(/\s+/g, ' ');
      const phoneRegex = /(?:\+?\d{1,4}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,5}|\+\d{10,15}/g;
      const phonesB = (strippedB.match(phoneRegex) || []).filter(p => p.length >= 10);
      console.log('Bing sample phones:', Array.from(new Set(phonesB)).slice(0, 8));
    } catch (e: any) {
      console.log('Bing err:', e.message);
    }
  }
}

testEngines();
