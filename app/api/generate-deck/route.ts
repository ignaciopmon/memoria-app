// app/api/generate-deck/route.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Prevenir timeout de Vercel (60s)

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API Key missing." }, { status: 500 });
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "User not authenticated." }, { status: 401 });

    const formData = await request.formData();
    const deckName = formData.get('deckName') as string | null;
    const cardType = formData.get('cardType') as 'qa' | 'vocabulary' | 'facts' | null;
    const cardCountStr = formData.get('cardCount') as string | null;
    const language = formData.get('language') as string | null;
    const difficulty = formData.get('difficulty') as 'easy' | 'medium' | 'hard' | null;
    const generationSource = formData.get('generationSource') as 'topic' | 'pdf' | null;
    const topic = formData.get('topic') as string | null;
    const pdfFile = formData.get('pdfFile') as File | null;
    const pageRangeStr = formData.get('pageRange') as string | null;

    const cardCount = cardCountStr ? parseInt(cardCountStr, 10) : 0;

    if (!deckName || !cardType || !cardCount || !language || !difficulty || !generationSource) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const cardTypeInstructions = {
        qa: 'Each card must be a clear question in the "front" and a concise answer in the "back".',
        vocabulary: 'Each card must contain a term or word in the "front" and its definition or translation in the "back".',
        facts: 'Each card must present a key piece of information, with a prompt in the "front" (like a fill-in-the-blank or a name) and the corresponding fact in the "back".'
    };
    
    const difficultyInstructions = {
        easy: "Cover basic and fundamental concepts. Ideal for a beginner.",
        medium: "Cover a balance of core concepts and some detailed information.",
        hard: "Focus on complex, nuanced, or advanced details. Ideal for an expert."
    };

    let promptParts: any[] = [];
    let sourceInstruction = "";
    
    // Lista base de modelos
    let availableModels = [
      "gemini-2.5-flash",
      "gemma-3-27b",
      "gemma-3-12b"
    ];

    if (generationSource === 'pdf' && pdfFile) {
        // Excluimos modelos que puedan tener problemas con mimeType de PDF nativo
        availableModels = availableModels.filter(m => m.includes("gemini"));

        const arrayBuffer = await pdfFile.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString("base64");
        
        promptParts.push({
            inlineData: {
                data: base64Data,
                mimeType: "application/pdf"
            }
        });

        sourceInstruction = `Use the attached PDF document as the ONLY source material.`;
        if (pageRangeStr && pageRangeStr.trim() !== '') {
            sourceInstruction += `\n**CRITICAL REQUIREMENT:** ONLY extract information from pages ${pageRangeStr} of the PDF. Completely ignore the rest.`;
        }
    } else {
        sourceInstruction = `Use the following topic as the source material:\n"""\n${topic}\n"""`;
    }

    const promptText = `
      You are an expert in creating educational flashcards.
      **Source Material:** ${sourceInstruction}
      **Language:** ${language}
      **Number of Cards:** ${cardCount}
      **Type:** ${cardTypeInstructions[cardType]}
      **Difficulty:** ${difficultyInstructions[difficulty]}

      **Instructions:**
      1. Generate EXACTLY ${cardCount} flashcards based STRICTLY on the Source Material.
      2. Output (both front and back) MUST be in ${language}.
      3. Return ONLY a valid JSON array. Do not add any conversational text.
      4. Required Structure: [{"front": "...", "back": "..."}]
    `;

    promptParts.unshift(promptText);

    let generatedCards = null;
    let lastError: any;

    for (const modelName of availableModels) {
        try {
            const isGemini = modelName.includes("gemini");
            
            const model = genAI.getGenerativeModel({ 
                model: modelName,
                generationConfig: {
                  ...(isGemini ? { responseMimeType: "application/json" } : {}),
                  maxOutputTokens: 8192 // Evita que se corte a la mitad si son muchas tarjetas
                }
            });
            
            const result = await model.generateContent(promptParts);
            const text = result.response.text();
            
            // Extracción robusta del JSON buscando corchetes
            const firstOpen = text.indexOf('[');
            const lastClose = text.lastIndexOf(']');
            
            if (firstOpen === -1 || lastClose === -1 || lastClose < firstOpen) {
              throw new Error("No JSON array found in response.");
            }

            const cleanText = text.substring(firstOpen, lastClose + 1);
            generatedCards = JSON.parse(cleanText);

            if (!Array.isArray(generatedCards) || generatedCards.length === 0) {
              throw new Error("Invalid or empty JSON array.");
            }
            
            // Verificamos que al menos la primera tarjeta tenga la estructura correcta
            if (!generatedCards[0].front || !generatedCards[0].back) {
              throw new Error("Missing 'front' or 'back' keys in JSON object.");
            }

            break; // Éxito, salimos del bucle
        } catch (aiError: any) {
            lastError = aiError;
            generatedCards = null; // Reiniciamos por si falló a medias
        }
    }

    if (!generatedCards) {
        return NextResponse.json({ 
          error: "Generación fallida tras probar todos los modelos.", 
          details: lastError?.message 
        }, { status: 500 });
    }

    // Aseguramos la cantidad exacta pedida (por si la IA generó de más)
    const cardsToProcess = generatedCards.slice(0, cardCount);

    // Creamos el mazo SOLO si la generación de tarjetas fue exitosa
    const { data: newDeck, error: deckError } = await supabase
        .from('decks')
        .insert({
            user_id: user.id,
            name: deckName,
            description: `AI-generated from ${generationSource === 'pdf' ? `PDF` : `Topic`}`
        }).select('id').single();

    if (deckError || !newDeck) return NextResponse.json({ error: "Database error while creating deck." }, { status: 500 });

    const cardsToInsert = cardsToProcess.map((card: {front: string, back: string}) => ({
        deck_id: newDeck.id,
        front: String(card.front).trim(),
        back: String(card.back).trim(),
        ease_factor: 2.5,
        interval: 0,
        repetitions: 0,
        next_review_date: new Date().toISOString()
    }));

    const { error: cardsError } = await supabase.from('cards').insert(cardsToInsert);

    if (cardsError) {
        // Limpieza: si fallan las tarjetas, borramos el mazo vacío
        await supabase.from('decks').delete().eq('id', newDeck.id);
        return NextResponse.json({ error: "Could not save cards to database." }, { status: 500 });
    }

    return NextResponse.json({ success: true, deckId: newDeck.id });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unknown server error." }, { status: 500 });
  }
}