async function testScrape() {
  const queries = [
    {
      name: 'Facebook: Illuminati WhatsApp Scams',
      platform: 'Facebook',
      category: 'Illuminati Extortion Scams',
      q: 'site:facebook.com "illuminati" "Whatsapp"',
      googleUrl: 'https://www.google.com/search?q=site:+facebook.com+%22illuminati%22+%22Whatsapp%22&tbs=qdr:w'
    },
    {
      name: 'Instagram: Spellcaster WhatsApp Scams',
      platform: 'Instagram',
      category: 'Spellcaster WhatsApp Extortion',
      q: 'site:instagram.com "spellcaster" "Whatsapp"',
      googleUrl: 'https://www.google.com/search?q=site%3A+instagram.com+%22spellcaster%22+%22Whatsapp%22&tbs=qdr%3Aw'
    },
    {
      name: 'Guestbook: Spellcaster WhatsApp Scams',
      platform: 'Guestbooks',
      category: 'Spellcaster WhatsApp Extortion',
      q: 'inurl:"guestbook" spell whatsapp',
      googleUrl: 'https://www.google.com/search?q=inurl:%22guestbook%22+spell+whatsapp&tbs=qdr:m'
    },
    {
      name: 'Facebook: BTC Recovery Scams',
      platform: 'Facebook',
      category: 'Crypto BTC Recovery Scam',
      q: 'site:facebook.com "btc recovery" "Whatsapp"',
      googleUrl: 'https://www.google.com/search?q=site%3A+facebook.com+%22btc+recovery%22+%22Whatsapp%22&tbs=qdr%3Aw'
    },
    {
      name: 'Instagram: BTC Recovery Scams',
      platform: 'Instagram',
      category: 'Crypto BTC Recovery Scam',
      q: 'site:instagram.com "btc recovery" "Whatsapp"',
      googleUrl: 'https://www.google.com/search?q=site%3A+instagram.com+%22btc+recovery%22+%22Whatsapp%22&tbs=qdr%3Aw'
    },
    {
      name: 'Amazon Book Publisher Scams',
      platform: 'Amazon Impersonators',
      category: 'Publishing Chat Scam',
      q: '"book publisher" "amazon" "chat"',
      googleUrl: 'https://www.google.com/search?q=%22book+publisher%22+%22amazon%22+%22chat%22'
    }
  ];

  // International & US phone regex matching:
  // US: 1 (xxx) xxx-xxxx, (xxx) xxx-xxxx, xxx-xxx-xxxx
  // African & Intl: +234..., +254..., +233..., +27..., +260..., +256..., +20..., +220..., etc.
  const phonePattern = /(?:\+?\d{1,4}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,5}|\+\d{10,15}|\b\d{10,12}\b/g;

  for (const item of queries) {
    console.log(`\n================== Checking: ${item.name} ==================`);
    const enc = encodeURIComponent(item.q);
    
    // Try multiple search endpoints for maximum resilience
    let html = '';
    try {
      const res = await fetch(`https://html.duckduckgo.com/html/?q=${enc}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      });
      if (res.ok) html = await res.text();
    } catch (e) {
      console.log('Error fetching search:', e);
    }

    console.log(`HTML length: ${html.length}`);
    const results = html.split('<div class="result results_links');
    console.log(`Results found: ${results.length - 1}`);

    for (let i = 1; i < results.length; i++) {
      const block = results[i];
      const titleMatch = block.match(/<a class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i) ||
                         block.match(/<a class="result__url"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      const snippetMatch = block.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);

      let actualUrl = item.googleUrl;
      if (titleMatch && titleMatch[1]) {
        let raw = titleMatch[1];
        if (raw.includes('uddg=')) {
          try {
            const m = raw.match(/uddg=([^&]+)/);
            if (m) actualUrl = decodeURIComponent(m[1]);
          } catch {}
        } else if (raw.startsWith('http')) {
          actualUrl = raw;
        }
      }

      const title = titleMatch ? titleMatch[2].replace(/<[^>]+>/g, '').trim() : '';
      const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      const fullText = `${title} ${snippet}`;

      console.log(`\nResult #${i}:`);
      console.log(` Title: ${title}`);
      console.log(` URL: ${actualUrl}`);
      console.log(` Snippet: ${snippet}`);

      const matchedPhones = fullText.match(phonePattern) || [];
      console.log(` Found potential phones:`, matchedPhones);
    }
  }
}

testScrape();
