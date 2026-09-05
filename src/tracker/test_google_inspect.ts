import fs from 'fs';

async function inspectGoogleResponse() {
  const q = 'site:facebook.com "illuminati" "Whatsapp"';
  const enc = encodeURIComponent(q);

  const res = await fetch(`https://www.google.com/search?q=${enc}&hl=en&gl=us`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    }
  });

  console.log('Google status:', res.status);
  const html = await res.text();
  console.log('Google HTML length:', html.length);
  fs.writeFileSync('google_res.html', html);
  
  // Look for text or numbers in the HTML
  const phonePattern = /(?:\+?\d{1,4}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,5}|\+\d{10,15}/g;
  const phones = html.match(phonePattern) || [];
  console.log('Sample matches in Google HTML:', phones.slice(0, 15));
}

inspectGoogleResponse();

