// Refined phone number extractor that specifically targets WhatsApp / phone scam numbers

export function extractValidatedScamPhones(text: string): { raw: string; context: string }[] {
  if (!text) return [];
  const results: { raw: string; context: string }[] = [];

  // Match WhatsApp / phone numbers explicitly:
  // Examples:
  // "WhatsApp +2347010201077"
  // "WhatsApp number +260770733495 +260962032728 +254112883184"
  // "whatsapp +27732837983"
  // "WhatsApp :: +1 (631)604-8085"
  // "Illuminati WhatsApp +17575562510"
  // "My whatsapp number is +2348153044330"
  // "Whatsapp: +1 (443) 351-8162"
  // "WhatsApp: +1 (828) 352-8592"
  // "+1 504 203 9030"
  // "+234 813 816 1886"

  // 1. Explicit WhatsApp / Contact labeled regex
  const keywordRegex = /(?:whatsapp|call|text|phone|contact|join|tel|sms|dm)[\s:：=+.-]{1,15}((?:\+?\d{1,4}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,5}|\+\d{9,15}|\b0[789][01]\d{8}\b)/gi;
  
  let match;
  while ((match = keywordRegex.exec(text)) !== null) {
    const rawCandidate = match[1]?.trim();
    if (rawCandidate) {
      const idx = match.index;
      const snippet = text.slice(Math.max(0, idx - 40), Math.min(text.length, idx + 140)).trim();
      results.push({ raw: rawCandidate, context: snippet });
    }
  }

  // 2. Explicit International Plus Numbers (e.g. +234..., +254..., +260..., +27..., +233..., +1...)
  const plusRegex = /\+(?:2[0-9]{1,3}|1)[\s.-]?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,5}/g;
  while ((match = plusRegex.exec(text)) !== null) {
    const rawCandidate = match[0]?.trim();
    if (rawCandidate) {
      const idx = match.index;
      const snippet = text.slice(Math.max(0, idx - 40), Math.min(text.length, idx + 140)).trim();
      results.push({ raw: rawCandidate, context: snippet });
    }
  }

  // 3. Formatted US numbers (e.g. 1 (xxx) xxx-xxxx, (xxx) xxx-xxxx, xxx-xxx-xxxx)
  const usFormattedRegex = /(?:\b1[\s.-]?)?\(?[2-9]\d{2}\)?[\s.-][2-9]\d{2}[\s.-]\d{4}\b/g;
  while ((match = usFormattedRegex.exec(text)) !== null) {
    const rawCandidate = match[0]?.trim();
    if (rawCandidate) {
      const idx = match.index;
      const snippet = text.slice(Math.max(0, idx - 40), Math.min(text.length, idx + 140)).trim();
      results.push({ raw: rawCandidate, context: snippet });
    }
  }

  return results;
}

// Complete Country Mapping for US and all African Nations
export function deriveCountryInfo(phone: string): { code: string; name: string; allowed: boolean; formatted: string; cleanDigits: string } {
  if (!phone) return { code: 'UNKNOWN', name: 'Unknown', allowed: false, formatted: phone, cleanDigits: '' };
  
  const raw = phone.trim();
  const digits = raw.replace(/\D/g, '');
  
  // 1. African Country Code Mapping (+2xx)
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

  // Convert Nigerian local format (080..., 081..., 090..., 070...)
  let normalizedDigits = digits;
  if (/^0[789][01]\d{8}$/.test(digits)) {
    normalizedDigits = '234' + digits.slice(1);
  }
  // Convert Kenyan local format (07xx..., 01xx...)
  else if (/^0[71]\d{8}$/.test(digits)) {
    normalizedDigits = '254' + digits.slice(1);
  }

  // Check prefix matches for African countries first
  for (const [code, name] of Object.entries(africanCodes)) {
    if (normalizedDigits.startsWith(code) && normalizedDigits.length >= code.length + 6 && normalizedDigits.length <= code.length + 11) {
      const sub = normalizedDigits.slice(code.length);
      let formatted = `+${code}`;
      if (sub.length === 10) {
        formatted += ` ${sub.slice(0, 3)} ${sub.slice(3, 6)} ${sub.slice(6)}`;
      } else if (sub.length === 9) {
        formatted += ` ${sub.slice(0, 3)} ${sub.slice(3, 6)} ${sub.slice(6)}`;
      } else {
        formatted += ` ${sub}`;
      }
      return {
        code: `AF-${code}`,
        name: name,
        allowed: true,
        formatted: formatted.trim(),
        cleanDigits: normalizedDigits,
      };
    }
  }

  // Broad African +2xx fallback
  if (normalizedDigits.startsWith('2') && normalizedDigits.length >= 10 && normalizedDigits.length <= 15) {
    return {
      code: 'AFRICA',
      name: 'African Nation',
      allowed: true,
      formatted: `+${normalizedDigits}`,
      cleanDigits: normalizedDigits,
    };
  }

  // 2. US Logic
  const isUS = (raw.startsWith('+1') && normalizedDigits.length === 11) || 
               (normalizedDigits.length === 11 && normalizedDigits.startsWith('1')) || 
               (normalizedDigits.length === 10 && /^[2-9]/.test(normalizedDigits));

  if (isUS) {
    const d = normalizedDigits.length === 11 ? normalizedDigits.slice(1) : normalizedDigits;
    const tollFree = ['800', '888', '877', '866', '855', '844', '833'];
    if (tollFree.some(p => d.startsWith(p))) {
      return {
        code: 'US',
        name: 'United States (Toll-Free)',
        allowed: false,
        formatted: `1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`,
        cleanDigits: d,
      };
    }
    return {
      code: 'US',
      name: 'United States',
      allowed: true,
      formatted: `1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`,
      cleanDigits: d,
    };
  }

  return {
    code: 'OTHER',
    name: 'International',
    allowed: false,
    formatted: `+${normalizedDigits}`,
    cleanDigits: normalizedDigits,
  };
}

async function testCleanPipeline() {
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

  const results: any[] = [];
  const seen = new Set();

  for (const s of userSearches) {
    const enc = encodeURIComponent(s.searchQuery);
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${enc}`;
    
    try {
      const res = await fetch(ddgUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
      });
      if (res.ok) {
        const html = await res.text();
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
          const fullText = `${title} ${snippet}`;

          const extracted = extractValidatedScamPhones(fullText);
          for (const item of extracted) {
            const info = deriveCountryInfo(item.raw);
            if (info.allowed && !seen.has(info.formatted)) {
              seen.add(info.formatted);
              results.push({
                phone: info.formatted,
                cleanPhone: info.cleanDigits,
                countryCode: info.code,
                countryName: info.name,
                scamType: s.category,
                platform: s.platform,
                sourceUrl: itemUrl,
                snippet: item.context || snippet || title,
                searchQuery: s.searchQuery,
              });
            }
          }
        }
      }
    } catch (e: any) {
      console.log('Error:', e.message);
    }
  }

  console.log(`\n================ Total Clean Scams Extracted: ${results.length} ================`);
  results.forEach((r, idx) => {
    console.log(`${idx + 1}. [${r.countryName}] (${r.platform}) ${r.phone} -> ${r.scamType}\n   Link: ${r.sourceUrl}\n   Snippet: ${r.snippet}\n`);
  });
}

testCleanPipeline();
