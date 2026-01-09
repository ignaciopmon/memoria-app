"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, CheckCircle, XCircle, FileText, AlertTriangle, Save, Sparkles, Trophy } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { ScrollArea } from "@/components/ui/scroll-area"; // Asegúrate de tener este componente instalado

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
      <Card className="shadow-lg border-muted">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-4">
             <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Generate Practice Test</CardTitle>
          <CardDescription>Create a custom AI exam from any topic or PDF file.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-4">
          <div className="space-y-3">
            <Label className="text-base">Source Material</Label>
            <div className="flex gap-4">
                <Button 
                    variant={sourceType === "topic" ? "default" : "outline"} 
                    onClick={() => setSourceType("topic")} 
                    className="flex-1 h-12 text-base"
                >
                    Topic
                </Button>
                <Button 
                    variant={sourceType === "pdf" ? "default" : "outline"} 
                    onClick={() => setSourceType("pdf")} 
                    className="flex-1 h-12 text-base"
                >
                    PDF Upload
                </Button>
            </div>
          </div>

          {sourceType === "topic" ? (
             <div className="space-y-2">
                <Label>Topic Description</Label>
                <Textarea 
                    placeholder="e.g., Biology of the Cell, Roman History, Quantum Physics basics..." 
                    value={topic} 
                    onChange={e => setTopic(e.target.value)} 
                    className="resize-none min-h-[100px] text-base"
                />
             </div>
          ) : (
            <div className="space-y-2">
                <Label>Upload PDF</Label>
                <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer relative">
                    <Input 
                        type="file" 
                        accept=".pdf" 
                        onChange={e => setPdfFile(e.target.files?.[0] || null)} 
                        className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <FileText className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground text-center">
                        {pdfFile ? pdfFile.name : "Click to select a PDF file"}
                    </span>
                </div>
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
        <CardFooter className="pt-2">
            <Button className="w-full text-lg h-12 shadow-md" onClick={handleGenerate}>
                Start Test
            </Button>
        </CardFooter>
      </Card>
    );
  }

  if (step === "generating") {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-6 animate-in fade-in zoom-in duration-500">
            <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
                <Loader2 className="h-16 w-16 animate-spin text-primary relative z-10" />
            </div>
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Generating your test...</h2>
                <p className="text-muted-foreground text-lg">Our AI is reading the material and crafting questions.</p>
            </div>
        </div>
    );
  }

  if (step === "testing") {
    const q = questions[currentQIndex];
    const progress = ((currentQIndex) / questions.length) * 100;

    return (
        <div className="space-y-8 max-w-2xl mx-auto py-8">
            <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                    <span>Question {currentQIndex + 1} of {questions.length}</span>
                    <span>{Math.round(progress)}% Complete</span>
                </div>
                <Progress value={progress} className="h-2" />
            </div>
            
            <Card className="border-t-4 border-t-primary shadow-md">
                <CardHeader>
                    <CardTitle className="text-xl md:text-2xl leading-relaxed font-semibold">
                        {q.question}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <RadioGroup onValueChange={handleAnswer} value={userAnswers[currentQIndex]} className="gap-3">
                        {q.options.map((opt, i) => (
                            <div key={i} className={`flex items-center space-x-3 border p-4 rounded-xl transition-all ${userAnswers[currentQIndex] === opt ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-muted/50 hover:border-muted-foreground/30'}`}>
                                <RadioGroupItem value={opt} id={`opt-${i}`} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                                <Label htmlFor={`opt-${i}`} className="flex-1 cursor-pointer font-normal text-base md:text-lg leading-snug">{opt}</Label>
                            </div>
                        ))}
                    </RadioGroup>
                </CardContent>
                <CardFooter className="justify-end pt-4 border-t bg-muted/10">
                    <Button onClick={handleNext} disabled={!userAnswers[currentQIndex]} size="lg" className="min-w-[140px]">
                        {currentQIndex === questions.length - 1 ? "Finish Test" : "Next Question"}
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
  }

  if (step === "results") {
    const percentage = Math.round((score / questions.length) * 100);
    let colorClass = "text-green-500";
    if (percentage < 50) colorClass = "text-red-500";
    else if (percentage < 80) colorClass = "text-yellow-500";
    
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto py-6">
            {/* SCORE CARD */}
            <Card className="text-center overflow-hidden border-none shadow-xl bg-gradient-to-b from-background to-muted/20">
                <div className={`h-2 w-full ${percentage >= 80 ? 'bg-green-500' : percentage >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} />
                <CardContent className="pt-10 pb-10">
                    <div className="mb-6 inline-flex p-4 rounded-full bg-muted/30">
                        <Trophy className={`h-12 w-12 ${colorClass}`} />
                    </div>
                    <h2 className="text-4xl font-extrabold mb-2 tracking-tight">Test Complete!</h2>
                    <div className={`text-6xl font-black ${colorClass} mb-4 tracking-tighter`}>
                        {percentage}%
                    </div>
                    <p className="text-xl text-muted-foreground">You got <span className="font-bold text-foreground">{score}</span> out of {questions.length} correct.</p>
                </CardContent>
            </Card>

            {/* WRONG ANSWERS ACTION SECTION */}
            {wrongAnswers.length > 0 && (
                <div className="grid gap-8 lg:grid-cols-2">
                    
                    {/* COLUMNA IZQUIERDA: REPORT & ACTIONS */}
                    <div className="space-y-6">
                        
                        {/* ANALYSIS CARD */}
                        <Card className="flex flex-col h-full border-blue-200/50 dark:border-blue-900/50 shadow-md">
                            <CardHeader className="bg-blue-50/50 dark:bg-blue-950/20 pb-4 border-b border-blue-100 dark:border-blue-900/50">
                                <CardTitle className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                                    <Sparkles className="h-5 w-5" /> AI Knowledge Report
                                </CardTitle>
                                <CardDescription>Personalized analysis of your mistakes.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 p-0">
                                {!analysisReport ? (
                                    <div className="p-8 flex flex-col items-center justify-center text-center h-full min-h-[200px]">
                                        <p className="text-muted-foreground mb-6">Unlock insights to understand why you missed these questions.</p>
                                        <Button onClick={handleAnalyze} disabled={isAnalyzing} className="w-full max-w-xs bg-blue-600 hover:bg-blue-700 text-white">
                                            {isAnalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Generate AI Report"}
                                        </Button>
                                    </div>
                                ) : (
                                    <ScrollArea className="h-[400px] w-full">
                                        <div className="p-6 text-sm text-foreground leading-relaxed">
                                            {/* RENDERIZADO PERSONALIZADO DE MARKDOWN PARA MEJOR DISEÑO */}
                                            <ReactMarkdown
                                                components={{
                                                    h1: ({node, ...props}) => <h3 className="text-lg font-bold mt-6 mb-3 text-blue-600 dark:text-blue-400 border-b pb-1" {...props} />,
                                                    h2: ({node, ...props}) => <h4 className="text-base font-bold mt-5 mb-2 text-foreground" {...props} />,
                                                    h3: ({node, ...props}) => <h5 className="text-sm font-bold mt-4 mb-2" {...props} />,
                                                    p: ({node, ...props}) => <p className="mb-4 text-muted-foreground leading-7" {...props} />,
                                                    ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-4 space-y-2 bg-muted/30 p-3 rounded-lg" {...props} />,
                                                    li: ({node, ...props}) => <li className="text-muted-foreground pl-1" {...props} />,
                                                    strong: ({node, ...props}) => <span className="font-bold text-foreground" {...props} />,
                                                }}
                                            >
                                                {analysisReport}
                                            </ReactMarkdown>
                                        </div>
                                    </ScrollArea>
                                )}
                            </CardContent>
                        </Card>

                        {/* SAVE CARD */}
                        <Card className="border-green-200/50 dark:border-green-900/50 shadow-md">
                            <CardHeader className="bg-green-50/50 dark:bg-green-950/20 pb-4 border-b border-green-100 dark:border-green-900/50">
                                <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
                                    <Save className="h-5 w-5" /> Save Mistakes
                                </CardTitle>
                                <CardDescription>Convert {wrongAnswers.length} mistakes into flashcards.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4 pt-6">
                                <Select value={saveMode} onValueChange={(v: any) => setSaveMode(v)}>
                                    <SelectTrigger><SelectValue placeholder="Choose action..." /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Select an option...</SelectItem>
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

                                <Button 
                                    onClick={handleSaveToDeck} 
                                    disabled={isSaving || saveMode === "none"} 
                                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                                >
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Save Cards to Deck"}
                                </Button>
                            </CardContent>
                        </Card>
                    </div>

                    {/* COLUMNA DERECHA: LIST OF ERRORS */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-amber-500" /> Mistakes Review
                            </h3>
                            <span className="text-sm text-muted-foreground">{wrongAnswers.length} Incorrect</span>
                        </div>
                        
                        <ScrollArea className="h-[600px] pr-4">
                            <div className="space-y-4">
                                {wrongAnswers.map((w, i) => (
                                    <Card key={i} className="border-l-4 border-l-destructive shadow-sm hover:shadow-md transition-shadow">
                                        <CardContent className="pt-5 pb-5">
                                            <p className="font-semibold text-lg mb-4 leading-snug">{w.question}</p>
                                            <div className="space-y-3">
                                                <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 text-sm">
                                                    <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                                                    <div>
                                                        <span className="font-bold text-red-700 dark:text-red-400 block mb-1">Your Answer</span>
                                                        <span className="text-red-900 dark:text-red-200">{w.userAnswer}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 text-sm">
                                                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                                                    <div>
                                                        <span className="font-bold text-green-700 dark:text-green-400 block mb-1">Correct Answer</span>
                                                        <span className="text-green-900 dark:text-green-200">{w.correctAnswer}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            )}
            
            <div className="flex justify-center pt-8 border-t">
                 <Button variant="outline" size="lg" onClick={() => window.location.reload()}>Take Another Test</Button>
            </div>
        </div>
    );
  }

  return null; 
}