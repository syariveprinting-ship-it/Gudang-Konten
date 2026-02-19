
import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceName, Language } from "../types";

const decode = (base64: string): Uint8Array => {
  try {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    throw new Error("Gagal mendekode data audio (Base64 Error).");
  }
};

const decodeAudioData = async (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};

const audioBufferToMp3 = (buffer: AudioBuffer): Blob => {
  const lamejs = (window as any).lamejs;
  if (!lamejs) {
    throw new Error("Library LameJS belum termuat. Mohon tunggu sebentar.");
  }

  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, 128);
  const mp3Data: any[] = [];
  const sampleBlockSize = 1152;

  for (let i = 0; i < buffer.length; i += sampleBlockSize) {
    const left = buffer.getChannelData(0).subarray(i, i + sampleBlockSize);
    const leftInt16 = new Int16Array(left.length);
    for (let j = 0; j < left.length; j++) {
      let s = Math.max(-1, Math.min(1, left[j]));
      leftInt16[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    let mp3buf;
    if (channels === 2) {
      const right = buffer.getChannelData(1).subarray(i, i + sampleBlockSize);
      const rightInt16 = new Int16Array(right.length);
      for (let j = 0; j < right.length; j++) {
        let s = Math.max(-1, Math.min(1, right[j]));
        rightInt16[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      mp3buf = mp3encoder.encodeBuffer(leftInt16, rightInt16);
    } else {
      mp3buf = mp3encoder.encodeBuffer(leftInt16);
    }
    if (mp3buf.length > 0) mp3Data.push(mp3buf);
  }
  const finalBuf = mp3encoder.flush();
  if (finalBuf.length > 0) mp3Data.push(finalBuf);
  return new Blob(mp3Data, { type: "audio/mp3" });
};

const getLanguageName = (lang: string) => {
  const langs: Record<string, string> = {
    'id': 'Indonesian', 'en': 'English', 'ar': 'Arabic', 'jp': 'Japanese',
    'es': 'Spanish', 'fr': 'French', 'de': 'German', 'zh': 'Chinese',
    'ko': 'Korean', 'hi': 'Hindi', 'pt': 'Portuguese', 'ru': 'Russian',
    'it': 'Italian', 'tr': 'Turkish', 'vi': 'Vietnamese', 'th': 'Thai',
    'nl': 'Dutch', 'pl': 'Polish'
  };
  return langs[lang] || 'English';
};

export const generateVoice = async (
  text: string, 
  voiceName: VoiceName,
  lang: Language,
  emotion: string = "normally",
  speechStyle: string = "default"
): Promise<{ buffer: AudioBuffer; context: AudioContext; blob: Blob }> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key tidak ditemukan.");

  const ai = new GoogleGenAI({ apiKey });
  const languageName = getLanguageName(lang);
  
  let emotionContext = emotion;
  if (emotion === 'normally') emotionContext = "normally";
  else if (emotion === 'horrified') emotionContext = "with a horrified, trembling tone";
  else if (emotion === 'mysterious') emotionContext = "with a mysterious, whispering tone";
  else if (emotion === 'angry') emotionContext = "with an angry, explosive tone";
  else if (emotion === 'boldly') emotionContext = "with a bold, heroic tone";
  else if (emotion === 'funny') emotionContext = "with a funny, witty tone";
  else emotionContext = `with a ${emotion} expression`;

  const prompt = `Say this ${emotionContext} in ${languageName}: ${text}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const candidate = response.candidates?.[0];
    if (!candidate) throw new Error("Server AI tidak merespon (Empty Candidate).");
    if (candidate.finishReason === 'SAFETY') throw new Error("Konten diblokir karena alasan keamanan.");

    const parts = candidate.content?.parts || [];
    const audioPart = parts.find(p => p.inlineData && p.inlineData.data);
    const base64Audio = audioPart?.inlineData?.data;

    if (!base64Audio) throw new Error("Format audio tidak ditemukan dalam respon AI.");

    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const audioBytes = decode(base64Audio);
    const audioBuffer = await decodeAudioData(audioBytes, outputAudioContext, 24000, 1);
    const mp3Blob = audioBufferToMp3(audioBuffer);

    return { buffer: audioBuffer, context: outputAudioContext, blob: mp3Blob };
  } catch (error: any) {
    console.error("TTS Studio Error:", error);
    throw new Error(error.message || "Gagal menghasilkan suara.");
  }
};

export const generateImage = async (title: string, theme: string, emotion: string, count: number = 1): Promise<string[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key tidak ditemukan.");
  const ai = new GoogleGenAI({ apiKey });
  const results: string[] = [];

  // Proses satu per satu untuk menghindari rate limit API
  for (let i = 0; i < count; i++) {
    const variation = i > 0 ? ` (Variation ${i+1}, unique angle)` : "";
    const prompt = `Professional 4k visual for: "${title}". ${variation}. Style: ${theme}. Mood: ${emotion}. No text. Cinematic lighting.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: [{ parts: [{ text: prompt }] }],
        config: { imageConfig: { aspectRatio: "16:9" } },
      });

      const part = response.candidates?.[0].content.parts.find(p => p.inlineData);
      if (part?.inlineData) {
        results.push(`data:image/png;base64,${part.inlineData.data}`);
      }
    } catch (e) {
      console.warn(`Gagal membuat gambar ke-${i+1}:`, e);
    }
  }

  if (results.length === 0) throw new Error("Gagal membuat semua visual.");
  return results;
};

export const generateBombasticTitle = async (topic: string, theme: string, lang: Language): Promise<string> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key missing.");
  const ai = new GoogleGenAI({ apiKey });
  const languageName = getLanguageName(lang);
  const prompt = `Viral YouTube title for "${topic}" (${theme}) in ${languageName}. Only output text.`;
  const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: [{ parts: [{ text: prompt }] }] });
  return response.text?.trim() || "";
};

export const generateThumbnailText = async (topic: string, bombasticTitle: string, lang: Language): Promise<string> => {
  const apiKey = process.env.API_KEY;
  const ai = new GoogleGenAI({ apiKey: apiKey! });
  const languageName = getLanguageName(lang);
  const prompt = `Short 4-6 words thumbnail text in ${languageName} for: ${bombasticTitle}. Only text.`;
  const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: [{ parts: [{ text: prompt }] }] });
  return response.text?.trim() || "";
};

export const generateDescription = async (topic: string, title: string, lang: Language): Promise<string> => {
  const apiKey = process.env.API_KEY;
  const ai = new GoogleGenAI({ apiKey: apiKey! });
  const languageName = getLanguageName(lang);
  const prompt = `SEO YouTube description in ${languageName} for "${title}". Only text.`;
  const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: [{ parts: [{ text: prompt }] }] });
  return response.text?.trim() || "";
};

export const generateTags = async (topic: string, title: string, lang: Language): Promise<string> => {
  const apiKey = process.env.API_KEY;
  const ai = new GoogleGenAI({ apiKey: apiKey! });
  const languageName = getLanguageName(lang);
  const prompt = `20 viral YouTube tags in ${languageName} for "${title}". Comma separated.`;
  const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: [{ parts: [{ text: prompt }] }] });
  return response.text?.trim() || "";
};

export const generateScript = async (title: string, theme: string, paragraphCount: number, lang: Language): Promise<string> => {
  const apiKey = process.env.API_KEY;
  const ai = new GoogleGenAI({ apiKey: apiKey! });
  const languageName = getLanguageName(lang);
  const prompt = `Write a ${paragraphCount} paragraph voice-over script in ${languageName} about "${title}" (Style: ${theme}). Only output script.`;
  const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: [{ parts: [{ text: prompt }] }] });
  return response.text || "";
};

export const generateTitleSuggestion = async (theme: string, lang: Language): Promise<string[]> => {
  const apiKey = process.env.API_KEY;
  const ai = new GoogleGenAI({ apiKey: apiKey! });
  const languageName = getLanguageName(lang);
  const prompt = `5 viral script titles for "${theme}" in ${languageName} as JSON array.`;
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    return [];
  }
};
