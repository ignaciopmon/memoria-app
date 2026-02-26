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

// Extractor "Hacker" definitivo (Múltiples métodos de evasión)
async function getYouTubeTranscript(videoId: string) {
    let transcript = "";

    // MÉTODO 1: Spoofing de Aplicación Android (Engaña a YouTube fingiendo ser un móvil real, no un bot web)
    try {
        console.log(`[TurboStudy] Método 1: Spoofing App Android`);
        const res = await fetch(`https://www.youtube.com/youtubei/v1/player`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Simulamos ser un dispositivo Android legítimo
                'User-Agent': 'com.google.android.youtube/19.30.36 (Linux; U; Android 11) gzip'
            },
            body: JSON.stringify({
                context: {
                    client: {
                        clientName: "ANDROID",
                        clientVersion: "19.30.36",
                        androidSdkVersion: 30,
                        hl: "es",
                        gl: "ES",
                    }
                },
                videoId: videoId
            })
        });

        const data = await res.json();
        const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        
        if (tracks && tracks.length > 0) {
            // Pillamos español si existe, si no la autogenerada en inglés o la que sea
            const track = tracks.find((t: any) => t.languageCode === 'es') || tracks[0];
            const xmlRes = await fetch(track.baseUrl);
            const xml = await xmlRes.text();
            
            const textRegex = /<text[^>]*>(.*?)<\/text>/g;
            transcript = '';
            let m;
            while ((m = textRegex.exec(xml)) !== null) {
                let clean = m[1]
                    .replace(/<[^>]+>/g, '')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&#39;/g, "'")
                    .replace(/&quot;/g, '"');
                transcript += clean + ' ';
            }
            if (transcript.trim().length > 20) {
                console.log("[TurboStudy] Método Android Exitoso.");
                return transcript.trim();
            }
        }
    } catch (e) { console.log("[TurboStudy] Método 1 falló"); }

    // MÉTODO 2: API de youtubetranscript.com (Servicio de terceros especializado en saltar bloqueos)
    try {
        console.log(`[TurboStudy] Método 2: API de Terceros`);
        const res = await fetch(`https://youtubetranscript.com/?server_vid2=${videoId}`);
        const xml = await res.text();
        
        if (xml && xml.includes('<transcript>')) {
            const textRegex = /<text[^>]*>(.*?)<\/text>/g;
            let m;
            transcript = '';
            while ((m = textRegex.exec(xml)) !== null) {
                let clean = m[1]
                    .replace(/<[^>]+>/g, '')
                    .replace(/&amp;/g, '&')
                    .replace(/&lt;/g, '<')
                    .replace(/&gt;/g, '>')
                    .replace(/&#39;/g, "'")
                    .replace(/&quot;/g, '"');
                transcript += clean + ' ';
            }
            if (transcript.trim().length > 20) {
                console.log("[TurboStudy] Método de Terceros Exitoso.");
                return transcript.trim();
            }
        }
    } catch (e) { console.log("[TurboStudy] Método 2 falló"); }

    throw new Error("Extracción bloqueada. YouTube ha endurecido el firewall para este vídeo o realmente no tiene subtítulos. Prueba otro vídeo.");
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