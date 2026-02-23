"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Sparkles, Loader2, CheckCircle, XCircle, Bot } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "./ui/card"
import { createClient } from "@/lib/supabase/client" // <-- CORREGIDO: Se eliminó SupabaseClient
import { Textarea } from "./ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { useToast } from "./ui/use-toast"
import { useRouter } from "next/navigation"

type CardData = {
  id: string;
  front: string;
  back: string;
  last_rating: number | null;
};

interface AITestDialogProps {
  deckId: string;
  deckName: string;
  children: React.ReactNode;
}

type TestQuestion = {
  question: string;
  options: { [key: string]: string };
  answer: string;
  sourceCardFront: string;
};

interface UserSettings {
  enable_ai_suggestions?: boolean;
}

type CardSource = "all" | "new" | "again" | "hard" | "good" | "easy";

export function AITestDialog({ deckId, deckName, children }: AITestDialogProps) {
  const [open, setOpen] = useState(false);
  const [testState, setTestState] = useState<'options' | 'loading' | 'taking_test' | 'results'>('options');
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<(string | null)[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState("Spanish");
  const [context, setContext] = useState("");
  const [questionCount, setQuestionCount] = useState("10");
  const [cardSource, setCardSource] = useState<CardSource>("all"); 
  const [userSettings, setUserSettings] = useState<UserSettings>({ enable_ai_suggestions: true });
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (open) {
      const fetchUserSettings = async () => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: settings } = await supabase
            .from('user_settings')
            .select('enable_ai_suggestions')
            .eq('user_id', user.id)
            .single();
          if (settings) {
            setUserSettings(settings);
          }
        }
      };
      fetchUserSettings();
    }
  }, [open]);

  const handleGenerateTest = async () => {
    setTestState('loading');
    setError(null);
    try {
      const supabase = createClient();
      
      let query = supabase
        .from('cards')
        .select('id, front, back, last_rating')
        .eq('deck_id', deckId)
        .is('deleted_at', null);

      switch (cardSource) {
        case "new":
          query = query.eq('repetitions', 0);
          break;
        case "again":
          query = query.eq('last_rating', 1);
          break;
        case "hard":
          query = query.eq('last_rating', 2);
          break;
        case "good":
          query = query.eq('last_rating', 3);
          break;
        case "easy":
          query = query.eq('last_rating', 4);
          break;
      }

      const { data: cards, error: cardsError } = await query;

      if (cardsError) throw new Error("Could not fetch cards for the test.");
      if (!cards || cards.length === 0) {
        const sourceName = {
          "all": "en este mazo", "new": "nuevas", "again": "marcadas como 'Again'",
          "hard": "marcadas como 'Hard'", "good": "marcadas como 'Good'", "easy": "marcadas como 'Easy'"
        }[cardSource];
        throw new Error(`No se encontraron tarjetas ${sourceName} para generar un test.`);
      }

      const response = await fetch('/api/generate-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cards, language, context, questionCount: parseInt(questionCount) }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate the test from the server.');
      }

      const testData: TestQuestion[] = await response.json();
      setQuestions(testData);
      setUserAnswers(new Array(testData.length).fill(null));
      setCurrentQuestionIndex(0);
      setTestState('taking_test');
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
      setTestState('options');
    }
  };
  
  useEffect(() => {
    if (testState === 'results' && userSettings.enable_ai_suggestions) {
      const processResults = async () => {
        const results = questions.map((q, index) => ({
          question: q.question,
          userAnswer: userAnswers[index],
          correctAnswer: q.answer,
          sourceCardFront: q.sourceCardFront,
        }));

        try {
          await fetch('/api/process-test-results', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ results }),
          });
          toast({
            title: "AI Analysis Complete!",
            description: "Your study schedule has been updated based on your test results.",
          });
          router.refresh(); 
        } catch (error) {
          console.error("Failed to process test results with AI:", error);
           toast({
            variant: "destructive",
            title: "Update Failed",
            description: "Could not update card schedules after the test.",
          });
        }
      };
      processResults();
    }
  }, [testState, userSettings.enable_ai_suggestions, questions, userAnswers, toast, router]);

  const handleAnswerSelect = (answer: string) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQuestionIndex] = answer;
    setUserAnswers(newAnswers);
  };
  
  const goToNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      setTestState('results');
    }
  };

  const resetTest = () => {
    setTestState('options');
    setQuestions([]);
    setUserAnswers([]);
    setCurrentQuestionIndex(0);
    setError(null);
  };
  
  const score = userAnswers.reduce((correct, userAnswer, index) => {
    return userAnswer === questions[index]?.answer ? correct + 1 : correct;
  }, 0);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (!isOpen) resetTest(); }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI Generated Test: {deckName}
          </DialogTitle>
          <DialogDescription>
             Test your knowledge with a custom quiz generated by AI.
          </DialogDescription>
        </DialogHeader>

        {testState === 'options' && (
          <div className="py-4 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div>
                <Label htmlFor="language">Test Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="language" className="w-full mt-2">
                    <SelectValue placeholder="Select a language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Spanish">Spanish</SelectItem>
                    <SelectItem value="French">French</SelectItem>
                    <SelectItem value="German">German</SelectItem>
                    <SelectItem value="Portuguese">Portuguese</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="questionCount">Number of questions</Label>
                 <Select value={questionCount} onValueChange={setQuestionCount}>
                  <SelectTrigger id="questionCount" className="w-full mt-2">
                    <SelectValue placeholder="Select number" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="15">15</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

             <div>
              <Label htmlFor="cardSource">Generate test from</Label>
              <Select value={cardSource} onValueChange={(value) => setCardSource(value as CardSource)}>
                <SelectTrigger id="cardSource" className="w-full mt-2">
                  <SelectValue placeholder="Select card source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cards</SelectItem>
                  <SelectItem value="new">New Cards (never studied)</SelectItem>
                  <SelectItem value="again">Cards rated "Again"</SelectItem>
                  <SelectItem value="hard">Cards rated "Hard"</SelectItem>
                  <SelectItem value="good">Cards rated "Good"</SelectItem>
                  <SelectItem value="easy">Cards rated "Easy"</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="context">Optional Context</Label>
              <Textarea
                id="context"
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="E.g., 'This deck is about the main characters of the novel Don Quixote.'"
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Provide a brief description of the deck's topic to help the AI generate more accurate questions.
              </p>
            </div>

            {error && <p className="rounded-md bg-destructive/15 p-3 text-sm text-destructive">{error}</p>}

            <div className="flex justify-end">
               <Button onClick={handleGenerateTest}>Start Test</Button>
            </div>
          </div>
        )}

        {testState === 'loading' && (
           <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="mb-4 h-12 w-12 animate-spin text-purple-500" />
            <p className="text-muted-foreground">Generating your test, please wait...</p>
          </div>
        )}

        {testState === 'taking_test' && questions.length > 0 && (
          <div className="py-4">
            <p className="mb-4 text-sm text-muted-foreground">Question {currentQuestionIndex + 1} of {questions.length}</p>
            <Card>
              <CardContent className="p-6">
                <h4 className="mb-6 text-lg font-semibold">{questions[currentQuestionIndex].question}</h4>
                <RadioGroup value={userAnswers[currentQuestionIndex] || ''} onValueChange={handleAnswerSelect}>
                  {Object.entries(questions[currentQuestionIndex].options).map(([key, value]) => (
                    <div key={key} className="flex items-center space-x-3 rounded-md border p-3">
                      <RadioGroupItem value={key} id={`q${currentQuestionIndex}-opt${key}`} />
                      <Label htmlFor={`q${currentQuestionIndex}-opt${key}`} className="flex-1 cursor-pointer">{value}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>
            <div className="mt-6 flex justify-end">
              <Button onClick={goToNextQuestion} disabled={userAnswers[currentQuestionIndex] === null}>
                {currentQuestionIndex < questions.length - 1 ? "Next Question" : "Finish Test"}
              </Button>
            </div>
          </div>
        )}

         {testState === 'results' && (
          <div className="py-4 text-center">
            <h3 className="text-2xl font-bold">Test Complete!</h3>
            <p className="text-muted-foreground">You scored:</p>
            <p className="my-4 text-6xl font-bold text-purple-500">{score} <span className="text-3xl text-muted-foreground">/ {questions.length}</span></p>
             
            {userSettings.enable_ai_suggestions && (
              <div className="mt-6 mb-4 flex items-center justify-center gap-2 rounded-lg bg-purple-500/10 p-3 text-sm text-purple-800 dark:text-purple-300">
                <Bot className="h-5 w-5" />
                <p>The AI is updating your schedule based on these results...</p>
              </div>
            )}

             <div className="mt-8 space-y-4 max-h-60 overflow-y-auto pr-3 text-left">
                {questions.map((q, index) => (
                  <div key={index} className="rounded-md border p-3">
                    <p className="font-semibold">{index + 1}. {q.question}</p>
                    <div className="mt-2 text-sm">
                      {userAnswers[index] === q.answer ? (
                         <div className="flex items-center gap-2 text-green-600">
                           <CheckCircle className="h-4 w-4" />
                           <span>Your answer: {q.options[userAnswers[index]!]}</span>
                         </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 text-destructive">
                           <XCircle className="h-4 w-4" />
                           <span>Your answer: {userAnswers[index] ? q.options[userAnswers[index]!] : "No answer"}</span>
                         </div>
                          <div className="flex items-center gap-2 text-green-600 mt-1 pl-6">
                           <span>Correct: {q.options[q.answer]}</span>
                         </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
            </div>
            <div className="mt-8 flex justify-end gap-2">
              <Button variant="outline" onClick={resetTest}>Try Again</Button>
              <Button onClick={() => setOpen(false)}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}