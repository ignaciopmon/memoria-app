// app/api/turbo-study/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Prevenir timeout

const apiKey = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

// Tu sistema de fallback de modelos
const MODELS = [
  "gemini-2.5-flash",
  "gemma-3-27b",
  "gemma-3-12b"
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

export async function POST(request: Request) {
  if (!apiKey) {
    return NextResponse.json({ error: "Falta la API Key" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { action, messages, pdfBase64, youtubeUrl, questionCount, language } = body;

    // action puede ser 'chat' o 'generate_test'
    
    let systemInstruction = "Eres un tutor experto y amigable de Inteligencia Artificial diseñado para ayudar al usuario a estudiar.";
    let promptText = messages?.[messages.length - 1]?.content || "";
    
    if (action === "generate_test") {
         systemInstruction = `Eres un experto creador de exámenes. Tu objetivo es crear un test de opción múltiple de ${questionCount} preguntas en ${language} basado ÚNICAMENTE en el material proporcionado.
         Devuelve SOLO un array JSON puro. Formato exacto: [{"question": "...", "options": {"A": "...", "B": "...", "C": "...", "D": "..."}, "answer": "A", "explanation": "Breve explicación de por qué es la correcta"}]`;
         promptText = "Genera el test ahora basado en el documento/vídeo proporcionado.";
    }

    // Construir las partes del prompt (contexto)
    const parts: any[] = [];
    
    // Si hay PDF, lo pasamos como inlineData (soportado nativamente por Gemini)
    if (pdfBase64) {
        parts.push({
            inlineData: {
                data: pdfBase64,
                mimeType: "application/pdf"
            }
        });
    }
    
    // Si hay URL de Youtube, le pedimos al modelo que extraiga el contexto
    if (youtubeUrl) {
        parts.push({ text: `Material de Estudio (Vídeo de YouTube): ${youtubeUrl}. Por favor, utiliza tu conocimiento sobre el contenido de este vídeo para responder o generar el test.` });
    }
    
    // Añadir historial del chat si es una conversación
    if (action === 'chat' && messages && messages.length > 1) {
        const historyText = messages.slice(0, -1).map((msg: any) => 
            `${msg.role === 'user' ? 'Alumno' : 'Tutor AI'}: ${msg.content}`
        ).join('\n\n');
        parts.push({ text: `Historial de la conversación:\n${historyText}\n\nNueva pregunta del alumno:` });
    }

    parts.push({ text: promptText });

    let success = false;
    let resultData;
    let lastError: any;

    // SISTEMA DE FALLBACK ITERATIVO
    for (const modelName of MODELS) {
        try {
            console.log(`[TurboStudy] Intentando acción '${action}' con modelo: ${modelName}`);
            
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
                // Para modelos que no soportan systemInstruction como parámetro separado
                finalParts = [{ text: `Instrucciones del sistema: ${systemInstruction}\n\n` }, ...parts];
            }

            const result = await model.generateContent({
                contents: [{ role: "user", parts: finalParts }]
            });
            
            const textResponse = result.response.text();

            if (action === "generate_test") {
                resultData = cleanAndParseJSON(textResponse);
                if (!Array.isArray(resultData)) throw new Error("Estructura JSON inválida");
            } else {
                resultData = textResponse;
            }

            success = true;
            break;
        } catch (aiError: any) {
            console.warn(`Fallo con ${modelName}:`, aiError.message);
            lastError = aiError;
        }
    }

    if (!success) {
        return NextResponse.json({ error: `Fallo tras intentar todos los modelos AI. Último error: ${lastError?.message}` }, { status: 500 });
    }

    return NextResponse.json({ data: resultData });

  } catch (error: any) {
    console.error("Error en turbo-study:", error);
    return NextResponse.json({ error: error.message || "Error del servidor" }, { status: 500 });
  }
}