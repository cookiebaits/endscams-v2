import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config({ override: true });

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

async function testModels() {
  console.log('Testing gemini-3.7-flash with googleSearch tool...');
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: 'Search Google for active scammer phone numbers reported recently on techscammersunited.com or BBB scam tracker.',
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.2,
      },
    });
    console.log('gemini-3.7-flash search grounding result:');
    console.log(res.text?.slice(0, 300));
  } catch (err: any) {
    console.error('gemini-3.7-flash with googleSearch failed:', err.status, err.message);
  }

  console.log('\nTesting gemini-3.1-flash-lite with prompt search...');
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: 'Find active tech support and refund scam phone numbers from techscammersunited.com and BBB scam tracker in json format.',
      config: {
        temperature: 0.2,
      },
    });
    console.log('gemini-3.1-flash-lite result:');
    console.log(res.text?.slice(0, 300));
  } catch (err: any) {
    console.error('gemini-3.1-flash-lite failed:', err.status, err.message);
  }
}

testModels();
