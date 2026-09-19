import { GoogleGenAI } from '@google/genai';
import { readFileSync, writeFileSync } from 'fs';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.VITE_GEMINI_API_KEY });
async function test() {
  try {
    console.log("Generating audio...");
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: 'Namaste! Main sunshine ki assistant hu. Kya madad kar sakti hu?',
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: 'Aoede'
            }
          }
        }
      }
    });
    console.log("Response parts length:", response.candidates?.[0]?.content?.parts?.length);
    const audioPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (audioPart) {
        console.log(`Success! Got audio data: ${audioPart.inlineData.mimeType}, base64 length: ${audioPart.inlineData.data.length}`);
    } else {
        console.log("No audio part found.", response.text);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}
test();
