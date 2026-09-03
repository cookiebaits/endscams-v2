async function testSearchEngines() {
  const q = 'site:facebook.com "illuminati" "Whatsapp"';
  const enc = encodeURIComponent(q);

  // 1. Google with custom mobile agent
  try {
    const res = await fetch(`https://www.google.com/search?q=${enc}&hl=en`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    });
    const txt = await res.text();
    console.log('Google status:', res.status, 'len:', txt.length);
  } catch (e: any) {
    console.log('Google err:', e.message);
  }

  // 2. Qwant
  try {
    const res = await fetch(`https://api.qwant.com/v3/search/web?q=${enc}&count=10&locale=en_US`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    console.log('Qwant status:', res.status);
    if (res.ok) {
      const data = await res.json();
      console.log('Qwant items:', data?.data?.result?.items?.main?.length);
    }
  } catch (e: any) {
    console.log('Qwant err:', e.message);
  }

  // 3. Yahoo
  try {
    const res = await fetch(`https://search.yahoo.com/search?p=${enc}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });
    const txt = await res.text();
    console.log('Yahoo status:', res.status, 'len:', txt.length);
    const hasNumbers = txt.includes('+234') || txt.includes('+260') || txt.includes('+1') || txt.includes('504');
    console.log('Yahoo has scam numbers:', hasNumbers);
  } catch (e: any) {
    console.log('Yahoo err:', e.message);
  }

  // 4. Mojeek
  try {
    const res = await fetch(`https://www.mojeek.com/search?q=${enc}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const txt = await res.text();
    console.log('Mojeek status:', res.status, 'len:', txt.length);
  } catch (e: any) {
    console.log('Mojeek err:', e.message);
  }

  // 5. Brave Search
  try {
    const res = await fetch(`https://search.brave.com/search?q=${enc}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0' }
    });
    const txt = await res.text();
    console.log('Brave status:', res.status, 'len:', txt.length);
  } catch (e: any) {
    console.log('Brave err:', e.message);
  }
}

testSearchEngines();
