import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamObject } from 'ai';
import { z } from 'zod';
import { NextResponse } from 'next/server';

export const maxDuration = 60;

// Inicializamos el proveedor apuntando a tu variable de entorno
const googleProvider = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

export async function POST(req: Request) {
  try {
    // 1. AHORA LEEMOS LA PETICIÓN COMO JSON (Esto evita el error que mencionas)
    const body = await req.json();
    
    const cardType = body.cardType as string;
    const cardCount = parseInt(body.cardCount as string, 10);
    const language = body.language as string;
    const difficulty = body.difficulty as string;
    const generationSource = body.generationSource as string;
    const topic = body.topic as string | null;
    const pdfFileBase64 = body.pdfFileBase64 as string | null;
    const pageRangeStr = body.pageRange as string | null;

    const cardTypeInstructions = {
        qa: 'Clear question in the "front" and concise answer in the "back".',
        vocabulary: 'Term in the "front" and its definition/translation in the "back".',
        facts: 'Prompt/Fill-in-the-blank in the "front" and the key fact in the "back".'
    };

    let sourceInstruction = "";
    let filePart = null;

    if (generationSource === 'pdf' && pdfFileBase64) {
        filePart = {
            type: 'file' as const,
            data: pdfFileBase64,
            mimeType: "application/pdf",
        };

        sourceInstruction = `Use the attached document as the ONLY source material.`;
        if (pageRangeStr && pageRangeStr.trim() !== '') {
            sourceInstruction += `\nCRITICAL: ONLY extract info from pages ${pageRangeStr}. Completely ignore the rest.`;
        }
    } else {
        sourceInstruction = `Use the following topic as the source material:\n"""\n${topic}\n"""`;
    }

    const promptText = `
      You are an expert educational content creator.
      **Source Material:** ${sourceInstruction}
      **Language:** ${language}
      **Number of Cards Needed:** ${cardCount}
      **Type:** ${cardTypeInstructions[cardType as keyof typeof cardTypeInstructions]}
      **Difficulty:** ${difficulty}

      Generate exactly ${cardCount} high-quality flashcards based strictly on the source.
    `;

    const messages: any[] = [
        { role: 'user', content: [ { type: 'text', text: promptText } ] }
    ];

    if (filePart) {
        messages[0].content.push(filePart);
    }

    // Comprobación de seguridad
    if (!process.env.GOOGLE_API_KEY && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
        throw new Error("API Key is missing in environment variables.");
    }

    // Usamos el googleProvider instanciado arriba
    const result = await streamObject({
        model: googleProvider('gemini-2.5-flash'),
        messages: messages,
        schema: z.object({
            cards: z.array(z.object({
                front: z.string().describe("The front of the flashcard"),
                back: z.string().describe("The back of the flashcard")
            }))
        })
    });

    return result.toTextStreamResponse();

  } catch (error: any) {
    console.error("Stream Error:", error);
    // Devolvemos el error real para mostrarlo en el front
    return NextResponse.json(
        { error: error.message || "Failed to generate stream" }, 
        { status: 500 }
    );
  }
}