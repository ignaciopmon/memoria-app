// app/api/turbo-study/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60; 

const apiKey = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

const MODELS = [
  "gemini-2.5-flash",
  "gemini-1.5-pro",
  "gemini-1.5-flash"
];

function cleanAndParseJSON(text: string) {
    let cleanText = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');
    const firstOpen = cleanText.indexOf('[');
    const lastClose = cleanText.lastIndexOf(']');
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        cleanText = cleanText.substring(firstOpen, lastClose + 1);
    }
    return JSON.parse(cleanText);
}

function extractYoutubeId(url: string) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// Extractor personalizado (anti-bloqueos)
async function getYouTubeTranscript(videoId: string) {
    const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        }
    });
    const html = await response.text();
    const captionsMatch = html.match(/"captions":\s*({.*?})/);
    
    if (!captionsMatch) throw new Error("El vídeo no tiene subtítulos o YouTube bloqueó la petición.");
    
    const captionsData = JSON.parse(captionsMatch[1]);
    const tracks = captionsData?.playerCaptionsTracklistRenderer?.captionTracks;
    
    if (!tracks || tracks.length === 0) throw new Error("No se encontraron pistas de subtítulos en el vídeo.");
    
    // Obtenemos el XML de la primera pista disponible
    const xmlRes = await fetch(tracks[0].baseUrl);
    const xml = await xmlRes.text();
    
    // Parseamos el XML a texto limpio
    const textRegex = /<text[^>]*>(.*?)<\/text>/g;
    let transcript = '';
    let m;
    while ((m = textRegex.exec(xml)) !== null) {
        transcript += m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"') + ' ';
    }
    
    return transcript;
}

export async function POST(request: Request) {
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { action, messages, pdfBase64, youtubeUrl, youtubeTranscript, questionCount, language } = body;
    
    // ==========================================
    // EXTRACCIÓN ÚNICA DE SUBTÍTULOS
    // ==========================================
    if (action === "fetch_youtube") {
        const videoId = extractYoutubeId(youtubeUrl);
        if (!videoId) return NextResponse.json({ error: "URL de YouTube inválida" }, { status: 400 });
        
        try {
            const transcript = await getYouTubeTranscript(videoId);
            return NextResponse.json({ data: transcript });
        } catch (error: any) {
            console.error("Transcript fetch error:", error);
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
    }

    let systemInstruction = "You are an expert and friendly AI tutor. Your goal is to help the user study the provided material. Focus on explaining the main themes and core concepts. You may use your general knowledge to complement the explanations, but do not hallucinate information unrelated to the subjects of the document.";
    let promptText = messages?.[messages.length - 1]?.content || "";
    
    if (action === "generate_test") {
         systemInstruction = `You are an expert university professor creating a multiple-choice test. 
         Generate exactly ${questionCount} questions in ${language} about the MAIN TOPICS discussed in the provided material.
         
         CRITICAL RULES:
         1. DO NOT ask about specific anecdotes, trivial examples, or overly specific numbers/names mentioned in the text.
         2. Focus exclusively on the CORE CONCEPTS, theories, and the general framework of the document.
         3. You MUST use your extensive external knowledge to enrich the questions and provide deeper context, as long as it directly relates to the main subjects covered in the provided material.
         
         Return ONLY a raw JSON array. Exact format: [{"question": "...", "options": {"A": "...", "B": "...", "C": "...", "D": "..."}, "answer": "A", "explanation": "Brief explanation of why this is correct based on the concept"}]`;
         promptText = "Analyze the core themes of the provided material and generate the conceptual test now.";
    }

    const parts: any[] = [];
    
    if (pdfBase64) {
        parts.push({
            inlineData: { data: pdfBase64, mimeType: "application/pdf" }
        });
    }
    
    if (youtubeTranscript) {
        parts.push({ text: `Study Material (YouTube Video Transcript):\n\n${youtubeTranscript}\n\n---\nPlease use the main topics from the transcript above as the primary basis for your response.` });
    }
    
    if (action === 'chat' && messages && messages.length > 1) {
        const historyText = messages.slice(0, -1).map((msg: any) => 
            `${msg.role === 'user' ? 'Student' : 'AI Tutor'}: ${msg.content}`
        ).join('\n\n');
        parts.push({ text: `Conversation history:\n${historyText}\n\nNew student question:` });
    }

    parts.push({ text: promptText });

    let success = false;
    let resultData;
    let lastError: any;

    for (const modelName of MODELS) {
        try {
            console.log(`[TurboStudy] Attempting '${action}' with model: ${modelName}`);
            
            const isGemini = modelName.includes("gemini");
            const generationConfig = (action === "generate_test" && isGemini)
                ? { responseMimeType: "application/json" } 
                : undefined;

            const model = genAI.getGenerativeModel({
                model: modelName,
                generationConfig,
                systemInstruction: isGemini ? systemInstruction : undefined,
            });
            
            let finalParts = [...parts];
            if (!isGemini) {
                finalParts = [{ text: `System instructions: ${systemInstruction}\n\n` }, ...parts];
            }

            const result = await model.generateContent({
                contents: [{ role: "user", parts: finalParts }]
            });
            
            const textResponse = result.response.text();

            if (action === "generate_test") {
                resultData = cleanAndParseJSON(textResponse);
                if (!Array.isArray(resultData)) throw new Error("Invalid JSON structure");
            } else {
                resultData = textResponse;
            }

            success = true;
            break;
        } catch (aiError: any) {
            console.warn(`Failed with ${modelName}:`, aiError.message);
            lastError = aiError;
        }
    }

    if (!success) {
        return NextResponse.json({ error: `Failed after trying all AI models. Last error: ${lastError?.message}` }, { status: 500 });
    }

    return NextResponse.json({ data: resultData });

  } catch (error: any) {
    console.error("Error in turbo-study:", error);
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}