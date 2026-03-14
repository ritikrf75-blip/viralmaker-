import { GoogleGenAI, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

export interface PostContent {
  top_text: string;
  image_prompt: string;
  bottom_text: string;
}

export async function generateBulkPostContent(userStory: string, count: number): Promise<PostContent[]> {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: `You are a viral social media post creator. Read this context: '${userStory}'
    
    Extract or create EXACTLY ${count} different viral post concepts from the text.
    If the text is short, make up related interesting facts to reach ${count} concepts.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            top_text: { type: Type.STRING, description: "Catchy headline (max 10 words)" },
            image_prompt: { type: Type.STRING, description: "Highly detailed image generation prompt" },
            bottom_text: { type: Type.STRING, description: "Short shocking 2-line description" },
          },
          required: ["top_text", "image_prompt", "bottom_text"],
        },
      },
    },
  });

  return JSON.parse(response.text || "[]");
}

export async function generatePostImage(prompt: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image",
    contents: {
      parts: [
        {
          text: prompt,
        },
      ],
    },
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  
  throw new Error("Failed to generate image");
}
