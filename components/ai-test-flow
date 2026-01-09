"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, CheckCircle, XCircle, FileText, AlertTriangle, Save, ArrowRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";

type Step = "setup" | "generating" | "testing" | "results";

interface Question {
  question: string;
  options: string[];
  correctAnswer: string;
}

interface WrongAnswer extends Question {
  userAnswer: string;
}

export function AITestFlow({ userDecks }: { userDecks: { id: string, name: string }[] }) {
  const [step, setStep] = useState<Step>("setup");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [score, setScore] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([]);
  
  // Setup Form States
  const [sourceType, setSourceType] = useState<"topic" | "pdf">("topic");
  const [topic, setTopic] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [count, setCount] = useState("5");
  const [difficulty, setDifficulty] = useState("medium");
  const [language, setLanguage] = useState("English");

  // Analysis States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisReport, setAnalysisReport] = useState<string | null>(null);

  // Saving States
  const [saveMode, setSaveMode] = useState<"none" | "existing" | "new">("none");
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [newDeckName, setNewDeckName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { toast } = useToast();
  const router = useRouter();

  // --- ACTIONS ---

  const handleGenerate = async () => {
    if (sourceType === "topic" && !topic) return toast({title: "Topic required", variant: "destructive"});
    if (sourceType === "pdf" && !pdfFile) return toast({title: "PDF required", variant: "destructive"});

    setStep("generating");
    const formData = new FormData();
    formData.append("questionCount", count);
    formData.append("difficulty", difficulty);
    formData.append("language", language);
    if (sourceType === "topic") formData.append("topic", topic);
    if (sourceType === "pdf" && pdfFile) formData.append("pdfFile", pdfFile);

    try {
      const res = await fetch("/api/generate-quiz", { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setQuestions(data);
      setStep("testing");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setStep("setup");
    }
  };

  const handleAnswer = (answer: string) => {
    const newAnswers = [...userAnswers];
    newAnswers[currentQIndex] = answer;
    setUserAnswers(newAnswers);
  };

  const handleNext = () => {
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex(prev => prev + 1);
    } else {
      finishTest();
    }
  };

  const finishTest = () => {
    let correctCount = 0;
    const wrongs: WrongAnswer[] = [];

    questions.forEach((q, idx) => {
      if (userAnswers[idx] === q.correctAnswer) {
        correctCount++;
      } else {
        wrongs.push({ ...q, userAnswer: userAnswers[idx] });
      }
    });

    setScore(correctCount);
    setWrongAnswers(wrongs);
    setStep("results");
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-quiz", {
        method: "POST",
        body: JSON.stringify({ wrongQuestions: wrongAnswers, language }),
        headers: { "Content-Type": "application/json" }
      });
      const data = await res.json();
      setAnalysisReport(data.report);
    } catch (e) {
      toast({ title: "Analysis Failed", variant: "destructive" });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveToDeck = async () => {
    if (saveMode === "existing" && !selectedDeckId) return toast({ title: "Select a deck", variant: "destructive" });
    if (saveMode === "new" && !newDeckName) return toast({ title: "Enter deck name", variant: "destructive" });

    setIsSaving(true);
    try {
      const res = await fetch("/api/save-quiz-cards", {
        method: "POST",
        body: JSON.stringify({ 
            deckId: saveMode === "existing" ? selectedDeckId : null,
            newDeckName: saveMode === "new" ? newDeckName : null,
            cards: wrongAnswers
        }),
        headers: { "Content-Type": "application/json" }
      });
      
      if (!res.ok) throw new Error("Failed to save");
      
      const data = await res.json();
      toast({ title: "Success", description: "Cards added to deck!" });
      router.push(`/deck/${data.deckId}`);
    } catch (e) {
      toast({ title: "Error saving cards", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // --- RENDERERS ---

  if (step === "setup") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Generate AI Test</CardTitle>
          <CardDescription>Create a custom practice exam from any topic or PDF.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Source Material</Label>
            <div className="flex gap-4">
                <Button variant={sourceType === "topic" ? "default" : "outline"} onClick={() => setSourceType("topic")} className="flex-1">
                    Topic
                </Button>
                <Button variant={sourceType === "pdf" ? "default" : "outline"} onClick={() => setSourceType("pdf")} className="flex-1">
                    PDF Upload
                </Button>
            </div>
          </div>

          {sourceType === "topic" ? (
             <div className="space-y-2">
                <Label>Topic Description</Label>
                <Textarea placeholder="e.g., Biology of the Cell, History of Rome..." value={topic} onChange={e => setTopic(e.target.value)} />
             </div>
          ) : (
            <div className="space-y-2">
                <Label>Upload PDF</Label>
                <Input type="file" accept=".pdf" onChange={e => setPdfFile(e.target.files?.[0] || null)} />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="space-y-2">
                <Label>Questions</Label>
                <Select value={count} onValueChange={setCount}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="5">5 Questions</SelectItem>
                        <SelectItem value="10">10 Questions</SelectItem>
                        <SelectItem value="20">20 Questions</SelectItem>
                    </SelectContent>
                </Select>
             </div>
             <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                </Select>
             </div>
             <div className="space-y-2">
                <Label>Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="English">English</SelectItem>
                        <SelectItem value="Spanish">Spanish</SelectItem>
                        <SelectItem value="Portuguese">Portuguese</SelectItem>
                    </SelectContent>
                </Select>
             </div>
          </div>
        </CardContent>
        <CardFooter>
            <Button className="w-full" size="lg" onClick={handleGenerate}>
                Generate Test
            </Button>
        </CardFooter>
      </Card>
    );
  }

  if (step === "generating") {
    return (
        <div className="flex flex-col items-center justify-center h-[50vh] gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <h2 className="text-xl font-semibold">Generating your test...</h2>
            <p className="text-muted-foreground">The AI is crafting questions based on your material.</p>
        </div>
    );
  }

  if (step === "testing") {
    const q = questions[currentQIndex];
    const progress = ((currentQIndex) / questions.length) * 100;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Question {currentQIndex + 1} of {questions.length}</span>
                <span>{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="h-2" />
            
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl leading-relaxed">{q.question}</CardTitle>
                </CardHeader>
                <CardContent>
                    <RadioGroup onValueChange={handleAnswer} value={userAnswers[currentQIndex]}>
                        {q.options.map((opt, i) => (
                            <div key={i} className="flex items-center space-x-2 border p-4 rounded-lg hover:bg-muted/50 transition-colors">
                                <RadioGroupItem value={opt} id={`opt-${i}`} />
                                <Label htmlFor={`opt-${i}`} className="flex-1 cursor-pointer font-normal text-base">{opt}</Label>
                            </div>
                        ))}
                    </RadioGroup>
                </CardContent>
                <CardFooter className="justify-end">
                    <Button onClick={handleNext} disabled={!userAnswers[currentQIndex]}>
                        {currentQIndex === questions.length - 1 ? "Finish Test" : "Next Question"}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
  }

  if (step === "results") {
    const percentage = Math.round((score / questions.length) * 100);
    
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* SCORE CARD */}
            <Card className="text-center border-2 border-primary/10 bg-primary/5">
                <CardContent className="pt-6">
                    <h2 className="text-3xl font-bold mb-2">Test Complete!</h2>
                    <div className="text-5xl font-extrabold text-primary mb-2">{percentage}%</div>
                    <p className="text-muted-foreground">You got {score} out of {questions.length} correct.</p>
                </CardContent>
            </Card>

            {/* WRONG ANSWERS ACTION */}
            {wrongAnswers.length > 0 && (
                <div className="grid gap-6">
                    <div className="flex flex-col md:flex-row gap-4">
                         {/* ANALYSIS BUTTON */}
                        <Card className="flex-1 border-dashed">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-blue-500" /> AI Analysis
                                </CardTitle>
                                <CardDescription>Get a personalized report on your mistakes.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {!analysisReport ? (
                                    <Button onClick={handleAnalyze} disabled={isAnalyzing} className="w-full">
                                        {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Generate Report"}
                                    </Button>
                                ) : (
                                    <div className="prose prose-sm dark:prose-invert max-w-none bg-muted/30 p-4 rounded-md">
                                        <ReactMarkdown>{analysisReport}</ReactMarkdown>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* SAVE TO DECK BUTTON */}
                        <Card className="flex-1 border-dashed">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Save className="h-5 w-5 text-green-500" /> Save Mistakes
                                </CardTitle>
                                <CardDescription>Convert {wrongAnswers.length} wrong answers into flashcards.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Select value={saveMode} onValueChange={(v: any) => setSaveMode(v)}>
                                    <SelectTrigger><SelectValue placeholder="Choose action..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Don't save</SelectItem>
                                        <SelectItem value="existing">Add to existing deck</SelectItem>
                                        <SelectItem value="new">Create new deck</SelectItem>
                                    </SelectContent>
                                </Select>

                                {saveMode === "existing" && (
                                    <Select value={selectedDeckId} onValueChange={setSelectedDeckId}>
                                        <SelectTrigger><SelectValue placeholder="Select Deck" /></SelectTrigger>
                                        <SelectContent>
                                            {userDecks.map(deck => (
                                                <SelectItem key={deck.id} value={deck.id}>{deck.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}

                                {saveMode === "new" && (
                                    <Input placeholder="New Deck Name" value={newDeckName} onChange={e => setNewDeckName(e.target.value)} />
                                )}

                                {saveMode !== "none" && (
                                    <Button onClick={handleSaveToDeck} disabled={isSaving} className="w-full" variant="secondary">
                                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Save Cards"}
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* LIST OF ERRORS */}
                    <div className="space-y-4">
                        <h3 className="text-xl font-bold flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-500" /> Mistakes Review
                        </h3>
                        {wrongAnswers.map((w, i) => (
                            <Card key={i} className="border-l-4 border-l-destructive">
                                <CardContent className="pt-4">
                                    <p className="font-semibold text-lg mb-3">{w.question}</p>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        <div className="flex items-center gap-2 text-destructive">
                                            <XCircle className="h-4 w-4" />
                                            <span className="font-bold">Your Answer:</span> {w.userAnswer}
                                        </div>
                                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                                            <CheckCircle className="h-4 w-4" />
                                            <span className="font-bold">Correct Answer:</span> {w.correctAnswer}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            )}
            
            <div className="flex justify-center pt-8">
                 <Button variant="outline" onClick={() => window.location.reload()}>Take Another Test</Button>
            </div>
        </div>
    );
  }

  return null; 
}