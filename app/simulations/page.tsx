"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, isPast } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BrainCircuit, Info, AlertTriangle, ArrowRight, Loader2, CheckCircle, XCircle, Save, Infinity as InfinityIcon } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

interface TopicMastery {
  id: string;
  topic: string;
  current_interval: number;
  status: 'Learning' | 'Reviewing' | 'Mastered' | 'Needs Focus';
  last_score: number;
  last_reviewed_at: string;
  next_review_date: string;
}

interface Question {
  topic: string;
  question: string;
  options: string[];
  correctAnswer: string;
}

type AppState = "hub" | "generating" | "testing" | "results";

export default function SimulationsPage() {
  const [state, setState] = useState<AppState>("hub");
  const [topics, setTopics] = useState<TopicMastery[]>([]);
  const [userDecks, setUserDecks] = useState<{id: string, name: string}[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Test State
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [resultsByTopic, setResultsByTopic] = useState<any>({});
  
  // Save Cards State
  const [selectedDeckId, setSelectedDeckId] = useState("");
  const [isSavingCards, setIsSavingCards] = useState(false);

  const supabase = createClient();
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch Mastery
    const { data: masteryData } = await supabase
      .from('topic_mastery')
      .select('*')
      .order('next_review_date', { ascending: true });
    
    // Fetch Decks for saving cards
    const { data: decksData } = await supabase
      .from('decks')
      .select('id, name')
      .is('deleted_at', null)
      .eq('is_folder', false);

    if (masteryData) setTopics(masteryData as TopicMastery[]);
    if (decksData) setUserDecks(decksData);
    setLoading(false);
  };

  const startInfiniteSimulation = async () => {
    // Escoge temas que tocan repaso o necesitan foco
    const dueTopics = topics
      .filter(t => isPast(new Date(t.next_review_date)) || t.status === 'Needs Focus')
      .map(t => t.topic);

    if (dueTopics.length === 0) {
      toast({ title: "You are all caught up!", description: "No topics are due for review right now." });
      return;
    }

    setState("generating");
    
    try {
      const response = await fetch('/api/generate-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics: dueTopics.slice(0, 5), questionCount: 15, language: "English" })
      });

      if (!response.ok) throw new Error();
      const data = await response.json();
      setQuestions(data);
      setUserAnswers(new Array(data.length).fill(""));
      setCurrentQIndex(0);
      setState("testing");
    } catch (e) {
      toast({ variant: "destructive", title: "Failed to generate simulation" });
      setState("hub");
    }
  };

  const handleAnswer = (answer: string) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQIndex] = answer;
    setUserAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQIndex < questions.length - 1) setCurrentQIndex(prev => prev + 1);
    else finishTest();
  };

  const finishTest = async () => {
    // 1. Calculate Results grouped by Topic
    const stats: any = {};
    questions.forEach((q, idx) => {
        if (!stats[q.topic]) stats[q.topic] = { score: 0, total: 0, mistakes: [] };
        stats[q.topic].total += 1;
        if (userAnswers[idx] === q.correctAnswer) {
            stats[q.topic].score += 1;
        } else {
            stats[q.topic].mistakes.push({ ...q, userAnswer: userAnswers[idx] });
        }
    });
    setResultsByTopic(stats);
    setState("results");

    // 2. Update Database SRS (Double Rule / Handbrake)
    try {
        await fetch('/api/save-simulation-results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resultsByTopic: stats })
        });
        fetchData(); // Recargar la tabla por detrás
    } catch (e) {
        console.error("Failed to update mastery");
    }
  };

  const handleSaveMistakesToDeck = async () => {
    if (!selectedDeckId) return toast({ variant: "destructive", title: "Select a deck first" });
    setIsSavingCards(true);

    // Recolectar todos los errores de todos los temas
    const allMistakes: any[] = [];
    Object.values(resultsByTopic).forEach((topicData: any) => {
        allMistakes.push(...topicData.mistakes);
    });

    try {
      await fetch("/api/save-quiz-cards", {
        method: "POST",
        body: JSON.stringify({ deckId: selectedDeckId, cards: allMistakes }),
        headers: { "Content-Type": "application/json" }
      });
      toast({ title: "Flashcards Created!", description: "Your mistakes are now in your deck." });
    } catch (e) {
      toast({ variant: "destructive", title: "Error saving cards" });
    } finally {
      setIsSavingCards(false);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;

  return (
    <div className="container max-w-5xl py-8">
      {/* --- 1. THE HUB --- */}
      {state === "hub" && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                Infinite Simulations <InfinityIcon className="text-primary w-8 h-8"/>
              </h1>
              <p className="text-muted-foreground mt-1">Master topics through the Expansion Cycle.</p>
            </div>
            
            <Button onClick={startInfiniteSimulation} disabled={topics.length === 0} size="lg" className="gap-2 rounded-xl h-12 px-6 shadow-lg hover:scale-105 transition-transform">
              <BrainCircuit className="w-5 h-5" />
              Start Mixed Simulation
            </Button>
          </div>

          <TooltipProvider>
            <div className="grid md:grid-cols-2 gap-4">
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            The Expansion Cycle
                            <Tooltip>
                                <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors cursor-help" /></TooltipTrigger>
                                <TooltipContent className="max-w-sm text-sm"><p>When you score 80% or higher on a topic, its next review interval doubles (e.g., from 30 days to 60 days). The goal is to reach R120 (Mastered).</p></TooltipContent>
                            </Tooltip>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                        Succeed to push topics further into the future: <strong className="text-primary">R30 ➔ R60 ➔ R120</strong>
                    </CardContent>
                </Card>
                <Card className="bg-destructive/5 border-destructive/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2 text-destructive">
                            The Handbrake
                            <Tooltip>
                                <TooltipTrigger><AlertTriangle className="h-4 w-4 text-destructive/70 hover:text-destructive cursor-help" /></TooltipTrigger>
                                <TooltipContent className="max-w-sm text-sm"><p>If you score below 80%, the system hits the brakes. The topic is marked as "Needs Focus" and scheduled for review in just 3 days.</p></TooltipContent>
                            </Tooltip>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-destructive/80">
                        Fail a topic and it drops to: <strong className="text-destructive">R3 (Needs Focus)</strong>
                    </CardContent>
                </Card>
            </div>
          </TooltipProvider>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle>Topic Mastery Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Topic</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Current Level</TableHead>
                      <TableHead>Last Score</TableHead>
                      <TableHead>Next Review</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topics.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Take standard AI tests to start tracking topic mastery!</TableCell></TableRow>
                    ) : (
                      topics.map((t) => {
                        const isDue = isPast(new Date(t.next_review_date));
                        return (
                        <TableRow key={t.id} className={t.status === 'Needs Focus' ? 'bg-red-50/50 dark:bg-red-950/10' : ''}>
                          <TableCell className="font-medium">{t.topic}</TableCell>
                          <TableCell>
                            {t.status === 'Mastered' && <Badge className="bg-green-500/10 text-green-600 border-green-200">Mastered</Badge>}
                            {t.status === 'Reviewing' && <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">Reviewing</Badge>}
                            {t.status === 'Needs Focus' && <Badge variant="destructive" className="animate-pulse">Needs Focus</Badge>}
                            {t.status === 'Learning' && <Badge variant="outline">Learning</Badge>}
                          </TableCell>
                          <TableCell className="font-mono font-semibold">R{t.current_interval}</TableCell>
                          <TableCell>{t.last_score}%</TableCell>
                          <TableCell>
                            {isDue || t.status === 'Needs Focus' ? (
                                <span className="text-orange-500 font-medium text-sm flex items-center gap-1"><AlertTriangle className="h-3 w-3"/> Due Now</span>
                            ) : (
                                <span className="text-muted-foreground text-sm">{format(new Date(t.next_review_date), 'MMM dd')}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )})
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* --- 2. GENERATING --- */}
      {state === "generating" && (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-6">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <h2 className="text-2xl font-bold">Mixing Topics...</h2>
            <p className="text-muted-foreground">Preparing an infinite simulation based on your due topics.</p>
        </div>
      )}

      {/* --- 3. TESTING --- */}
      {state === "testing" && (
        <div className="max-w-2xl mx-auto py-8 animate-in slide-in-from-right-8 duration-500">
            <div className="mb-6 space-y-4">
                <div className="flex justify-between items-center text-sm">
                    <Badge variant="outline" className="text-primary border-primary bg-primary/5">{questions[currentQIndex].topic}</Badge>
                    <span className="text-muted-foreground font-medium">Q {currentQIndex + 1} of {questions.length}</span>
                </div>
                <Progress value={(currentQIndex / questions.length) * 100} className="h-2" />
            </div>
            
            <Card key={currentQIndex} className="shadow-lg border-primary/10">
                <CardHeader>
                    <CardTitle className="text-xl leading-relaxed">{questions[currentQIndex].question}</CardTitle>
                </CardHeader>
                <CardContent>
                    <RadioGroup onValueChange={handleAnswer} value={userAnswers[currentQIndex]} className="gap-3">
                        {questions[currentQIndex].options.map((opt, i) => (
                            <div key={i} onClick={() => handleAnswer(opt)} className={`flex items-center space-x-3 border-2 p-4 rounded-xl cursor-pointer transition-all ${userAnswers[currentQIndex] === opt ? 'border-primary bg-primary/5' : 'hover:bg-muted/50 border-transparent bg-muted/20'}`}>
                                <RadioGroupItem value={opt} id={`opt-${i}`} />
                                <Label htmlFor={`opt-${i}`} className="cursor-pointer flex-1 text-base">{opt}</Label>
                            </div>
                        ))}
                    </RadioGroup>
                </CardContent>
                <CardFooter className="justify-end pt-4 border-t mt-4 bg-muted/10 rounded-b-xl">
                    <Button onClick={handleNext} disabled={!userAnswers[currentQIndex]} size="lg">
                        {currentQIndex === questions.length - 1 ? "Complete Simulation" : "Next"}
                    </Button>
                </CardFooter>
            </Card>
        </div>
      )}

      {/* --- 4. RESULTS --- */}
      {state === "results" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8">
            <div className="text-center space-y-2">
                <h1 className="text-4xl font-bold">Simulation Results</h1>
                <p className="text-muted-foreground">See how the Expansion Cycle affected your topics.</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* Topic Breakdown */}
                <div className="space-y-4">
                    <h3 className="text-xl font-semibold flex items-center gap-2"><BrainCircuit className="h-5 w-5 text-primary"/> Topic Breakdown</h3>
                    {Object.entries(resultsByTopic).map(([topic, data]: [string, any]) => {
                        const perc = Math.round((data.score / data.total) * 100);
                        const isSuccess = perc >= 80;
                        return (
                            <Card key={topic} className={isSuccess ? "border-green-200 bg-green-50/30 dark:bg-green-950/10" : "border-red-200 bg-red-50/30 dark:bg-red-950/10"}>
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold">{topic}</p>
                                        <div className="flex items-center gap-2 mt-1 text-sm">
                                            <span className="font-bold">{perc}%</span>
                                            <span className="text-muted-foreground">({data.score}/{data.total})</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {isSuccess ? (
                                            <Badge className="bg-green-500 text-white">Rule of Double Applied</Badge>
                                        ) : (
                                            <Badge variant="destructive">Handbrake Applied (R3)</Badge>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>

                {/* Save Mistakes to Flashcards */}
                <Card className="border-blue-200 shadow-md h-fit sticky top-24">
                    <CardHeader className="bg-blue-50/50 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900 pb-4">
                        <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-300">
                            <Save className="h-5 w-5" /> Convert Mistakes to Flashcards
                        </CardTitle>
                        <CardDescription>Don't lose this knowledge. Add the questions you failed to a deck to study them later.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        {Object.values(resultsByTopic).some((d:any) => d.mistakes.length > 0) ? (
                            <>
                                <Select value={selectedDeckId} onValueChange={setSelectedDeckId}>
                                    <SelectTrigger className="h-12 rounded-xl"><SelectValue placeholder="Select Destination Deck" /></SelectTrigger>
                                    <SelectContent>
                                        {userDecks.map(deck => <SelectItem key={deck.id} value={deck.id}>{deck.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <Button onClick={handleSaveMistakesToDeck} disabled={isSavingCards || !selectedDeckId} className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
                                    {isSavingCards ? <Loader2 className="animate-spin mr-2 h-4 w-4"/> : "Save All Mistakes as Cards"}
                                </Button>
                            </>
                        ) : (
                            <div className="text-center py-6 text-green-600 flex flex-col items-center gap-2">
                                <CheckCircle className="h-8 w-8" />
                                <p className="font-medium">Perfect score! No mistakes to save.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="flex justify-center pt-8 border-t">
                <Button variant="outline" size="lg" onClick={() => setState("hub")} className="rounded-xl px-8">
                    Return to Hub
                </Button>
            </div>
        </div>
      )}
    </div>
  );
}