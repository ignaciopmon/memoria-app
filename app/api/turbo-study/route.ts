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

// Enmascara las peticiones usando servidores Proxy públicos gratuitos
async function fetchViaProxy(url: string) {
    const proxies = [
        // Proxy 1: AllOrigins (Suele usar IPs de Cloudflare)
        `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        // Proxy 2: CodeTabs (Otro servicio de enmascaramiento CORS)
        `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(url)}`,
        // Proxy 3: Directo como último recurso milagroso
        url
    ];

    let lastErr = "";
    for (const proxy of proxies) {
        try {
            console.log(`[TurboStudy] Enmascarando petición por: ${proxy.split('?')[0]}`);
            const res = await fetch(proxy, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                cache: 'no-store'
            });
            
            if (!res.ok) continue;
            const text = await res.text();
            
            // Si el texto incluye la página de consentimiento, la IP del proxy también fue detectada. Pasamos al siguiente.
            if (text.includes('consent.youtube.com') || text.includes('Sign in to YouTube')) {
                continue;
            }
            
            if (text.length > 1000) {
                return text; // Respuesta HTML válida conseguida
            }
        } catch (e: any) {
            lastErr = e.message;
            continue;
        }
    }
    throw new Error(`Imposible evadir el bloqueo de YouTube. Proxies rechazados. Detalle: ${lastErr}`);
}

// Extractor a través de Proxy
async function getYouTubeTranscript(videoId: string) {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const html = await fetchViaProxy(videoUrl);

    let captionsData;
    
    // Método 1 para buscar los subtítulos en el HTML
    const captionsMatch = html.match(/"captions":\s*({.*?})/);
    if (captionsMatch) {
        try { captionsData = JSON.parse(captionsMatch[1]); } catch(e) {}
    }
    
    // Método 2 (Formato alternativo de YouTube)
    if (!captionsData) {
        const playerResMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?})\s*;/);
        if (playerResMatch) {
            try {
                const parsed = JSON.parse(playerResMatch[1]);
                captionsData = parsed?.captions;
            } catch(e) {}
        }
    }

    if (!captionsData || !captionsData.playerCaptionsTracklistRenderer) {
        throw new Error("No se detectó información de subtítulos en el vídeo.");
    }

    const tracks = captionsData.playerCaptionsTracklistRenderer.captionTracks;
    if (!tracks || tracks.length === 0) {
        throw new Error("Este vídeo no tiene ninguna pista de subtítulos.");
    }

    // Prioridad: Español -> Inglés -> El primero que haya
    const track = tracks.find((t: any) => t.languageCode.startsWith('es')) || 
                  tracks.find((t: any) => t.languageCode.startsWith('en')) || 
                  tracks[0];

    // Descargamos el XML de los subtítulos también a través del proxy
    const xml = await fetchViaProxy(track.baseUrl);
    
    const textRegex = /<text[^>]*>(.*?)<\/text>/g;
    let transcript = '';
    let m;
    while ((m = textRegex.exec(xml)) !== null) {
        transcript += m[1]
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#39;/g, "'")
            .replace(/&quot;/g, '"') + ' ';
    }

    if (transcript.trim().length > 50) {
        console.log("[TurboStudy] ¡Transcripción extraída exitosamente con proxy!");
        return transcript.trim();
    }

    throw new Error("Se descargaron los subtítulos, pero el archivo estaba vacío.");
}

export async function POST(request: Request) {
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { action, messages, pdfBase64, youtubeUrl, youtubeTranscript, questionCount, language } = body;
    
    // ==========================================
    // EXTRACCIÓN ÚNICA DE SUBTÍTULOS MEDIANTE PROXY
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