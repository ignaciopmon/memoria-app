"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  EXPANSION_HAND_BRAKE_INTERVAL,
  EXPANSION_INITIAL_INTERVAL,
  EXPANSION_MASTERED_FROM,
  EXPANSION_PASS_THRESHOLD,
  toReviewLevel,
  type ExpansionStatus,
} from "@/lib/expansion-cycle";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  AlertTriangle,
  BookOpenCheck,
  Bot,
  BrainCircuit,
  Check,
  ChevronsRight,
  Flame,
  Infinity as InfinityIcon,
  Layers,
  Loader2,
  Palette,
  Play,
  Rocket,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Target,
  X,
} from "lucide-react";

type DeckMastery = {
  deck_id: string;
  deck_name: string;
  current_interval: number;
  status: ExpansionStatus;
  last_score: number;
  next_review_date: string;
  isDue: boolean;
  card_count: number;
};

type Flashcard = {
  id: string;
  deck_id: string;
  deck_name: string;
  front: string;
  back: string;
};

type DeckSessionResult = {
  score: number;
  total: number;
  name: string;
  previousInterval: number;
  previousStatus: ExpansionStatus;
};

type DeckOutcome = {
  deckId: string;
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  previousInterval: number;
  previousStatus: ExpansionStatus;
  newInterval: number;
  newStatus: ExpansionStatus;
  nextReviewDate: string;
};

type AppState = "hub" | "loading_cards" | "studying" | "results";
type SimulationMode = "due" | "all";
type AccentTheme = "ocean" | "forest" | "sunset";
type SimulationProfile = "focus" | "balanced" | "sprint";
type DeckInsightTier = "critical" | "watch" | "strong";
type DeckInsight = {
  deckId: string;
  tier: DeckInsightTier;
  headline: string;
  reason: string;
  nextAction: string;
  priority: number;
};
type SamplingSettings = {
  minPerDeck: number;
  maxPerDeck: number;
  sessionCap: number;
};

const PREFERENCES_KEY = "simulations-page-preferences-v2";

const PROFILE_PRESETS: Record<
  SimulationProfile,
  {
    label: string;
    hint: string;
    settings: SamplingSettings;
    icon: ComponentType<{ className?: string }>;
  }
> = {
  focus: {
    label: "Focus Recovery",
    hint: "Smaller session, quick signal for weaker decks.",
    settings: { minPerDeck: 2, maxPerDeck: 5, sessionCap: 24 },
    icon: ShieldAlert,
  },
  balanced: {
    label: "Balanced Study",
    hint: "Recommended baseline for consistent progress.",
    settings: { minPerDeck: 2, maxPerDeck: 8, sessionCap: 48 },
    icon: BrainCircuit,
  },
  sprint: {
    label: "Exam Sprint",
    hint: "Large mixed session with higher pressure.",
    settings: { minPerDeck: 3, maxPerDeck: 12, sessionCap: 72 },
    icon: Rocket,
  },
};

const ACCENT_STYLES: Record<
  AccentTheme,
  {
    label: string;
    heroGradient: string;
    heroGlow: string;
    chip: string;
    primaryButton: string;
  }
> = {
  ocean: {
    label: "Ocean",
    heroGradient: "from-cyan-500/20 via-blue-500/15 to-indigo-500/20",
    heroGlow: "bg-cyan-500/30",
    chip: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    primaryButton: "from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600",
  },
  forest: {
    label: "Forest",
    heroGradient: "from-emerald-500/20 via-green-500/15 to-lime-500/20",
    heroGlow: "bg-emerald-500/30",
    chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    primaryButton: "from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600",
  },
  sunset: {
    label: "Sunset",
    heroGradient: "from-orange-500/20 via-rose-500/15 to-amber-500/20",
    heroGlow: "bg-orange-500/30",
    chip: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
    primaryButton: "from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600",
  },
};

const shuffleArray = <T,>(items: T[]): T[] => {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const buildBalancedCards = (
  deckIds: string[],
  cardsByDeck: Record<string, Flashcard[]>,
  settings: SamplingSettings,
) => {
  const minPerDeck = Math.max(1, Math.min(settings.minPerDeck, settings.maxPerDeck));
  const maxPerDeck = Math.max(minPerDeck, settings.maxPerDeck);
  const sessionCap = Math.max(maxPerDeck, settings.sessionCap);

  const selected: Flashcard[] = [];
  const usedByDeck = new Map<string, number>();
  const queue = shuffleArray(deckIds);

  for (const deckId of queue) {
    cardsByDeck[deckId] = shuffleArray(cardsByDeck[deckId] || []);
    usedByDeck.set(deckId, 0);
  }

  for (const deckId of queue) {
    const deckCards = cardsByDeck[deckId] || [];
    const seedCount = Math.min(deckCards.length, minPerDeck);
    for (let i = 0; i < seedCount && selected.length < sessionCap; i += 1) {
      selected.push(deckCards[i]);
      usedByDeck.set(deckId, i + 1);
    }
  }

  let added = true;
  while (selected.length < sessionCap && added) {
    added = false;
    for (const deckId of queue) {
      const deckCards = cardsByDeck[deckId] || [];
      const used = usedByDeck.get(deckId) ?? 0;
      if (used >= deckCards.length || used >= maxPerDeck) {
        continue;
      }
      selected.push(deckCards[used]);
      usedByDeck.set(deckId, used + 1);
      added = true;
      if (selected.length >= sessionCap) {
        break;
      }
    }
  }

  return selected;
};

const statusBadge = (status: ExpansionStatus) => {
  if (status === "Mastered") {
    return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-none shadow-none">Mastered</Badge>;
  }
  if (status === "Reviewing") {
    return <Badge className="bg-blue-500/10 text-blue-600 border-none shadow-none">Reviewing</Badge>;
  }
  if (status === "Needs Focus") {
    return (
      <Badge variant="destructive" className="border-none shadow-none flex w-fit items-center gap-1">
        <AlertTriangle className="h-3 w-3" />
        Needs Focus
      </Badge>
    );
  }
  return <Badge variant="secondary" className="border-none shadow-none">Learning</Badge>;
};

const getInsightBadge = (tier: DeckInsightTier) => {
  if (tier === "critical") {
    return <Badge className="bg-red-500/10 text-red-700 dark:text-red-300 border-none">Critical</Badge>;
  }
  if (tier === "watch") {
    return <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-none">Watch</Badge>;
  }
  return <Badge className="bg-green-500/10 text-green-700 dark:text-green-300 border-none">Strong</Badge>;
};

export default function SimulationsPage() {
  const router = useRouter();
  const [state, setState] = useState<AppState>("hub");
  const [masteryData, setMasteryData] = useState<DeckMastery[]>([]);
  const [loading, setLoading] = useState(true);

  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionResults, setSessionResults] = useState<Record<string, DeckSessionResult>>({});
  const [savingResults, setSavingResults] = useState(false);
  const [outcomes, setOutcomes] = useState<DeckOutcome[]>([]);

  const [controlTab, setControlTab] = useState<"mission" | "style" | "ai">("mission");
  const [accentTheme, setAccentTheme] = useState<AccentTheme>("ocean");
  const [profile, setProfile] = useState<SimulationProfile>("balanced");
  const [sampling, setSampling] = useState<SamplingSettings>(PROFILE_PRESETS.balanced.settings);
  const [includeMastered, setIncludeMastered] = useState(true);
  const [showLivePanel, setShowLivePanel] = useState(true);
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>([]);
  const [preferencesReady, setPreferencesReady] = useState(false);

  const [aiInsights, setAiInsights] = useState<Record<string, DeckInsight>>({});
  const [aiSummary, setAiSummary] = useState("");
  const [isAiRunning, setIsAiRunning] = useState(false);

  const supabase = createClient();
  const { toast } = useToast();

  useEffect(() => {
    fetchHubData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = localStorage.getItem(PREFERENCES_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<{
          accentTheme: AccentTheme;
          profile: SimulationProfile;
          sampling: SamplingSettings;
          includeMastered: boolean;
          showLivePanel: boolean;
          selectedDeckIds: string[];
        }>;
        if (parsed.accentTheme && ACCENT_STYLES[parsed.accentTheme]) {
          setAccentTheme(parsed.accentTheme);
        }
        if (parsed.profile && PROFILE_PRESETS[parsed.profile]) {
          setProfile(parsed.profile);
        }
        if (parsed.sampling) {
          setSampling({
            minPerDeck: Math.max(1, parsed.sampling.minPerDeck ?? PROFILE_PRESETS.balanced.settings.minPerDeck),
            maxPerDeck: Math.max(1, parsed.sampling.maxPerDeck ?? PROFILE_PRESETS.balanced.settings.maxPerDeck),
            sessionCap: Math.max(8, parsed.sampling.sessionCap ?? PROFILE_PRESETS.balanced.settings.sessionCap),
          });
        }
        if (typeof parsed.includeMastered === "boolean") {
          setIncludeMastered(parsed.includeMastered);
        }
        if (typeof parsed.showLivePanel === "boolean") {
          setShowLivePanel(parsed.showLivePanel);
        }
        if (Array.isArray(parsed.selectedDeckIds)) {
          setSelectedDeckIds(parsed.selectedDeckIds);
        }
      } catch {
        // ignore invalid local state
      }
    }

    setPreferencesReady(true);
  }, []);

  useEffect(() => {
    if (!preferencesReady || typeof window === "undefined") {
      return;
    }

    localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({
        accentTheme,
        profile,
        sampling,
        includeMastered,
        showLivePanel,
        selectedDeckIds,
      }),
    );
  }, [accentTheme, includeMastered, preferencesReady, profile, sampling, selectedDeckIds, showLivePanel]);

  useEffect(() => {
    if (masteryData.length === 0) {
      return;
    }

    setSelectedDeckIds((prev) => {
      const valid = prev.filter((deckId) => masteryData.some((deck) => deck.deck_id === deckId && deck.card_count > 0));
      if (valid.length > 0) {
        return valid;
      }
      return masteryData.filter((deck) => deck.card_count > 0).map((deck) => deck.deck_id);
    });
  }, [masteryData]);

  const outcomeByDeck = useMemo(() => {
    return outcomes.reduce((acc, item) => {
      acc[item.deckId] = item;
      return acc;
    }, {} as Record<string, DeckOutcome>);
  }, [outcomes]);

  const dueDecksCount = masteryData.filter((d) => d.isDue).length;
  const focusDecksCount = masteryData.filter((d) => d.status === "Needs Focus").length;
  const masteredDecksCount = masteryData.filter((d) => d.status === "Mastered").length;
  const selectedDeckCount = selectedDeckIds.length;
  const selectedDeckCards = masteryData
    .filter((deck) => selectedDeckIds.includes(deck.deck_id))
    .reduce((sum, deck) => sum + deck.card_count, 0);
  const accentStyle = ACCENT_STYLES[accentTheme];
  const ProfileIcon = PROFILE_PRESETS[profile].icon;
  const liveDeckRows = useMemo(() => {
    return Object.entries(sessionResults)
      .filter(([, result]) => result.total > 0)
      .map(([deckId, result]) => {
        const accuracy = Math.round((result.score / result.total) * 100);
        const passed = accuracy >= EXPANSION_PASS_THRESHOLD;
        const projectedInterval = passed
          ? result.previousInterval === 0
            ? EXPANSION_INITIAL_INTERVAL
            : result.previousInterval * 2
          : EXPANSION_HAND_BRAKE_INTERVAL;
        const projectedStatus: ExpansionStatus = passed
          ? projectedInterval >= EXPANSION_MASTERED_FROM
            ? "Mastered"
            : "Reviewing"
          : "Needs Focus";

        return {
          deckId,
          ...result,
          accuracy,
          passed,
          projectedInterval,
          projectedStatus,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [sessionResults]);
  const liveReviewedCards = liveDeckRows.reduce((sum, row) => sum + row.total, 0);
  const liveCorrectCards = liveDeckRows.reduce((sum, row) => sum + row.score, 0);
  const liveAccuracy = liveReviewedCards > 0 ? Math.round((liveCorrectCards / liveReviewedCards) * 100) : 0;

  const fetchHubData = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data: decks } = await supabase
      .from("decks")
      .select("id, name")
      .eq("is_folder", false)
      .is("deleted_at", null);

    if (!decks || decks.length === 0) {
      setMasteryData([]);
      setLoading(false);
      return;
    }

    const deckIds = decks.map((deck) => deck.id);

    const [{ data: mastery }, { data: deckCards }] = await Promise.all([
      supabase.from("deck_mastery").select("*").eq("user_id", user.id).in("deck_id", deckIds),
      supabase.from("cards").select("deck_id").in("deck_id", deckIds).is("deleted_at", null),
    ]);

    const cardCountByDeck = (deckCards || []).reduce((acc, card) => {
      acc[card.deck_id] = (acc[card.deck_id] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const now = Date.now();
    const merged: DeckMastery[] = decks
      .map((deck) => {
        const masteryRow = mastery?.find((row) => row.deck_id === deck.id);
        const cardCount = cardCountByDeck[deck.id] ?? 0;
        const nextReviewDate = masteryRow?.next_review_date ?? new Date().toISOString();
        const dueByDate = !masteryRow || new Date(nextReviewDate).getTime() <= now;
        const needsFocus = masteryRow?.status === "Needs Focus";

        return {
          deck_id: deck.id,
          deck_name: deck.name,
          current_interval: masteryRow?.current_interval ?? 0,
          status: (masteryRow?.status as ExpansionStatus) ?? "Learning",
          last_score: masteryRow?.last_score ?? 0,
          next_review_date: nextReviewDate,
          isDue: cardCount > 0 && (dueByDate || needsFocus),
          card_count: cardCount,
        };
      })
      .sort((a, b) => {
        if (a.isDue !== b.isDue) {
          return a.isDue ? -1 : 1;
        }
        return new Date(a.next_review_date).getTime() - new Date(b.next_review_date).getTime();
      });

    setMasteryData(merged);
    setLoading(false);
  };

  const applyProfile = (nextProfile: SimulationProfile) => {
    setProfile(nextProfile);
    setSampling(PROFILE_PRESETS[nextProfile].settings);
  };

  const toggleDeckSelection = (deckId: string, checked: boolean) => {
    setSelectedDeckIds((prev) => {
      if (checked) {
        if (prev.includes(deckId)) {
          return prev;
        }
        return [...prev, deckId];
      }
      return prev.filter((id) => id !== deckId);
    });
  };

  const selectDueDecks = () => {
    setSelectedDeckIds(masteryData.filter((deck) => deck.isDue).map((deck) => deck.deck_id));
  };

  const selectAllDecksWithCards = () => {
    setSelectedDeckIds(masteryData.filter((deck) => deck.card_count > 0).map((deck) => deck.deck_id));
  };

  const clearDeckSelection = () => {
    setSelectedDeckIds([]);
  };

  const runAiCoach = async () => {
    if (masteryData.length === 0) {
      toast({ title: "No decks found", description: "Create decks first, then run AI Deck Coach." });
      return;
    }

    setIsAiRunning(true);
    try {
      const response = await fetch("/api/qualify-decks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decks: masteryData.map((deck) => ({
            deckId: deck.deck_id,
            name: deck.deck_name,
            status: deck.status,
            currentInterval: deck.current_interval,
            lastScore: deck.last_score,
            nextReviewDate: deck.next_review_date,
            isDue: deck.isDue,
            cardCount: deck.card_count,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("AI Deck Coach failed");
      }

      const payload = (await response.json()) as {
        summary?: string;
        insights?: DeckInsight[];
      };

      const insightMap = (payload.insights || []).reduce((acc, insight) => {
        acc[insight.deckId] = insight;
        return acc;
      }, {} as Record<string, DeckInsight>);

      setAiInsights(insightMap);
      setAiSummary(payload.summary || "AI coach updated.");
      toast({ title: "AI Deck Coach updated", description: "Deck signals and actions are now available." });
    } catch {
      toast({ variant: "destructive", title: "AI Deck Coach unavailable" });
    } finally {
      setIsAiRunning(false);
    }
  };

  const startSimulation = async (mode: SimulationMode) => {
    setState("loading_cards");

    const selectionSet = new Set(selectedDeckIds);
    const candidates = masteryData.filter((deck) => {
      const isSelected = selectionSet.size === 0 || selectionSet.has(deck.deck_id);
      if (!isSelected) {
        return false;
      }

      if (mode === "all") {
        return deck.card_count > 0 && (includeMastered || deck.status !== "Mastered");
      }
      return deck.isDue && (includeMastered || deck.status !== "Mastered");
    });

    if (candidates.length === 0) {
      toast({
        title: "No eligible decks",
        description: "Adjust selection or profile settings and try again.",
      });
      setState("hub");
      return;
    }

    const targetDeckIds = candidates.map((deck) => deck.deck_id);
    const deckNameById = candidates.reduce((acc, deck) => {
      acc[deck.deck_id] = deck.deck_name;
      return acc;
    }, {} as Record<string, string>);

    const { data: fetchedCards } = await supabase
      .from("cards")
      .select("id, deck_id, front, back")
      .in("deck_id", targetDeckIds)
      .is("deleted_at", null);

    if (!fetchedCards || fetchedCards.length === 0) {
      toast({
        variant: "destructive",
        title: "No cards found",
        description: "Add cards to your decks before running a simulation.",
      });
      setState("hub");
      return;
    }

    const formattedCards: Flashcard[] = fetchedCards.map((card) => ({
      id: card.id,
      deck_id: card.deck_id,
      deck_name: deckNameById[card.deck_id] ?? "Unknown deck",
      front: card.front,
      back: card.back,
    }));

    const cardsByDeck = formattedCards.reduce((acc, card) => {
      if (!acc[card.deck_id]) {
        acc[card.deck_id] = [];
      }
      acc[card.deck_id].push(card);
      return acc;
    }, {} as Record<string, Flashcard[]>);

    const decksWithCards = candidates.filter((deck) => (cardsByDeck[deck.deck_id]?.length ?? 0) > 0);

    if (decksWithCards.length === 0) {
      toast({
        variant: "destructive",
        title: "No cards available",
        description: "All selected decks are empty.",
      });
      setState("hub");
      return;
    }

    if (decksWithCards.length < candidates.length) {
      toast({
        title: "Some decks were skipped",
        description: "Only decks with at least one card were included in this simulation.",
      });
    }

    const selectedCards = buildBalancedCards(
      decksWithCards.map((deck) => deck.deck_id),
      cardsByDeck,
      sampling,
    );

    if (selectedCards.length === 0) {
      toast({
        variant: "destructive",
        title: "Unable to build simulation",
        description: "Please check that your selected decks contain cards.",
      });
      setState("hub");
      return;
    }

    const initialResults = decksWithCards.reduce((acc, deck) => {
      acc[deck.deck_id] = {
        score: 0,
        total: 0,
        name: deck.deck_name,
        previousInterval: deck.current_interval,
        previousStatus: deck.status,
      };
      return acc;
    }, {} as Record<string, DeckSessionResult>);

    setCards(selectedCards);
    setCurrentIndex(0);
    setIsFlipped(false);
    setSessionResults(initialResults);
    setOutcomes([]);
    setState("studying");
  };

  const handleRate = (rating: number) => {
    const card = cards[currentIndex];
    if (!card) {
      return;
    }

    const nextResults = { ...sessionResults };
    if (nextResults[card.deck_id]) {
      nextResults[card.deck_id].total += 1;
      if (rating >= 3) {
        nextResults[card.deck_id].score += 1;
      }
    }
    setSessionResults(nextResults);

    if (currentIndex < cards.length - 1) {
      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
      return;
    }

    finishSimulation(nextResults);
  };

  const finishSimulation = async (finalResults: Record<string, DeckSessionResult>) => {
    setState("results");
    setSavingResults(true);

    try {
      const response = await fetch("/api/process-simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultsByDeck: finalResults }),
      });

      if (!response.ok) {
        throw new Error("Failed to save simulation progress.");
      }

      const payload = (await response.json()) as { outcomes?: DeckOutcome[] };
      setOutcomes(payload.outcomes || []);
      await fetchHubData();
    } catch (error) {
      toast({ variant: "destructive", title: "Could not save results" });
    } finally {
      setSavingResults(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-6xl py-8">
      {state === "hub" && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <Card className="relative overflow-hidden border-none shadow-xl">
            <div className={cn("absolute inset-0 bg-gradient-to-br", accentStyle.heroGradient)} />
            <div className={cn("absolute -top-20 right-16 h-56 w-56 rounded-full blur-3xl", accentStyle.heroGlow)} />
            <CardContent className="relative z-10 flex flex-col gap-6 p-6 md:p-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-3">
                <Badge className={cn("gap-1 border-none", accentStyle.chip)}>
                  <Sparkles className="h-3.5 w-3.5" />
                  Student Mission Control
                </Badge>
                <h1 className="flex items-center gap-2 text-3xl font-black tracking-tight md:text-4xl">
                  <InfinityIcon className="h-8 w-8 text-primary" />
                  Simulations Studio
                </h1>
                <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
                  Build your own simulation style, choose which decks to include, and track R-level progression with clearer live feedback.
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border bg-background/80 px-3 py-1">Profile: {PROFILE_PRESETS[profile].label}</span>
                  <span className="rounded-full border bg-background/80 px-3 py-1">
                    Intensity: {sampling.minPerDeck}-{sampling.maxPerDeck} cards/deck
                  </span>
                  <span className="rounded-full border bg-background/80 px-3 py-1">Session cap: {sampling.sessionCap}</span>
                </div>
              </div>
              <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto">
                <Button
                  size="lg"
                  className={cn("gap-2 border-none bg-gradient-to-r text-white shadow-lg", accentStyle.primaryButton)}
                  onClick={() => startSimulation("due")}
                >
                  <Play className="h-5 w-5 fill-current" />
                  Run Due Decks
                </Button>
                <Button size="lg" variant="outline" className="gap-2 bg-background/90" onClick={() => startSimulation("all")}>
                  <Layers className="h-5 w-5" />
                  Run Selected Decks
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="border-muted/60">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-amber-500" />
                  Due Decks
                </CardDescription>
                <CardTitle>{dueDecksCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-muted/60">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-red-500" />
                  Needs Focus
                </CardDescription>
                <CardTitle>{focusDecksCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-muted/60">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Mastered
                </CardDescription>
                <CardTitle>{masteredDecksCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-muted/60">
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4 text-blue-500" />
                  Cards in Selection
                </CardDescription>
                <CardTitle>{selectedDeckCards}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>How R-levels work</CardTitle>
                  <CardDescription>Simple expansion cycle used by the simulator.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-4">
                  <div className="rounded-lg border p-3">
                    <p className="font-semibold text-foreground">R means days</p>
                    <p>{toReviewLevel(30)} means next review in 30 days.</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="font-semibold text-foreground">Pass threshold</p>
                    <p>Score {EXPANSION_PASS_THRESHOLD}% or higher to pass.</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="font-semibold text-foreground">Pass result</p>
                    <p>{toReviewLevel(30)} {String.fromCharCode(8594)} {toReviewLevel(60)} {String.fromCharCode(8594)} {toReviewLevel(120)} (interval doubles).</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="font-semibold text-foreground">Fail result</p>
                    <p>Handbrake to {toReviewLevel(EXPANSION_HAND_BRAKE_INTERVAL)} for focused recovery.</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-muted">
                <CardHeader>
                  <CardTitle className="text-xl">Deck Expansion Status</CardTitle>
                  <CardDescription>Use Study Deck to open the original study flow for that deck.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-hidden rounded-xl border">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead>Deck</TableHead>
                          <TableHead>Cards</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Level</TableHead>
                          <TableHead>Last Score</TableHead>
                          <TableHead>AI Signal</TableHead>
                          <TableHead>Next Review</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {masteryData.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} className="py-8 text-center">
                              No decks available yet.
                            </TableCell>
                          </TableRow>
                        ) : (
                          masteryData.map((deck) => {
                            const insight = aiInsights[deck.deck_id];
                            return (
                              <TableRow key={deck.deck_id} className={deck.status === "Needs Focus" ? "bg-red-500/5 dark:bg-red-900/10" : ""}>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    <Layers className="h-4 w-4 text-muted-foreground" />
                                    {deck.deck_name}
                                  </div>
                                  {insight?.headline ? <p className="mt-1 text-xs text-muted-foreground">{insight.headline}</p> : null}
                                </TableCell>
                                <TableCell>{deck.card_count}</TableCell>
                                <TableCell>{statusBadge(deck.status)}</TableCell>
                                <TableCell className="font-mono font-bold text-primary">{toReviewLevel(deck.current_interval)}</TableCell>
                                <TableCell>{deck.last_score > 0 ? `${deck.last_score}%` : "--"}</TableCell>
                                <TableCell>{insight ? getInsightBadge(insight.tier) : <span className="text-xs text-muted-foreground">Not analyzed</span>}</TableCell>
                                <TableCell>
                                  {deck.card_count === 0 ? (
                                    <span className="text-muted-foreground text-sm">No cards</span>
                                  ) : deck.isDue ? (
                                    <span className="text-amber-500 font-semibold text-sm">Due now</span>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">{format(new Date(deck.next_review_date), "MMM dd, yyyy")}</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="rounded-lg"
                                    disabled={deck.card_count === 0}
                                    onClick={() => router.push(`/study/${deck.deck_id}`)}
                                  >
                                    Study Deck
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-muted/60">
                <CardHeader>
                  <CardTitle className="text-lg">Control Console</CardTitle>
                  <CardDescription>Tune simulation behavior and visual style.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Tabs value={controlTab} onValueChange={(value) => setControlTab(value as "mission" | "style" | "ai")}>
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="mission">Mission</TabsTrigger>
                      <TabsTrigger value="style">Style</TabsTrigger>
                      <TabsTrigger value="ai">AI Coach</TabsTrigger>
                    </TabsList>

                    <TabsContent value="mission" className="space-y-5 pt-4">
                      <div className="space-y-2">
                        <Label>Simulation Profile</Label>
                        <Select value={profile} onValueChange={(value) => applyProfile(value as SimulationProfile)}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select profile" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="focus">Focus Recovery</SelectItem>
                            <SelectItem value="balanced">Balanced Study</SelectItem>
                            <SelectItem value="sprint">Exam Sprint</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground flex items-center gap-2">
                          <ProfileIcon className="h-3.5 w-3.5" />
                          {PROFILE_PRESETS[profile].hint}
                        </p>
                      </div>

                      <div className="space-y-4 rounded-lg border p-3">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>Min cards per deck</span>
                            <span className="font-medium">{sampling.minPerDeck}</span>
                          </div>
                          <Slider
                            min={1}
                            max={6}
                            step={1}
                            value={[sampling.minPerDeck]}
                            onValueChange={(value) =>
                              setSampling((prev) => ({
                                ...prev,
                                minPerDeck: value[0],
                                maxPerDeck: Math.max(value[0], prev.maxPerDeck),
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>Max cards per deck</span>
                            <span className="font-medium">{sampling.maxPerDeck}</span>
                          </div>
                          <Slider
                            min={sampling.minPerDeck}
                            max={16}
                            step={1}
                            value={[sampling.maxPerDeck]}
                            onValueChange={(value) =>
                              setSampling((prev) => ({
                                ...prev,
                                maxPerDeck: Math.max(prev.minPerDeck, value[0]),
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>Session cap</span>
                            <span className="font-medium">{sampling.sessionCap}</span>
                          </div>
                          <Slider
                            min={12}
                            max={96}
                            step={4}
                            value={[sampling.sessionCap]}
                            onValueChange={(value) =>
                              setSampling((prev) => ({
                                ...prev,
                                sessionCap: value[0],
                              }))
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <p className="text-sm font-medium">Include mastered decks</p>
                            <p className="text-xs text-muted-foreground">Keep strong decks in mixed simulations.</p>
                          </div>
                          <Switch checked={includeMastered} onCheckedChange={setIncludeMastered} />
                        </div>
                        <div className="flex items-center justify-between rounded-lg border p-3">
                          <div>
                            <p className="text-sm font-medium">Live data panel</p>
                            <p className="text-xs text-muted-foreground">Show live projections while answering cards.</p>
                          </div>
                          <Switch checked={showLivePanel} onCheckedChange={setShowLivePanel} />
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="style" className="space-y-4 pt-4">
                      <div className="space-y-2">
                        <Label className="flex items-center gap-2">
                          <Palette className="h-4 w-4" />
                          Accent Theme
                        </Label>
                        <div className="grid grid-cols-3 gap-2">
                          {(Object.keys(ACCENT_STYLES) as AccentTheme[]).map((accent) => (
                            <button
                              key={accent}
                              type="button"
                              onClick={() => setAccentTheme(accent)}
                              className={cn(
                                "rounded-lg border p-2 text-xs font-medium transition-all",
                                accentTheme === accent ? "border-primary bg-primary/10" : "hover:bg-muted/60",
                              )}
                            >
                              {ACCENT_STYLES[accent].label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-lg border p-3 text-sm text-muted-foreground">
                        Theme and profile preferences are saved locally for this browser, so your simulation setup is always ready.
                      </div>
                    </TabsContent>

                    <TabsContent value="ai" className="space-y-4 pt-4">
                      <Button className="w-full gap-2" onClick={runAiCoach} disabled={isAiRunning || masteryData.length === 0}>
                        {isAiRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                        Run AI Deck Coach
                      </Button>
                      <div className="rounded-lg border p-3 text-sm">
                        {aiSummary || "AI coach qualifies deck risk and recommends what to attack first. It does not generate tests."}
                      </div>
                      <div className="space-y-2">
                        {Object.values(aiInsights)
                          .sort((a, b) => a.priority - b.priority)
                          .slice(0, 4)
                          .map((insight) => (
                            <div key={insight.deckId} className="rounded-lg border p-3">
                              <div className="mb-2 flex items-center justify-between">
                                {getInsightBadge(insight.tier)}
                                <span className="text-xs text-muted-foreground">P{insight.priority}</span>
                              </div>
                              <p className="text-sm font-medium">{insight.nextAction}</p>
                              <p className="mt-1 text-xs text-muted-foreground">{insight.reason}</p>
                            </div>
                          ))}
                        {Object.keys(aiInsights).length === 0 ? (
                          <p className="text-xs text-muted-foreground">No AI insights yet.</p>
                        ) : null}
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              <Card className="border-muted/60">
                <CardHeader>
                  <CardTitle className="text-lg">Deck Selection</CardTitle>
                  <CardDescription>
                    {selectedDeckCount > 0
                      ? `${selectedDeckCount} deck(s) selected • ${selectedDeckCards} cards`
                      : "No explicit selection: all eligible decks will be used."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={selectDueDecks}>Select Due</Button>
                    <Button variant="outline" size="sm" onClick={selectAllDecksWithCards}>Select All With Cards</Button>
                    <Button variant="ghost" size="sm" onClick={clearDeckSelection}>Clear</Button>
                  </div>

                  <div className="max-h-[280px] space-y-2 overflow-y-auto rounded-lg border p-2">
                    {masteryData
                      .filter((deck) => deck.card_count > 0)
                      .map((deck) => (
                        <label
                          key={deck.deck_id}
                          className="flex cursor-pointer items-center justify-between rounded-md border px-2 py-2 hover:bg-muted/40"
                        >
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedDeckIds.includes(deck.deck_id)}
                              onCheckedChange={(checked) => toggleDeckSelection(deck.deck_id, checked === true)}
                            />
                            <div>
                              <p className="text-sm font-medium">{deck.deck_name}</p>
                              <p className="text-xs text-muted-foreground">{deck.card_count} cards · {toReviewLevel(deck.current_interval)}</p>
                            </div>
                          </div>
                          {deck.isDue ? <Badge className="bg-amber-500/10 text-amber-700 border-none">Due</Badge> : null}
                        </label>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {state === "loading_cards" && (
        <div className="flex h-[60vh] flex-col items-center justify-center gap-6">
          <Loader2 className="h-16 w-16 animate-spin text-primary" />
          <h2 className="text-2xl font-bold">Building your simulation...</h2>
          <p className="text-muted-foreground">Balancing cards across selected decks.</p>
        </div>
      )}

      {state === "studying" && cards.length > 0 && (
        <div className="mx-auto max-w-5xl animate-in slide-in-from-bottom-8 py-4 duration-500">
          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            <div>
              <div className="mb-8 space-y-4">
                <div className="flex items-center justify-between text-sm font-medium">
                  <Badge variant="outline" className="rounded-full border-primary/30 bg-primary/5 px-3 py-1 text-primary">
                    Deck: {cards[currentIndex].deck_name}
                  </Badge>
                  <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
                    {currentIndex + 1} / {cards.length}
                  </span>
                </div>
                <Progress value={(currentIndex / cards.length) * 100} className="h-2 rounded-full" />
              </div>

              <div className="h-[380px] w-full cursor-pointer" onClick={() => !isFlipped && setIsFlipped(true)}>
                {!isFlipped ? (
                  <Card className="flex h-full flex-col items-center justify-center border-primary/20 p-8 shadow-xl transition-colors hover:border-primary/50">
                    <p className="text-center text-3xl font-medium leading-relaxed">{cards[currentIndex].front}</p>
                    <p className="absolute bottom-8 text-sm text-muted-foreground">Click to reveal answer</p>
                  </Card>
                ) : (
                  <Card className="flex h-full flex-col items-center justify-center border-primary/20 p-8 shadow-xl animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex w-full flex-1 flex-col items-center justify-center">
                      <p className="mb-6 w-full max-w-lg border-b pb-6 text-center text-xl text-muted-foreground">{cards[currentIndex].front}</p>
                      <p className="text-center text-3xl font-bold leading-relaxed text-primary">{cards[currentIndex].back}</p>
                    </div>
                  </Card>
                )}
              </div>

              <div className={`mt-8 grid grid-cols-4 gap-3 transition-opacity duration-300 ${isFlipped ? "opacity-100" : "pointer-events-none opacity-0"}`}>
                <Button variant="outline" className="h-16 flex-col gap-1 border-red-200 hover:bg-red-50 hover:text-red-600" onClick={(e) => { e.stopPropagation(); handleRate(1); }}>
                  <X className="h-5 w-5" />
                  <span className="font-semibold">Again</span>
                </Button>
                <Button variant="outline" className="h-16 flex-col gap-1 border-orange-200 hover:bg-orange-50 hover:text-orange-600" onClick={(e) => { e.stopPropagation(); handleRate(2); }}>
                  <Target className="h-5 w-5" />
                  <span className="font-semibold">Hard</span>
                </Button>
                <Button variant="outline" className="h-16 flex-col gap-1 border-green-200 hover:bg-green-50 hover:text-green-600" onClick={(e) => { e.stopPropagation(); handleRate(3); }}>
                  <Check className="h-5 w-5" />
                  <span className="font-semibold">Good</span>
                </Button>
                <Button variant="outline" className="h-16 flex-col gap-1 border-blue-200 hover:bg-blue-50 hover:text-blue-600" onClick={(e) => { e.stopPropagation(); handleRate(4); }}>
                  <BookOpenCheck className="h-5 w-5" />
                  <span className="font-semibold">Easy</span>
                </Button>
              </div>
            </div>

            {showLivePanel ? (
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle className="text-lg">Live Session Data</CardTitle>
                  <CardDescription>
                    Progress updates instantly while you answer cards.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Cards Reviewed</p>
                      <p className="text-2xl font-bold">{liveReviewedCards}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Current Accuracy</p>
                      <p className="text-2xl font-bold">{liveAccuracy}%</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">Pass Target</p>
                      <p className="text-2xl font-bold">{EXPANSION_PASS_THRESHOLD}%</p>
                    </div>
                  </div>

                  {liveDeckRows.length === 0 ? (
                    <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      Rate at least one card to see per-deck projections.
                    </p>
                  ) : (
                    <div className="max-h-[300px] overflow-y-auto rounded-lg border">
                      <Table>
                        <TableHeader className="bg-muted/50">
                          <TableRow>
                            <TableHead>Deck</TableHead>
                            <TableHead>Accuracy</TableHead>
                            <TableHead>Projection</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {liveDeckRows.map((row) => (
                            <TableRow key={row.deckId}>
                              <TableCell className="font-medium">{row.name}</TableCell>
                              <TableCell>{row.accuracy}%</TableCell>
                              <TableCell className="font-mono">
                                {toReviewLevel(row.previousInterval)} {String.fromCharCode(8594)} {toReviewLevel(row.projectedInterval)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      )}

      {state === "results" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8">
          <div className="space-y-3 py-6 text-center">
            <div className="mb-2 inline-flex rounded-full bg-primary/10 p-4">
              {savingResults ? <Loader2 className="h-12 w-12 animate-spin text-primary" /> : <Check className="h-12 w-12 text-primary" />}
            </div>
            <h1 className="text-4xl font-black">Simulation completed</h1>
            <p className="text-lg text-muted-foreground">
              {savingResults ? "Saving Expansion Cycle updates..." : "Your R-level transitions are ready."}
            </p>
          </div>

          <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
            {Object.entries(sessionResults).map(([deckId, result]) => {
              if (result.total === 0) {
                return null;
              }

              const percentage = Math.round((result.score / result.total) * 100);
              const passed = percentage >= EXPANSION_PASS_THRESHOLD;
              const outcome = outcomeByDeck[deckId];

              return (
                <Card key={deckId} className={`overflow-hidden border-2 ${passed ? "border-green-500/20" : "border-red-500/20"}`}>
                  <div className={`p-4 ${passed ? "bg-green-50 dark:bg-green-950/20" : "bg-red-50 dark:bg-red-950/20"}`}>
                    <h3 className="mb-2 truncate text-lg font-bold">{result.name}</h3>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-3xl font-black">
                          {percentage}% <span className="text-base font-normal text-muted-foreground">accuracy</span>
                        </p>
                        <p className="text-sm text-muted-foreground">{result.score}/{result.total} cards rated Good/Easy</p>
                      </div>
                      <Badge className={passed ? "bg-green-600 text-white" : "bg-red-600 text-white"}>
                        {passed ? "Pass" : "Fail"}
                      </Badge>
                    </div>

                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-foreground">
                        <span className="font-semibold">Transition:</span>
                        <span className="font-mono">{toReviewLevel(outcome?.previousInterval ?? result.previousInterval)}</span>
                        <ChevronsRight className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono">{toReviewLevel(outcome?.newInterval ?? (passed ? result.previousInterval * 2 || EXPANSION_INITIAL_INTERVAL : EXPANSION_HAND_BRAKE_INTERVAL))}</span>
                      </div>
                      <p className="text-muted-foreground">
                        Status: {outcome?.previousStatus ?? result.previousStatus} {String.fromCharCode(8594)} {outcome?.newStatus ?? (passed ? "Reviewing" : "Needs Focus")}
                      </p>
                      {outcome?.nextReviewDate ? (
                        <p className="text-muted-foreground">Next review: {format(new Date(outcome.nextReviewDate), "MMM dd, yyyy")}</p>
                      ) : (
                        <p className="text-muted-foreground">Next review date will sync after save.</p>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="flex justify-center pt-8">
            <Button size="lg" disabled={savingResults} onClick={() => setState("hub")} className="h-14 rounded-xl px-10 text-lg">
              {savingResults ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <RotateCcw className="mr-2 h-5 w-5" />}
              Back to simulator hub
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
