"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, CheckCircle, XCircle, FileText, AlertTriangle, Save, Sparkles, Trophy, ArrowRight, RefreshCcw, Plus, RotateCcw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";

type Step = "setup" | "generating" | "testing" | "results";

interface Question {
  question: string;
  options: string[];
  correctAnswer: string;
}

interface WrongAnswer extends Question {
  userAnswer: string;
}

interface TestRecord {
    id: string;
    topic: string;
    score: number;
    total_questions: number;
    created_at: string;
    difficulty: string;
    questions: Question[];
    user_answers: string[];
    ai_report: string | null;
}

export function AITestFlow({ userDecks }: { userDecks: { id: string, name: string }[] }) {
  const [activeTab, setActiveTab] = useState("new");
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

  // Extension Logic
  const [moreCount, setMoreCount] = useState("5");
  const [includeMistakes, setIncludeMistakes] = useState(true);
  const [isGeneratingMore, setIsGeneratingMore] = useState(false);

  // Analysis States
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisReport, setAnalysisReport] = useState<string | null>(null);
  const reportRef = useRef<HTMLDivElement>(null);

  // Saving States
  const [saveMode, setSaveMode] = useState<"none" | "existing" | "new">("none");
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [newDeckName, setNewDeckName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // History State
  const [history, setHistory] = useState<TestRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (analysisReport && reportRef.current) {
        reportRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [analysisReport]);

  useEffect(() => {
      if (activeTab === "history") {
          fetchHistory();
      }
  }, [activeTab]);

  const fetchHistory = async () => {
      setIsLoadingHistory(true);
      try {
          const res = await fetch("/api/get-test-history");
          const data = await res.json();
          if (Array.isArray(data)) setHistory(data);
      } catch (e) {
          console.error("Failed to load history");
      } finally {
          setIsLoadingHistory(false);
      }
  };

  const loadHistoricalTest = (test: TestRecord) => {
      setQuestions(test.questions);
      setUserAnswers(test.user_answers);
      setScore(test.score);
      setTopic(test.topic || "Unknown Topic");
      
      const wrongs: WrongAnswer[] = [];
      test.questions.forEach((q, idx) => {
          if (test.user_answers[idx] !== q.correctAnswer) {
              wrongs.push({ ...q, userAnswer: test.user_answers[idx] });
          }
      });
      setWrongAnswers(wrongs);
      setAnalysisReport(test.ai_report);
      
      setStep("results");
      setActiveTab("new");
  };

  // --- ACTIONS ---

  const handleGenerate = async (isExtension = false) => {
    if (!isExtension) {
        if (sourceType === "topic" && !topic) return toast({title: "Topic required", variant: "destructive"});
        if (sourceType === "pdf" && !pdfFile) return toast({title: "PDF required", variant: "destructive"});
        setStep("generating");
    } else {
        setIsGeneratingMore(true);
    }

    const formData = new FormData();
    formData.append("questionCount", isExtension ? moreCount : count);
    formData.append("difficulty", difficulty);
    formData.append("language", language);
    if (sourceType === "topic") formData.append("topic", topic);
    if (sourceType === "pdf" && pdfFile) formData.append("pdfFile", pdfFile);
    
    const existingQuestions = questions.map(q => q.question);
    formData.append("avoidQuestions", JSON.stringify(existingQuestions));

    try {
      const res = await fetch("/api/generate-quiz", { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      let newQuestions = data;

      if (isExtension) {
          if (includeMistakes && wrongAnswers.length > 0) {
              const mistakesToRetry = wrongAnswers.map(w => ({
                  question: w.question,
                  options: w.options,
                  correctAnswer: w.correctAnswer
              }));
              newQuestions = [...mistakesToRetry, ...newQuestions];
              newQuestions.sort(() => Math.random() - 0.5);
          }
          
          setQuestions(newQuestions);
          setCurrentQIndex(0);
          setUserAnswers([]);
          setStep("testing");
          setIsGeneratingMore(false);
          toast({ title: "New Session Started", description: `Loaded ${newQuestions.length} questions.` });
      } else {
          setQuestions(data);
          setStep("testing");
      }

    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setStep("setup");
      setIsGeneratingMore(false);
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

  const finishTest = async () => {
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

    try {
        await fetch("/api/save-test-result", {
            method: "POST",
            body: JSON.stringify({
                topic: sourceType === 'topic' ? topic : (pdfFile?.name || 'PDF Upload'),
                source_type: sourceType,
                difficulty,
                language,
                score: correctCount,
                total_questions: questions.length,
                questions,
                user_answers: userAnswers
            }),
            headers: { "Content-Type": "application/json" }
        });
    } catch (e) {
        console.error("Failed to auto-save test");
    }
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-quiz", {
        method: "POST",
        body: JSON.stringify({ wrongQuestions: wrongAnswers, language, difficulty }),
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
      
      toast({ title: "Success", description: "Cards added successfully! You can find them in your dashboard." });
    } catch (e) {
      toast({ title: "Error saving cards", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // --- RENDERERS ---

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="new">Current Session</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="history">
            <Card>
                <CardHeader>
                    <CardTitle>Test History</CardTitle>
                    <CardDescription>Review your past performance and reload sessions.</CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoadingHistory ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                    ) : history.length === 0 ? (
                        <div className="text-center p-8 text-muted-foreground">No tests taken yet.</div>
                    ) : (
                        <div className="space-y-4">
                            {history.map((test) => (
                                <div key={test.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                                    <div className="space-y-1">
                                        <p className="font-semibold">{test.topic}</p>
                                        <div className="flex gap-2 text-xs text-muted-foreground">
                                            <Badge variant="outline">{test.difficulty}</Badge>
                                            <span>{formatDistanceToNow(new Date(test.created_at))} ago</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="text-right">
                                            <p className="font-bold text-lg">{Math.round((test.score / test.total_questions) * 100)}%</p>
                                            <p className="text-xs text-muted-foreground">{test.score}/{test.total_questions}</p>
                                        </div>
                                        <Button size="sm" variant="secondary" onClick={() => loadHistoricalTest(test)}>
                                            Review
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="new">
            {step === "setup" && (
                <Card className="shadow-lg border-muted max-w-2xl mx-auto mt-8">
                    <CardHeader className="text-center pb-2">
                    <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
                        <Sparkles className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-3xl font-bold">New Practice Test</CardTitle>
                    <CardDescription className="text-lg">Configure your AI-generated exam.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8 pt-6">
                    <div className="space-y-4">
                        <Label className="text-base font-semibold">What do you want to practice?</Label>
                        <div className="grid grid-cols-2 gap-4">
                            <div 
                                className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center gap-2 transition-all ${sourceType === "topic" ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/50"}`}
                                onClick={() => setSourceType("topic")}
                            >
                                <Sparkles className="h-6 w-6" />
                                <span className="font-medium">Specific Topic</span>
                            </div>
                            <div 
                                className={`cursor-pointer border-2 rounded-xl p-4 flex flex-col items-center gap-2 transition-all ${sourceType === "pdf" ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/50"}`}
                                onClick={() => setSourceType("pdf")}
                            >
                                <FileText className="h-6 w-6" />
                                <span className="font-medium">From PDF</span>
                            </div>
                        </div>

                        {sourceType === "topic" ? (
                            <Textarea 
                                placeholder="E.g., The French Revolution, Python Basics, Introduction to Marketing..." 
                                value={topic} 
                                onChange={e => setTopic(e.target.value)} 
                                className="resize-none min-h-[120px] text-base p-4"
                            />
                        ) : (
                            <div className="border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer relative">
                                <Input 
                                    type="file" 
                                    accept=".pdf" 
                                    onChange={e => setPdfFile(e.target.files?.[0] || null)} 
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                                <div className="bg-background p-3 rounded-full shadow-sm mb-3">
                                    <FileText className="h-6 w-6 text-primary" />
                                </div>
                                <span className="font-medium text-foreground">
                                    {pdfFile ? pdfFile.name : "Click to upload PDF"}
                                </span>
                                <span className="text-xs text-muted-foreground mt-1">Up to 10MB</span>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <Label>Questions</Label>
                            <Select value={count} onValueChange={setCount}>
                                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
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
                                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
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
                                <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="English">English</SelectItem>
                                    <SelectItem value="Spanish">Spanish</SelectItem>
                                    <SelectItem value="Portuguese">Portuguese</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    </CardContent>
                    <CardFooter className="pb-8 pt-2">
                        <Button className="w-full text-lg h-14 shadow-lg rounded-xl" onClick={() => handleGenerate(false)}>
                            Start Test <ArrowRight className="ml-2 h-5 w-5" />
                        </Button>
                    </CardFooter>
                </Card>
            )}

            {step === "generating" && (
                <div className="flex flex-col items-center justify-center h-[60vh] gap-8 animate-in fade-in zoom-in duration-500">
                    <div className="relative">
                        <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full animate-pulse" />
                        <Loader2 className="h-20 w-20 animate-spin text-primary relative z-10" />
                    </div>
                    <div className="text-center space-y-3 max-w-md">
                        <h2 className="text-3xl font-bold">Generating Test...</h2>
                        <p className="text-muted-foreground text-lg leading-relaxed">
                            Our AI is analyzing the material to create challenging questions for you.
                        </p>
                    </div>
                </div>
            )}

            {step === "testing" && (
                <div className="max-w-3xl mx-auto py-8 px-4">
                    <div className="mb-8 space-y-3">
                        <div className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                            <span className="bg-muted px-2 py-1 rounded">Question {currentQIndex + 1} of {questions.length}</span>
                            <span>{Math.round(((currentQIndex) / questions.length) * 100)}%</span>
                        </div>
                        <Progress value={((currentQIndex) / questions.length) * 100} className="h-3 rounded-full" />
                    </div>
                    
                    <Card className="border-none shadow-xl ring-1 ring-muted">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xl md:text-2xl leading-relaxed font-semibold">
                                {questions[currentQIndex].question}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <RadioGroup onValueChange={handleAnswer} value={userAnswers[currentQIndex]} className="gap-4">
                                {questions[currentQIndex].options.map((opt, i) => (
                                    <div 
                                        key={i} 
                                        className={`flex items-center space-x-3 border-2 p-5 rounded-2xl transition-all cursor-pointer ${userAnswers[currentQIndex] === opt ? 'border-primary bg-primary/5 shadow-sm' : 'border-transparent bg-muted/40 hover:bg-muted/70'}`}
                                        onClick={() => handleAnswer(opt)}
                                    >
                                        <RadioGroupItem value={opt} id={`opt-${i}`} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
                                        <Label htmlFor={`opt-${i}`} className="flex-1 cursor-pointer font-normal text-base md:text-lg leading-snug">{opt}</Label>
                                    </div>
                                ))}
                            </RadioGroup>
                        </CardContent>
                        <CardFooter className="justify-end pt-6 pb-6 pr-6">
                            <Button onClick={handleNext} disabled={!userAnswers[currentQIndex]} size="lg" className="min-w-[160px] h-12 text-base rounded-xl">
                                {currentQIndex === questions.length - 1 ? "Finish Test" : "Next Question"}
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            )}

            {step === "results" && (
                <div className="max-w-4xl mx-auto py-8 px-4 space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                    
                    {/* 1. SCORE CARD */}
                    <div className="text-center space-y-4">
                        <div className="inline-flex items-center justify-center p-6 rounded-full bg-background shadow-lg border mb-4">
                            <Trophy className={`h-16 w-16 ${Math.round((score / questions.length) * 100) >= 50 ? 'text-green-500' : 'text-red-500'}`} />
                        </div>
                        <h1 className="text-5xl font-black tracking-tight">{Math.round((score / questions.length) * 100)}%</h1>
                        <p className="text-2xl text-muted-foreground">You scored {score} out of {questions.length}</p>
                    </div>

                    {/* 2. AI REPORT */}
                    {wrongAnswers.length > 0 && (
                        <div ref={reportRef} className="scroll-mt-24">
                            <Card className="border-blue-200 dark:border-blue-900 shadow-xl overflow-hidden">
                                <div className="bg-gradient-to-r from-blue-50 to-white dark:from-blue-950/30 dark:to-background border-b border-blue-100 dark:border-blue-900 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg">
                                            <Sparkles className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-xl text-blue-900 dark:text-blue-100">Deep Knowledge Report</CardTitle>
                                            <CardDescription className="text-blue-700/80 dark:text-blue-300/80">Professor-level detailed analysis of your mistakes.</CardDescription>
                                        </div>
                                    </div>
                                    {!analysisReport && (
                                        <Button onClick={handleAnalyze} disabled={isAnalyzing} size="lg" className="bg-blue-600 hover:bg-blue-700 text-white shadow-md w-full md:w-auto">
                                            {isAnalyzing ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : "Generate Full Analysis"}
                                        </Button>
                                    )}
                                </div>
                                
                                {analysisReport && (
                                    <CardContent className="p-0 bg-card/50">
                                        <ScrollArea className="h-[600px] w-full p-8 md:p-10">
                                            <article className="prose prose-lg dark:prose-invert max-w-none">
                                                <ReactMarkdown
                                                    components={{
                                                        h3: ({node, ...props}) => <h3 className="text-xl font-bold mt-8 mb-4 text-primary border-b pb-2" {...props} />,
                                                        p: ({node, ...props}) => <p className="mb-6 text-muted-foreground leading-8" {...props} />,
                                                        strong: ({node, ...props}) => <span className="font-bold text-foreground" {...props} />,
                                                        hr: ({node, ...props}) => <hr className="my-8 border-muted" {...props} />,
                                                        li: ({node, ...props}) => <li className="mb-2" {...props} />,
                                                    }}
                                                >
                                                    {analysisReport}
                                                </ReactMarkdown>
                                            </article>
                                        </ScrollArea>
                                    </CardContent>
                                )}
                            </Card>
                        </div>
                    )}

                    {/* 3. DETAILS GRID */}
                    {wrongAnswers.length > 0 && (
                        <div className="grid gap-8 md:grid-cols-2 items-start">
                            {/* Save Card */}
                            <Card className="border-green-200 dark:border-green-900 shadow-md h-full">
                                <CardHeader className="bg-green-50/50 dark:bg-green-950/20 pb-4 border-b border-green-100 dark:border-green-900">
                                    <CardTitle className="flex items-center gap-2 text-green-800 dark:text-green-300">
                                        <Save className="h-5 w-5" /> Save to Deck
                                    </CardTitle>
                                    <CardDescription>Don't lose this knowledge. Turn mistakes into flashcards.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4 pt-6">
                                    <Select value={saveMode} onValueChange={(v: any) => setSaveMode(v)}>
                                        <SelectTrigger className="h-11"><SelectValue placeholder="Choose action..." /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Select an option...</SelectItem>
                                            <SelectItem value="existing">Add to existing deck</SelectItem>
                                            <SelectItem value="new">Create new deck</SelectItem>
                                        </SelectContent>
                                    </Select>

                                    {saveMode === "existing" && (
                                        <Select value={selectedDeckId} onValueChange={setSelectedDeckId}>
                                            <SelectTrigger className="h-11"><SelectValue placeholder="Select Deck" /></SelectTrigger>
                                            <SelectContent>
                                                {userDecks.map(deck => (
                                                    <SelectItem key={deck.id} value={deck.id}>{deck.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}

                                    {saveMode === "new" && (
                                        <Input className="h-11" placeholder="New Deck Name" value={newDeckName} onChange={e => setNewDeckName(e.target.value)} />
                                    )}

                                    <Button 
                                        onClick={handleSaveToDeck} 
                                        disabled={isSaving || saveMode === "none"} 
                                        className="w-full h-11 bg-green-600 hover:bg-green-700 text-white font-semibold"
                                    >
                                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : "Save Cards"}
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* Mistakes List */}
                            <Card className="shadow-md h-full flex flex-col">
                                <CardHeader className="pb-3 border-b">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
                                            <AlertTriangle className="h-5 w-5" /> Quick Review
                                        </CardTitle>
                                        <span className="text-sm font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-1 rounded-md">
                                            {wrongAnswers.length} items
                                        </span>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0 flex-1">
                                    <ScrollArea className="h-[350px]">
                                        <div className="p-4 space-y-4">
                                            {wrongAnswers.map((w, i) => (
                                                <div key={i} className="p-4 rounded-xl border bg-muted/10 space-y-3">
                                                    <p className="font-semibold text-base leading-snug">{w.question}</p>
                                                    <div className="grid gap-2 text-sm">
                                                        <div className="flex gap-2 text-red-600 dark:text-red-400">
                                                            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                                            <span className="font-medium">{w.userAnswer}</span>
                                                        </div>
                                                        <div className="flex gap-2 text-green-600 dark:text-green-400">
                                                            <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                                            <span className="font-medium">{w.correctAnswer}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                </CardContent>
                            </Card>
                        </div>
                    )}
                    
                    {/* 4. FOOTER ACTIONS: CONTINUE / NEW */}
                    <div className="pt-12 pb-20 border-t">
                        <h3 className="text-2xl font-bold text-center mb-8">What's Next?</h3>
                        
                        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                            {/* Option A: Continue on same topic */}
                            <div className="p-6 border rounded-2xl bg-primary/5 border-primary/20 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="bg-primary text-primary-foreground p-2 rounded-lg">
                                        <RotateCcw className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-lg">Keep Practicing</h4>
                                        <p className="text-sm text-muted-foreground">Generate more questions on this topic.</p>
                                    </div>
                                </div>
                                
                                <div className="space-y-4 pt-2">
                                    <div className="flex items-center justify-between">
                                        <Label>New Questions:</Label>
                                        <Select value={moreCount} onValueChange={setMoreCount}>
                                            <SelectTrigger className="w-[100px] h-8"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="5">5</SelectItem>
                                                <SelectItem value="10">10</SelectItem>
                                                <SelectItem value="15">15</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    {wrongAnswers.length > 0 && (
                                        <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg bg-background">
                                            <div className="space-y-0.5">
                                                <Label className="text-sm font-medium">Retry Mistakes</Label>
                                                <p className="text-xs text-muted-foreground">Include your {wrongAnswers.length} errors in the new set.</p>
                                            </div>
                                            <Switch checked={includeMistakes} onCheckedChange={setIncludeMistakes} />
                                        </div>
                                    )}

                                    <Button onClick={() => handleGenerate(true)} disabled={isGeneratingMore} className="w-full">
                                        {isGeneratingMore ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : "Generate & Start"}
                                    </Button>
                                </div>
                            </div>

                            {/* Option B: Completely New */}
                            <div className="p-6 border rounded-2xl flex flex-col justify-center items-center text-center space-y-4 hover:bg-muted/30 transition-colors">
                                <div className="bg-muted p-3 rounded-full">
                                    <Plus className="h-8 w-8 text-muted-foreground" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-lg">New Topic</h4>
                                    <p className="text-sm text-muted-foreground">Done with this? Start something fresh.</p>
                                </div>
                                <Button variant="outline" className="w-full" onClick={() => window.location.reload()}>
                                    Start New Test
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </TabsContent> {/* 👈 AQUÍ ESTABA EL ERROR: FALTABA CERRAR TABSCONTENT */}
    </Tabs>
  );
}