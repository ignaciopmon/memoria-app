import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type DeckInput = {
  deckId: string;
  name: string;
  status: string;
  currentInterval: number;
  lastScore: number;
  nextReviewDate: string;
  isDue: boolean;
  cardCount: number;
};

type DeckInsightTier = "critical" | "watch" | "strong";
type DeckInsight = {
  deckId: string;
  tier: DeckInsightTier;
  headline: string;
  reason: string;
  nextAction: string;
  priority: number;
};

const MODELS = ["gemini-2.5-flash", "gemma-3-27b", "gemma-3-12b"];
const apiKey = process.env.GOOGLE_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

const cleanAndParseJSON = (text: string) => {
  let cleanText = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const firstOpen = cleanText.indexOf("{");
  const lastClose = cleanText.lastIndexOf("}");
  if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
    cleanText = cleanText.substring(firstOpen, lastClose + 1);
  }
  return JSON.parse(cleanText);
};

const normalizeTier = (value: unknown): DeckInsightTier => {
  const normalized = typeof value === "string" ? value.toLowerCase() : "";
  if (normalized === "critical") return "critical";
  if (normalized === "watch") return "watch";
  return "strong";
};

const buildFallback = (decks: DeckInput[]) => {
  const insights: DeckInsight[] = decks
    .map((deck) => {
      const lowScore = (deck.lastScore || 0) < 65;
      const mediumScore = (deck.lastScore || 0) < 80;
      const isCritical = deck.status === "Needs Focus" || lowScore;
      const isWatch = !isCritical && (deck.isDue || mediumScore || deck.currentInterval < 30);

      if (isCritical) {
        return {
          deckId: deck.deckId,
          tier: "critical" as const,
          headline: "High-risk retention",
          reason: "Recent performance or status indicates unstable recall.",
          nextAction: "Run a short focused simulation today and retest in 72 hours.",
          priority: 1,
        };
      }

      if (isWatch) {
        return {
          deckId: deck.deckId,
          tier: "watch" as const,
          headline: "Needs consistency",
          reason: "Progress exists but retention signal is still volatile.",
          nextAction: "Keep this deck in mixed sessions until it reaches sustained 80%+.",
          priority: 2,
        };
      }

      return {
        deckId: deck.deckId,
        tier: "strong" as const,
        headline: "Stable progression",
        reason: "Current interval and historical score show reliable recall.",
        nextAction: "Include this deck occasionally to avoid drift, not as a main target.",
        priority: 3,
      };
    })
    .sort((a, b) => a.priority - b.priority);

  const criticalCount = insights.filter((item) => item.tier === "critical").length;
  const watchCount = insights.filter((item) => item.tier === "watch").length;
  const strongCount = insights.filter((item) => item.tier === "strong").length;

  return {
    summary: `Coach snapshot: ${criticalCount} critical, ${watchCount} watch, ${strongCount} strong decks.`,
    insights,
    source: "fallback",
  };
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const rawDecks = Array.isArray(body?.decks) ? body.decks : [];
    const decks: DeckInput[] = rawDecks
      .slice(0, 40)
      .filter((deck: any) => typeof deck?.deckId === "string" && typeof deck?.name === "string")
      .map((deck: any) => ({
        deckId: deck.deckId,
        name: deck.name,
        status: deck.status || "Learning",
        currentInterval: Number(deck.currentInterval || 0),
        lastScore: Number(deck.lastScore || 0),
        nextReviewDate: deck.nextReviewDate || new Date().toISOString(),
        isDue: Boolean(deck.isDue),
        cardCount: Number(deck.cardCount || 0),
      }));

    if (decks.length === 0) {
      return NextResponse.json({ error: "No decks provided" }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json(buildFallback(decks));
    }

    const validDeckIds = new Set(decks.map((deck) => deck.deckId));

    const prompt = `
You are an academic retention coach.
Analyze the provided decks and produce a qualification report for study priority.

Return ONLY raw JSON (no markdown) with this exact structure:
{
  "summary": "One concise summary sentence",
  "insights": [
    {
      "deckId": "deck id from input",
      "tier": "critical|watch|strong",
      "headline": "short title",
      "reason": "short reason",
      "nextAction": "one concrete action",
      "priority": 1
    }
  ]
}

Rules:
- Keep each field concise.
- Use only deckId values from input.
- Priorities: 1 = urgent, 2 = medium, 3 = low.
- This is for deck qualification only. Do not generate tests or questions.

Input deck data:
${JSON.stringify(decks)}
`;

    let lastError: unknown;

    for (const modelName of MODELS) {
      try {
        const generationConfig = modelName.includes("gemini")
          ? { responseMimeType: "application/json" }
          : undefined;

        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig,
        });
        const result = await model.generateContent([prompt]);
        const parsed = cleanAndParseJSON(result.response.text());
        const rawInsights = Array.isArray(parsed?.insights)
          ? parsed.insights
          : Array.isArray(parsed)
            ? parsed
            : [];

        const insights: DeckInsight[] = rawInsights
          .filter((item: any) => validDeckIds.has(item?.deckId))
          .map((item: any) => ({
            deckId: item.deckId,
            tier: normalizeTier(item.tier),
            headline: typeof item.headline === "string" ? item.headline : "Deck signal",
            reason: typeof item.reason === "string" ? item.reason : "No reason provided by model.",
            nextAction: typeof item.nextAction === "string" ? item.nextAction : "Review this deck soon.",
            priority: Number(item.priority) >= 1 ? Math.min(3, Math.floor(Number(item.priority))) : 2,
          }))
          .sort((a: DeckInsight, b: DeckInsight) => a.priority - b.priority);

        if (insights.length === 0) {
          throw new Error("Model returned no valid insights");
        }

        const summary =
          typeof parsed?.summary === "string" && parsed.summary.trim().length > 0
            ? parsed.summary
            : "Deck qualification completed.";

        return NextResponse.json({
          summary,
          insights,
          source: modelName,
        });
      } catch (error) {
        lastError = error;
      }
    }

    console.warn("AI deck qualification failed, using fallback", lastError);
    return NextResponse.json(buildFallback(decks));
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
