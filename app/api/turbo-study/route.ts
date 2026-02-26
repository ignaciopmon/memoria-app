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

export async function POST(request: Request) {
  if (!apiKey) {
    return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { action, messages, pdfBase64, questionCount, language } = body;

    let systemInstruction = "You are an expert and friendly AI tutor. Your goal is to help the user study the provided material. Focus on explaining the main themes and core concepts. You may use your general knowledge to complement the explanations, but do not hallucinate information unrelated to the subjects of the document.";
    let promptText = messages?.[messages.length - 1]?.content || "";
    
    if (action === "generate_test") {
         systemInstruction = `You are an expert university professor creating a multiple-choice test. 
         Generate exactly ${questionCount} questions in ${language} about the MAIN TOPICS discussed in the provided material.
         
         CRITICAL RULES:
         1. DO NOT ask about specific anecdotes, trivial examples, or overly specific numbers/names mentioned in the text.
         2. Focus exclusively on the CORE CONCEPTS, theories, and the general framework of the document.
         3. You MUST use your extensive external knowledge to enrich the questions and provide deeper context.
         
         Return ONLY a raw JSON array. Exact format: [{"question": "...", "options": {"A": "...", "B": "...", "C": "...", "D": "..."}, "answer": "A", "explanation": "Brief explanation of why this is correct based on the concept"}]`;
         promptText = "Analyze the core themes of the provided material and generate the conceptual test now.";
    }

    const parts: any[] = [];
    
    if (pdfBase64) {
        parts.push({
            inlineData: { data: pdfBase64, mimeType: "application/pdf" }
        });
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