import { GoogleGenAI } from '@google/genai';

async function testCurrentModels() {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
  });

  const models = [
    'gemini-3.6-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.1-pro-preview',
    'gemini-flash-latest',
  ];

  const q = 'site:facebook.com "illuminati" "Whatsapp"';

  for (const m of models) {
    console.log(`\n--- Testing model: ${m} ---`);
    try {
      const resp = await ai.models.generateContent({
        model: m,
        contents: `You are an expert fraud investigator. Perform a search for: ${q}
Find real scam posts from the first page of search results.
Extract all contact WhatsApp and phone numbers (including US numbers like 1 (xxx) xxx-xxxx and African nation numbers like Nigeria +234, Kenya +254, Ghana +233, South Africa +27, Zambia +260, etc.).
Return valid JSON with: [{ "phone": string, "country": string, "scamType": string, "summary": string, "sourceUrl": string }]`,
        config: {
          tools: [{ googleSearch: {} }],
          temperature: 0.1,
        }
      });
      console.log(`Success on ${m}! Output:\n`, resp.text?.slice(0, 500));
    } catch (e: any) {
      console.log(`Failed on ${m}:`, e.message?.slice(0, 200));
    }
  }
}

testCurrentModels();
