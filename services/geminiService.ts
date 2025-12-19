
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getIntegrationHelp = async (regionsCount: number, width: number, height: number) => {
  const prompt = `
    I am building a game tool. I have just generated a sprite atlas from a PSD file.
    Statistics:
    - Total layers packed: ${regionsCount}
    - Atlas resolution: ${width}x${height}
    - Export format: Binary (.bin) and Atlas (.png)
    
    Please provide a concise technical explanation (markdown format) on:
    1. How to use a binary file with custom format (Header: PSDB, Layer entry: NameLen, Name, X, Y, W, H, U1, V1, U2, V2) in a common game engine like Unity or Cocos.
    2. Explain the difference between Top-Left and Bottom-Left coordinate systems for game developers.
    Keep it professional and helpful for a senior developer.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Failed to load AI assistance. Please check your connection.";
  }
};
