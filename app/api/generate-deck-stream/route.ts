import { google } from '@ai-sdk/google';
import { streamObject } from 'ai';
import { z } from 'zod';
import { NextResponse } from 'next/server';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    
    const cardType = formData.get('cardType') as string;
    const cardCount = parseInt(formData.get('cardCount') as string, 10);
    const language = formData.get('language') as string;
    const difficulty = formData.get('difficulty') as string;
    const generationSource = formData.get('generationSource') as string;
    const topic = formData.get('topic') as string | null;
    const pdfFile = formData.get('pdfFile') as File | null;
    const pageRangeStr = formData.get('pageRange') as string | null;

    const cardTypeInstructions = {
        qa: 'Clear question in the "front" and concise answer in the "back".',
        vocabulary: 'Term in the "front" and its definition/translation in the "back".',
        facts: 'Prompt/Fill-in-the-blank in the "front" and the key fact in the "back".'
    };

    let sourceInstruction = "";
    let filePart = null;

    if (generationSource === 'pdf' && pdfFile) {
        const arrayBuffer = await pdfFile.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString("base64");
        
        filePart = {
            type: 'file' as const,
            data: base64Data,
            mimeType: pdfFile.type,
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

    // Usamos streamObject de Vercel AI para asegurar que el modelo devuelve un JSON progresivo
    const result = await streamObject({
        model: google('gemini-2.5-flash'),
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
    return NextResponse.json({ error: "Failed to generate stream" }, { status: 500 });
  }
}