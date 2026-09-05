import { GoogleGenAI } from '@google/genai';

interface ExtractedScam {
  phone: string;
  cleanPhone: string;
  countryCode: string;
  countryName: string;
  scamType: string;
  impersonatedCompany: string;
  detailedSummary: string;
  sourceUrl: string;
  sourceDomain: string;
  platform: string;
  snippet: string;
  searchQuery: string;
}

// Complete Country Mapping for US and all African Nations
function parseCountry(phone: string): { code: string; name: string; allowed: boolean; formatted: string } {
  if (!phone) return { code: 'UNKNOWN', name: 'Unknown', allowed: false, formatted: phone };
  
  // Clean all non-digit and non-plus characters
  const raw = phone.trim();
  const digits = raw.replace(/\D/g, '');
  
  // 1. US Check
  const isUS = (raw.startsWith('+1') && digits.length === 11) || 
               (digits.length === 11 && digits.startsWith('1')) || 
               (digits.length === 10 && /^[2-9]/.test(digits));
               
  if (isUS) {
    const d = digits.length === 11 ? digits.slice(1) : digits;
    const tollFree = ['800', '888', '877', '866', '855', '844', '833'];
    if (tollFree.some(p => d.startsWith(p))) {
      return { code: 'US', name: 'United States (Toll-Free)', allowed: false, formatted: `1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` };
    }
    return {
      code: 'US',
      name: 'United States',
      allowed: true,
      formatted: `1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
    };
  }

  // 2. African Country Code Mapping (+2xx)
  const africanCodes: Record<string, string> = {
    '234': 'Nigeria',
    '254': 'Kenya',
    '233': 'Ghana',
    '27': 'South Africa',
    '260': 'Zambia',
    '256': 'Uganda',
    '255': 'Tanzania',
    '237': 'Cameroon',
    '225': 'Ivory Coast',
    '221': 'Senegal',
    '263': 'Zimbabwe',
    '250': 'Rwanda',
    '229': 'Benin',
    '228': 'Togo',
    '241': 'Gabon',
    '242': 'Republic of the Congo',
    '243': 'DR Congo',
    '244': 'Angola',
    '251': 'Ethiopia',
    '220': 'Gambia',
    '232': 'Sierra Leone',
    '231': 'Liberia',
    '212': 'Morocco',
    '213': 'Algeria',
    '216': 'Tunisia',
    '218': 'Libya',
    '20': 'Egypt',
    '249': 'Sudan',
    '258': 'Mozambique',
    '261': 'Madagascar',
    '264': 'Namibia',
    '267': 'Botswana',
    '268': 'Eswatini',
    '265': 'Malawi',
    '266': 'Lesotho',
    '257': 'Burundi',
    '253': 'Djibouti',
    '252': 'Somalia',
    '226': 'Burkina Faso',
    '227': 'Niger',
    '223': 'Mali',
    '222': 'Mauritania',
    '224': 'Guinea',
    '238': 'Cape Verde',
    '239': 'Sao Tome and Principe',
    '230': 'Mauritius',
    '248': 'Seychelles',
    '235': 'Chad',
    '236': 'Central African Republic',
    '211': 'South Sudan',
  };

  // Check prefix matches for African countries
  for (const [code, name] of Object.entries(africanCodes)) {
    if (digits.startsWith(code) && digits.length >= code.length + 6 && digits.length <= code.length + 11) {
      const sub = digits.slice(code.length);
      return {
        code: `AF-${code}`,
        name: name,
        allowed: true,
        formatted: `+${code} ${sub.slice(0, 3)} ${sub.slice(3, 6)} ${sub.slice(6)}`.trim()
      };
    }
  }

  // General +2XX African catch-all
  if (digits.startsWith('2') && digits.length >= 9 && digits.length <= 15) {
    return {
      code: 'AFRICA',
      name: 'African Nation',
      allowed: true,
      formatted: `+${digits}`
    };
  }

  return { code: 'OTHER', name: 'International', allowed: false, formatted: `+${digits}` };
}

// Regex patterns to capture international phone numbers with country codes or standard formats
function extractPhonesFromText(text: string): string[] {
  if (!text) return [];
  const phones: string[] = [];

  // Match: +234..., +254..., +260..., +27..., +1..., (xxx) xxx-xxxx, xxx-xxx-xxxx
  const patterns = [
    /\+(?:2[0-9]{1,3}|1)[-\s]?[0-9]{2,4}[-\s]?[0-9]{3,4}[-\s]?[0-9]{3,5}/g,
    /\b(?:234|254|233|260|256|27)[0-9]{8,10}\b/g,
    /(?:\+?1[\s.-]?)?\(?[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g,
    /\b0[789][01]\d{8}\b/g, // Nigerian local format e.g. 08153044330 -> +2348153044330
    /\b07\d{8}\b/g, // Kenyan / UK local format
  ];

  for (const p of patterns) {
    const matches = text.match(p);
    if (matches) {
      for (let m of matches) {
        m = m.trim();
        // Convert Nigerian 080/081/090/070 numbers into +234
        if (/^0[789][01]\d{8}$/.test(m)) {
          m = '+234' + m.slice(1);
        }
        // Convert Kenyan 07xx numbers into +254
        else if (/^07\d{8}$/.test(m)) {
          m = '+254' + m.slice(1);
        }
        // Filter out obviously non-phone long number IDs (like facebook group IDs 5223513591088722)
        const digits = m.replace(/\D/g, '');
        if (digits.length >= 9 && digits.length <= 15) {
          if (!digits.startsWith('1787') && !digits.startsWith('1120') && !digits.startsWith('52235135')) {
            phones.push(m);
          }
        }
      }
    }
  }

  return Array.from(new Set(phones));
}

async function testFullPipeline() {
  const userSearches = [
    {
      id: 'fb-illuminati',
      name: 'Facebook: Illuminati WhatsApp Scams',
      platform: 'Facebook',
      category: 'Illuminati Extortion Scams',
      searchQuery: 'site:facebook.com "illuminati" "Whatsapp"',
      googleUrl: 'https://www.google.com/search?q=site:+facebook.com+%22illuminati%22+%22Whatsapp%22&rlz=1C1CHBF_enUS960US960&aic=0&sxsrf=ANbL-n7hHmAkKF30yJ5erfT785v0eAj03A:1771826533953&tbs=qdr:w&dpr=1.1',
    },
    {
      id: 'ig-spellcaster',
      name: 'Instagram: Spellcaster WhatsApp Scams',
      platform: 'Instagram',
      category: 'Spellcaster WhatsApp Extortion',
      searchQuery: 'site:instagram.com "spellcaster" "Whatsapp"',
      googleUrl: 'https://www.google.com/search?q=site%3A+instagram.com+%22spellcaster%22+%22Whatsapp%22&rlz=1C1CHBF_enUS960US960&aic=0&tbs=qdr%3Aw&sxsrf=ANbL-n7qt0vAT9gEebdhepqEuYCj9TKwbg%3A1770845533200&uact=5',
    },
    {
      id: 'gb-spell',
      name: 'Guestbooks: Spell WhatsApp Scams',
      platform: 'Guestbooks',
      category: 'Spellcaster WhatsApp Extortion',
      searchQuery: 'inurl:"guestbook" spell whatsapp',
      googleUrl: 'https://www.google.com/search?q=inurl:%22guestbook%22+spell+whatsapp&rlz=1C1CHBF_enUS960US960&sxsrf=ANbL-n7kwVJMJRUFBp_G3UMwvxQR4tljQA:1770021108124&tbs=qdr:m&dpr=1.1&aic=0',
    },
    {
      id: 'fb-btc',
      name: 'Facebook: BTC Recovery Scams',
      platform: 'Facebook',
      category: 'Crypto BTC Recovery Scam',
      searchQuery: 'site:facebook.com "btc recovery" "Whatsapp"',
      googleUrl: 'https://www.google.com/search?q=site%3A+facebook.com+%22btc+recovery%22+%22Whatsapp%22&rlz=1C1CHBF_enUS960US960&aic=0&tbs=qdr%3Aw&sxsrf=ANbL-n6tOESHdK_Rss_u9pJDYP2HYGzAlg%3A1770104073258&uact=5',
    },
    {
      id: 'ig-btc',
      name: 'Instagram: BTC Recovery Scams',
      platform: 'Instagram',
      category: 'Crypto BTC Recovery Scam',
      searchQuery: 'site:instagram.com "btc recovery" "Whatsapp"',
      googleUrl: 'https://www.google.com/search?q=site%3A+instagram.com+%22btc+recovery%22+%22Whatsapp%22&rlz=1C1CHBF_enUS960US960&aic=0&tbs=qdr%3Aw&sxsrf=ANbL-n4Z-WzW-9QODIDzu6fTjsmYDBfF8Q%3A1770845372980&uact=5',
    },
    {
      id: 'amz-publisher',
      name: 'Amazon Book Publisher Scams',
      platform: 'Amazon Impersonators',
      category: 'Publishing Chat Scam',
      searchQuery: '"book publisher" "amazon" "chat"',
      googleUrl: 'https://www.google.com/search?q=%22book+publisher%22+%22amazon%22+%22chat%22&sca_esv=bcc915fd4b92abab&sxsrf=ANbL-n4ow1yo6ZluyaNH9bPFwUG4gXqcUw:1781023562626&ei=SkMoatP7JZXPkPIPid3vwAw&start=10&sa=N&sstk=AU9db-CZJgrwx80qNp5NNuWt2LOzBpyU_13C2myfbYfdgJt9O5Oct_0QSFsPs-y6lZE07p8GJ-OmT7os3sjZOLdF3xJ_7V8x2BCwXg&ved=2ahUKEwjTyKXmzfqUAxWVJ0QIHYnuG8gQ8tMDegQIPRAE&biw=1265&bih=1239&dpr=1',
    },
  ];

  console.log('Testing extraction across all 6 searches...');
  const allFound: any[] = [];

  for (const s of userSearches) {
    console.log(`\n=== Processing search: ${s.name} ===`);
    
    // We fetch HTML search results
    const enc = encodeURIComponent(s.searchQuery);
    const endpoints = [
      `https://html.duckduckgo.com/html/?q=${enc}`,
      `https://search.yahoo.com/search?p=${enc}`,
    ];

    let combinedText = '';
    const pageResults: { title: string; url: string; snippet: string }[] = [];

    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          }
        });
        if (res.ok) {
          const html = await res.text();
          
          if (url.includes('duckduckgo')) {
            const blocks = html.split('<div class="result results_links');
            for (let i = 1; i < blocks.length; i++) {
              const b = blocks[i];
              const tMatch = b.match(/<a class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i) ||
                             b.match(/<a class="result__url"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
              const sMatch = b.match(/<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i);
              let itemUrl = s.googleUrl;
              if (tMatch && tMatch[1]) {
                const raw = tMatch[1];
                if (raw.includes('uddg=')) {
                  try {
                    const m = raw.match(/uddg=([^&]+)/);
                    if (m) itemUrl = decodeURIComponent(m[1]);
                  } catch {}
                } else if (raw.startsWith('http')) {
                  itemUrl = raw;
                }
              }
              const title = tMatch ? tMatch[2].replace(/<[^>]+>/g, '').trim() : '';
              const snippet = sMatch ? sMatch[1].replace(/<[^>]+>/g, '').trim() : '';
              if (title || snippet) {
                pageResults.push({ title, url: itemUrl, snippet });
              }
            }
          } else if (url.includes('yahoo')) {
            const clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                              .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                              .replace(/<[^>]+>/g, ' ')
                              .replace(/\s+/g, ' ');
            combinedText += ' ' + clean;
          }
        }
      } catch (err: any) {
        console.log(`Endpoint error (${url}):`, err.message);
      }
    }

    // Extract records from parsed results
    for (const res of pageResults) {
      const text = `${res.title} ${res.snippet}`;
      const phones = extractPhonesFromText(text);
      for (const rawPhone of phones) {
        const country = parseCountry(rawPhone);
        if (country.allowed) {
          allFound.push({
            phone: country.formatted,
            cleanPhone: rawPhone.replace(/\D/g, ''),
            countryCode: country.code,
            countryName: country.name,
            scamType: s.category,
            platform: s.platform,
            sourceUrl: res.url || s.googleUrl,
            sourceDomain: s.platform.toLowerCase().replace(/\s+/g, '') + '.com',
            snippet: res.snippet || res.title,
            searchQuery: s.searchQuery,
          });
        }
      }
    }

    // Also extract from combined text
    const extraPhones = extractPhonesFromText(combinedText);
    for (const rawPhone of extraPhones) {
      const country = parseCountry(rawPhone);
      if (country.allowed) {
        allFound.push({
          phone: country.formatted,
          cleanPhone: rawPhone.replace(/\D/g, ''),
          countryCode: country.code,
          countryName: country.name,
          scamType: s.category,
          platform: s.platform,
          sourceUrl: s.googleUrl,
          sourceDomain: 'google.com',
          snippet: `Discovered in top Google search results for ${s.searchQuery}`,
          searchQuery: s.searchQuery,
        });
      }
    }
  }

  console.log(`\n================ Total Scam Numbers Discovered: ${allFound.length} ================`);
  const unique = new Map();
  for (const item of allFound) {
    if (!unique.has(item.phone)) {
      unique.set(item.phone, item);
    }
  }

  console.log(`Unique validated records: ${unique.size}`);
  Array.from(unique.values()).forEach((item, idx) => {
    console.log(`${idx + 1}. [${item.countryName}] (${item.platform}) ${item.phone} -> ${item.scamType} | ${item.snippet.slice(0, 70)}...`);
  });
}

testFullPipeline();
