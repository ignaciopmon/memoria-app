"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import {
  EXPANSION_HAND_BRAKE_INTERVAL,
  EXPANSION_INITIAL_INTERVAL,
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
import {
  AlertTriangle,
  BookOpenCheck,
  Check,
  ChevronsRight,
  Infinity as InfinityIcon,
  Layers,
  Loader2,
  Play,
  RotateCcw,
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
type SimulationMode = "due" | "all" | "single";

const MIN_CARDS_PER_DECK = 2;
const MAX_CARDS_PER_DECK = 8;
const SESSION_CARD_CAP = 48;

const shuffleArray = <T,>(items: T[]): T[] => {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const buildBalancedCards = (deckIds: string[], cardsByDeck: Record<string, Flashcard[]>) => {
  const selected: Flashcard[] = [];
  const usedByDeck = new Map<string, number>();
  const queue = shuffleArray(deckIds);

  for (const deckId of queue) {
    cardsByDeck[deckId] = shuffleArray(cardsByDeck[deckId] || []);
    usedByDeck.set(deckId, 0);
  }

  for (const deckId of queue) {
    const deckCards = cardsByDeck[deckId] || [];
    const seedCount = Math.min(deckCards.length, MIN_CARDS_PER_DECK);
    for (let i = 0; i < seedCount && selected.length < SESSION_CARD_CAP; i += 1) {
      selected.push(deckCards[i]);
      usedByDeck.set(deckId, i + 1);
    }
  }

  let added = true;
  while (selected.length < SESSION_CARD_CAP && added) {
    added = false;
    for (const deckId of queue) {
      const deckCards = cardsByDeck[deckId] || [];
      const used = usedByDeck.get(deckId) ?? 0;
      if (used >= deckCards.length || used >= MAX_CARDS_PER_DECK) {
        continue;
      }
      selected.push(deckCards[used]);
      usedByDeck.set(deckId, used + 1);
      added = true;
      if (selected.length >= SESSION_CARD_CAP) {
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

export default function SimulationsPage() {
  const [state, setState] = useState<AppState>("hub");
  const [masteryData, setMasteryData] = useState<DeckMastery[]>([]);
  const [loading, setLoading] = useState(true);

  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionResults, setSessionResults] = useState<Record<string, DeckSessionResult>>({});
  const [savingResults, setSavingResults] = useState(false);
  const [outcomes, setOutcomes] = useState<DeckOutcome[]>([]);

  const supabase = createClient();
  const { toast } = useToast();

  useEffect(() => {
    fetchHubData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const outcomeByDeck = useMemo(() => {
    return outcomes.reduce((acc, item) => {
      acc[item.deckId] = item;
      return acc;
    }, {} as Record<string, DeckOutcome>);
  }, [outcomes]);

  const dueDecksCount = masteryData.filter((d) => d.isDue).length;
  const focusDecksCount = masteryData.filter((d) => d.status === "Needs Focus").length;
  const masteredDecksCount = masteryData.filter((d) => d.status === "Mastered").length;
  const totalCards = masteryData.reduce((sum, d) => sum + d.card_count, 0);

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

  const startSimulation = async (mode: SimulationMode, deckId?: string) => {
    setState("loading_cards");

    const candidates = masteryData.filter((deck) => {
      if (mode === "single") {
        return deck.deck_id === deckId;
      }
      if (mode === "all") {
        return deck.card_count > 0;
      }
      return deck.isDue;
    });

    if (candidates.length === 0) {
      toast({
        title: "No eligible decks",
        description: mode === "due" ? "There are no due decks right now." : "Add cards to your decks to start a simulation.",
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
        <div className="space-y-8 animate-in fade-in duration-500">
          <Card className="overflow-hidden border-primary/20">
            <CardContent className="flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-2">
                <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
                  <InfinityIcon className="h-8 w-8 text-primary" />
                  Expansion Cycle Simulator
                </h1>
                <p className="max-w-2xl text-muted-foreground">
                  Train with mixed cards across decks and move through review levels like {toReviewLevel(EXPANSION_INITIAL_INTERVAL)} and {toReviewLevel(60)}.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button size="lg" className="gap-2" onClick={() => startSimulation("due")}>
                  <Play className="h-5 w-5 fill-current" />
                  Run Due Decks
                </Button>
                <Button size="lg" variant="outline" className="gap-2" onClick={() => startSimulation("all")}>
                  <Layers className="h-5 w-5" />
                  Run All Decks
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Due Decks</CardDescription>
                <CardTitle>{dueDecksCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Needs Focus</CardDescription>
                <CardTitle>{focusDecksCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Mastered</CardDescription>
                <CardTitle>{masteredDecksCount}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total Cards</CardDescription>
                <CardTitle>{totalCards}</CardTitle>
              </CardHeader>
            </Card>
          </div>

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
              <CardDescription>Run per-deck simulation anytime, even if it is not due.</CardDescription>
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
                      <TableHead>Next Review</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {masteryData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-8 text-center">
                          No decks available yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      masteryData.map((deck) => (
                        <TableRow key={deck.deck_id} className={deck.status === "Needs Focus" ? "bg-red-500/5 dark:bg-red-900/10" : ""}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Layers className="h-4 w-4 text-muted-foreground" />
                              {deck.deck_name}
                            </div>
                          </TableCell>
                          <TableCell>{deck.card_count}</TableCell>
                          <TableCell>{statusBadge(deck.status)}</TableCell>
                          <TableCell className="font-mono font-bold text-primary">{toReviewLevel(deck.current_interval)}</TableCell>
                          <TableCell>{deck.last_score > 0 ? `${deck.last_score}%` : "--"}</TableCell>
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
                              onClick={() => startSimulation("single", deck.deck_id)}
                            >
                              Run Deck
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
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
        <div className="mx-auto max-w-3xl animate-in slide-in-from-bottom-8 py-4 duration-500">
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
