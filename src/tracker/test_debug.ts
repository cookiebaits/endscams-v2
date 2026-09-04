import { extractValidatedScamPhones, deriveCountryInfo } from './test_clean';

async function testDebug() {
  const enc = encodeURIComponent('site:facebook.com "illuminati" "Whatsapp"');
  const ddgUrl = `https://html.duckduckgo.com/html/?q=${enc}`;
  
  const res = await fetch(ddgUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
  });
  const html = await res.text();
  console.log('HTML len:', html.length);
  const blocks = html.split('<div class="result results_links');
  console.log('Blocks:', blocks.length);
  for (let i = 1; i < blocks.length; i++) {
    const b = blocks[i];
    const sMatch = b.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);
    const snippet = sMatch ? sMatch[1].replace(/<[^>]+>/g, '').trim() : '';
    console.log(`Block ${i} snippet:\n`, snippet);
    const phones = extractValidatedScamPhones(snippet);
    console.log('Extracted phones:', phones);
    for (const p of phones) {
      console.log('  Country info for:', p.raw, '=>', deriveCountryInfo(p.raw));
    }
  }
}
testDebug();
