"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Loader2, FileText, Send, Bot, User, ArrowRight, CheckCircle, XCircle, Save, Sparkles, BookOpen, Upload, AlignLeft, MessageSquare, ListTodo } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import ReactMarkdown from "react-markdown";

type Message = { role: "user" | "model"; content: string };
type Question = { question: string; options: { [key: string]: string }; answer: string; explanation?: string };
type WrongAnswer = Question & { userAnswer: string };

export function TurboStudyFlow({ userDecks }: { userDecks: { id: string, name: string }[] }) {
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([{ role: "model", content: "Hi! I have analyzed your document. What questions do you have or what concepts would you like me to explain?" }]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Test State
  const [testState, setTestState] = useState<"setup" | "generating" | "taking" | "results">("setup");
  const [questionCount, setQuestionCount] = useState("5");
  const [language, setLanguage] = useState("English");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([]);
  
  // Summary State
  const [summary, setSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // Save State
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, summary]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
        return toast({ title: "File too large", description: "Please upload a PDF smaller than 4MB.", variant: "destructive" });
    }

    setIsProcessingFile(true);
    setFileName(file.name);
    
    // Create an object URL for fast native iframe rendering
    const objectUrl = URL.createObjectURL(file);
    setPdfUrl(objectUrl);
    
    // Read base64 for the API
    const reader = new FileReader();
    reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        setPdfBase64(base64String);
        setIsProcessingFile(false);
        setIsReady(true);
    };
    reader.onerror = () => {
        setIsProcessingFile(false);
        toast({ title: "Error reading file", variant: "destructive" });
    };
    reader.readAsDataURL(file);
  };

  const resetWorkspace = () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setIsReady(false);
    setPdfBase64(null);
    setPdfUrl(null);
    setSummary(null);
    setMessages([{ role: "model", content: "Hi! I have analyzed your document. What questions do you have or what concepts would you like me to explain?" }]);
    setTestState("setup");
  };

  const handleSendMessage = async () => {
      if (!chatInput.trim()) return;
      
      const newMessages = [...messages, { role: "user", content: chatInput } as Message];
      setMessages(newMessages);
      setChatInput("");
      setIsChatting(true);

      try {
          const res = await fetch("/api/turbo-study", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "chat", messages: newMessages, pdfBase64 })
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error);

          setMessages([...newMessages, { role: "model", content: data.data }]);
      } catch (e: any) {
          toast({ title: "Chat Error", description: e.message, variant: "destructive" });
      } finally {
          setIsChatting(false);
      }
  };

  const handleGenerateTest = async () => {
      setTestState("generating");
      try {
          const res = await fetch("/api/turbo-study", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "generate_test", questionCount, language, pdfBase64 })
          });
          const result = await res.json();
          if (result.error) throw new Error(result.error);

          setQuestions(result.data);
          setUserAnswers(new Array(result.data.length).fill(""));
          setCurrentQIndex(0);
          setTestState("taking");
      } catch (e: any) {
          toast({ title: "Error generating test", description: e.message, variant: "destructive" });
          setTestState("setup");
      }
  };

  const handleGenerateSummary = async () => {
      setIsGeneratingSummary(true);
      try {
          const res = await fetch("/api/turbo-study", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "summarize", pdfBase64 })
          });
          const result = await res.json();
          if (result.error) throw new Error(result.error);
          setSummary(result.data);
      } catch (e: any) {
          toast({ title: "Error generating summary", description: e.message, variant: "destructive" });
      } finally {
          setIsGeneratingSummary(false);
      }
  };

  const finishTest = () => {
      const wrongs: WrongAnswer[] = [];
      questions.forEach((q, idx) => {
          if (userAnswers[idx] !== q.answer) {
              wrongs.push({ ...q, userAnswer: userAnswers[idx] });
          }
      });
      setWrongAnswers(wrongs);
      setTestState("results");
  };

  const handleSaveToDeck = async () => {
    if (!selectedDeckId) return toast({ title: "Select a deck", variant: "destructive" });
    setIsSaving(true);
    
    const formattedCards = wrongAnswers.map(w => ({
        front: w.question,
        back: `**Correct Answer:** ${w.options[w.answer as keyof typeof w.options]}\n\n*Explanation:* ${w.explanation || "Generated by Turbo Study"}`
    }));

    try {
      const res = await fetch("/api/save-quiz-cards", {
        method: "POST",
        body: JSON.stringify({ deckId: selectedDeckId, newDeckName: null, cards: formattedCards }),
        headers: { "Content-Type": "application/json" }
      });
      
      if (!res.ok) throw new Error("Failed to save");
      toast({ title: "Saved!", description: "The cards have been added to your deck." });
    } catch (e) {
      toast({ title: "Error saving cards", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isReady) {
      return (
          <div className="flex-1 flex items-center justify-center p-4">
              <div className="max-w-xl w-full animate-in fade-in slide-in-from-bottom-4">
                  <div className="mb-8 text-center">
                      <h1 className="text-4xl font-bold mb-2">Turbo Study <span className="text-primary text-sm align-top">BETA</span></h1>
                      <p className="text-muted-foreground text-lg">Your AI-powered study workspace. Chat with documents, generate flashcards, and create tests instantly.</p>
                  </div>
                  <Card className="border-muted shadow-2xl bg-card/50 backdrop-blur-sm">
                      <CardContent className="pt-8 pb-8">
                          <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-xl bg-muted/20 hover:bg-muted/40 transition-colors">
                              {isProcessingFile ? (
                                  <div className="flex flex-col items-center text-primary">
                                      <Loader2 className="h-10 w-10 animate-spin mb-4" />
                                      <p className="font-medium text-lg">Initializing AI Workspace...</p>
                                  </div>
                              ) : (
                                  <>
                                      <Upload className="h-16 w-16 text-muted-foreground mb-6" />
                                      <Label htmlFor="pdf-upload" className="cursor-pointer bg-primary text-primary-foreground px-8 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors text-lg shadow-sm">
                                          Select PDF Document
                                      </Label>
                                      <Input 
                                          id="pdf-upload"
                                          type="file" 
                                          accept=".pdf" 
                                          onChange={handleFileUpload} 
                                          className="hidden" 
                                      />
                                      <p className="text-sm text-muted-foreground mt-4">Max file size: 4MB</p>
                                  </>
                              )}
                          </div>
                      </CardContent>
                  </Card>
              </div>
          </div>
      );
  }

  return (
      <div className="flex flex-col h-full w-full">
          {/* Top Navbar */}
          <div className="h-14 bg-background border-b flex justify-between items-center px-4 shrink-0 shadow-sm z-10">
              <div className="flex items-center gap-3 overflow-hidden">
                  <div className="bg-primary/10 p-1.5 rounded-md">
                      <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <span className="font-semibold text-sm truncate max-w-[200px] sm:max-w-[400px]">
                      {fileName}
                  </span>
              </div>
              <Button variant="outline" size="sm" onClick={resetWorkspace}>
                  Close Document
              </Button>
          </div>

          {/* Main Workspace */}
          <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
              {/* Left Panel: PDF Viewer */}
              <ResizablePanel defaultSize={50} minSize={30} className="bg-muted/10 hidden md:block border-r relative">
                  {pdfUrl ? (
                      <iframe 
                          src={`${pdfUrl}#toolbar=0`} 
                          className="w-full h-full border-none"
                          title="PDF Viewer"
                      />
                  ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                          Loading viewer...
                      </div>
                  )}
              </ResizablePanel>

              <ResizableHandle withHandle />

              {/* Right Panel: AI Tools */}
              <ResizablePanel defaultSize={50} minSize={30} className="flex flex-col bg-background">
                  <Tabs defaultValue="chat" className="flex-1 flex flex-col h-full overflow-hidden">
                      <TabsList className="grid w-full grid-cols-3 rounded-none h-12 border-b bg-muted/20">
                          <TabsTrigger value="chat" className="text-sm data-[state=active]:bg-background"><MessageSquare className="w-4 h-4 mr-2"/> Chat</TabsTrigger>
                          <TabsTrigger value="test" className="text-sm data-[state=active]:bg-background"><ListTodo className="w-4 h-4 mr-2"/> Test</TabsTrigger>
                          <TabsTrigger value="summary" className="text-sm data-[state=active]:bg-background"><AlignLeft className="w-4 h-4 mr-2"/> Summary</TabsTrigger>
                      </TabsList>

                      {/* CHAT TAB */}
                      <TabsContent value="chat" className="flex-1 flex flex-col m-0 p-0 h-full overflow-hidden data-[state=inactive]:hidden">
                          <div className="flex-1 overflow-y-auto p-4 min-h-0 bg-background">
                              <div className="space-y-6 max-w-3xl mx-auto pb-4 w-full">
                                  {messages.map((msg, i) => (
                                      <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                          {msg.role === 'model' && <div className="bg-primary/10 p-2 rounded-full h-fit"><Bot className="h-5 w-5 text-primary" /></div>}
                                          <div className={`p-4 rounded-2xl max-w-[85%] text-sm sm:text-base ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted/50 border rounded-tl-sm prose dark:prose-invert prose-p:leading-relaxed prose-pre:bg-black/10'}`}>
                                              {msg.role === 'user' ? msg.content : <ReactMarkdown>{msg.content}</ReactMarkdown>}
                                          </div>
                                          {msg.role === 'user' && <div className="bg-muted p-2 rounded-full h-fit"><User className="h-5 w-5" /></div>}
                                      </div>
                                  ))}
                                  {isChatting && (
                                      <div className="flex gap-3 justify-start animate-pulse">
                                          <div className="bg-primary/10 p-2 rounded-full h-fit"><Bot className="h-5 w-5 text-primary" /></div>
                                          <div className="p-4 rounded-2xl bg-muted/50 border rounded-tl-sm flex gap-2 items-center h-[52px]">
                                              <div className="h-2 w-2 bg-foreground/30 rounded-full animate-bounce" />
                                              <div className="h-2 w-2 bg-foreground/30 rounded-full animate-bounce delay-75" />
                                              <div className="h-2 w-2 bg-foreground/30 rounded-full animate-bounce delay-150" />
                                          </div>
                                      </div>
                                  )}
                                  <div ref={scrollRef} />
                              </div>
                          </div>
                          <div className="p-4 bg-background border-t shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
                              <form onSubmit={e => { e.preventDefault(); handleSendMessage(); }} className="flex gap-2 max-w-3xl mx-auto relative">
                                  <Textarea 
                                      value={chatInput} 
                                      onChange={e => setChatInput(e.target.value)}
                                      placeholder="Ask a question about this document..." 
                                      className="min-h-[60px] max-h-[150px] resize-y pr-14 rounded-xl text-base bg-muted/50 focus-visible:bg-background"
                                      onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                                  />
                                  <Button size="icon" type="submit" disabled={isChatting || !chatInput.trim()} className="absolute right-3 bottom-3 h-10 w-10 rounded-lg shadow-sm">
                                      <Send className="h-4 w-4" />
                                  </Button>
                              </form>
                          </div>
                      </TabsContent>

                      {/* TEST TAB */}
                      <TabsContent value="test" className="flex-1 overflow-auto p-4 sm:p-6 m-0 bg-background data-[state=inactive]:hidden">
                          <div className="max-w-2xl mx-auto h-full flex flex-col">
                              {testState === "setup" && (
                                  <div className="space-y-6 mt-8 animate-in fade-in">
                                      <div className="text-center">
                                          <h2 className="text-2xl font-bold">Generate Quiz</h2>
                                          <p className="text-muted-foreground mt-2">Extract the most important concepts into a multiple-choice test.</p>
                                      </div>
                                      <Card className="shadow-sm border-muted">
                                          <CardContent className="space-y-6 pt-6">
                                              <div className="space-y-3">
                                                  <Label className="text-base">Number of questions</Label>
                                                  <Select value={questionCount} onValueChange={setQuestionCount}>
                                                      <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                                                      <SelectContent>
                                                          <SelectItem value="5">5 Questions</SelectItem>
                                                          <SelectItem value="10">10 Questions</SelectItem>
                                                          <SelectItem value="15">15 Questions</SelectItem>
                                                      </SelectContent>
                                                  </Select>
                                              </div>
                                              <div className="space-y-3">
                                                  <Label className="text-base">Language</Label>
                                                  <Select value={language} onValueChange={setLanguage}>
                                                      <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                                                      <SelectContent>
                                                          <SelectItem value="English">English</SelectItem>
                                                          <SelectItem value="Spanish">Spanish</SelectItem>
                                                      </SelectContent>
                                                  </Select>
                                              </div>
                                              <Button className="w-full h-12 text-base shadow-sm" onClick={handleGenerateTest}>
                                                  Start Test <Sparkles className="ml-2 h-4 w-4" />
                                              </Button>
                                          </CardContent>
                                      </Card>
                                  </div>
                              )}

                              {testState === "generating" && (
                                  <div className="flex flex-col items-center justify-center h-full gap-4">
                                      <Loader2 className="h-12 w-12 animate-spin text-primary" />
                                      <p className="text-lg font-medium text-center">Reading document and designing questions...<br/><span className="text-sm text-muted-foreground font-normal">This might take a few seconds</span></p>
                                  </div>
                              )}

                              {testState === "taking" && questions.length > 0 && (
                                  <Card className="shadow-md border-primary/20 animate-in fade-in slide-in-from-right-4 mt-4">
                                      <CardHeader className="bg-muted/10 border-b pb-4">
                                          <div className="flex justify-between items-center text-sm font-medium text-muted-foreground mb-3">
                                              <span>Question {currentQIndex + 1} of {questions.length}</span>
                                          </div>
                                          <CardTitle className="text-xl leading-relaxed">{questions[currentQIndex].question}</CardTitle>
                                      </CardHeader>
                                      <CardContent className="pt-6">
                                          <RadioGroup 
                                              value={userAnswers[currentQIndex]} 
                                              onValueChange={(val) => {
                                                  const newAns = [...userAnswers];
                                                  newAns[currentQIndex] = val;
                                                  setUserAnswers(newAns);
                                              }}
                                              className="gap-3"
                                          >
                                              {Object.entries(questions[currentQIndex].options).map(([key, value]) => (
                                                  <div key={key} className={`flex items-start space-x-3 border-2 p-4 rounded-xl cursor-pointer transition-all ${userAnswers[currentQIndex] === key ? 'border-primary bg-primary/5 shadow-sm' : 'border-muted/50 bg-muted/10 hover:border-muted-foreground/30'}`}>
                                                      <RadioGroupItem value={key} id={`opt-${key}`} className="mt-1" />
                                                      <Label htmlFor={`opt-${key}`} className="flex-1 cursor-pointer text-base leading-snug">{value}</Label>
                                                  </div>
                                              ))}
                                          </RadioGroup>
                                      </CardContent>
                                      <CardFooter className="justify-end pt-4 bg-muted/5 border-t">
                                          <Button size="lg" disabled={!userAnswers[currentQIndex]} onClick={() => {
                                              if (currentQIndex < questions.length - 1) setCurrentQIndex(p => p + 1);
                                              else finishTest();
                                          }}>
                                              {currentQIndex === questions.length - 1 ? "View Results" : "Next"} <ArrowRight className="ml-2 h-4 w-4" />
                                          </Button>
                                      </CardFooter>
                                  </Card>
                              )}

                              {testState === "results" && (
                                  <div className="space-y-6 pb-8 animate-in fade-in mt-4">
                                      <div className="text-center p-8 bg-muted/20 rounded-2xl border shadow-sm">
                                          <h2 className="text-5xl font-black text-primary mb-3">
                                              {questions.length - wrongAnswers.length} <span className="text-3xl text-muted-foreground">/ {questions.length}</span>
                                          </h2>
                                          <p className="text-lg font-medium">Correct answers.</p>
                                      </div>

                                      {wrongAnswers.length > 0 && (
                                          <Card className="border-destructive/20 shadow-sm overflow-hidden">
                                              <CardHeader className="bg-destructive/5 pb-4 border-b">
                                                  <CardTitle className="text-destructive flex items-center gap-2">
                                                      <XCircle className="h-5 w-5" /> Review Mistakes ({wrongAnswers.length})
                                                  </CardTitle>
                                              </CardHeader>
                                              <CardContent className="p-0">
                                                  <ScrollArea className="h-[400px]">
                                                      <div className="p-4 space-y-4">
                                                          {wrongAnswers.map((w, i) => (
                                                              <div key={i} className="p-5 border rounded-xl bg-background shadow-sm">
                                                                  <p className="font-semibold text-lg mb-4">{w.question}</p>
                                                                  <div className="space-y-3 text-base bg-muted/20 p-4 rounded-lg">
                                                                      <div className="flex items-start gap-2 text-destructive">
                                                                          <XCircle className="h-5 w-5 mt-0.5 shrink-0" />
                                                                          <span><strong>Your answer:</strong> {w.options[w.userAnswer as keyof typeof w.options]}</span>
                                                                      </div>
                                                                      <div className="flex items-start gap-2 text-green-600">
                                                                          <CheckCircle className="h-5 w-5 mt-0.5 shrink-0" />
                                                                          <span><strong>Correct:</strong> {w.options[w.answer as keyof typeof w.options]}</span>
                                                                      </div>
                                                                      {w.explanation && (
                                                                          <div className="mt-4 pt-4 border-t border-muted-foreground/20">
                                                                              <p className="text-muted-foreground italic text-sm"><span className="font-semibold not-italic">Explanation:</span> {w.explanation}</p>
                                                                          </div>
                                                                      )}
                                                                  </div>
                                                              </div>
                                                          ))}
                                                      </div>
                                                  </ScrollArea>
                                              </CardContent>
                                              <CardFooter className="bg-muted/10 border-t flex-col sm:flex-row gap-4 justify-between pt-6">
                                                  <div className="flex-1 w-full space-y-2">
                                                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Save mistakes as Flashcards</Label>
                                                      <Select value={selectedDeckId} onValueChange={setSelectedDeckId}>
                                                          <SelectTrigger className="w-full bg-background"><SelectValue placeholder="Select a deck to save..." /></SelectTrigger>
                                                          <SelectContent>
                                                              {userDecks.map(deck => (
                                                                  <SelectItem key={deck.id} value={deck.id}>{deck.name}</SelectItem>
                                                              ))}
                                                          </SelectContent>
                                                      </Select>
                                                  </div>
                                                  <Button onClick={handleSaveToDeck} disabled={isSaving || !selectedDeckId} className="w-full sm:w-auto sm:self-end">
                                                      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Save Cards
                                                  </Button>
                                              </CardFooter>
                                          </Card>
                                      )}
                                      
                                      <Button variant="outline" className="w-full h-12 shadow-sm" onClick={() => setTestState("setup")}>
                                          Create Another Quiz
                                      </Button>
                                  </div>
                              )}
                          </div>
                      </TabsContent>

                      {/* SUMMARY TAB */}
                      <TabsContent value="summary" className="flex-1 overflow-auto p-4 sm:p-6 m-0 bg-background data-[state=inactive]:hidden">
                          <div className="max-w-3xl mx-auto h-full flex flex-col">
                              {!summary && !isGeneratingSummary && (
                                  <div className="flex flex-col items-center justify-center h-full text-center space-y-4 animate-in fade-in">
                                      <div className="bg-primary/10 p-4 rounded-full">
                                          <AlignLeft className="h-8 w-8 text-primary" />
                                      </div>
                                      <h2 className="text-2xl font-bold">Document Summary</h2>
                                      <p className="text-muted-foreground max-w-md">Let the AI generate a comprehensive, structured summary of the entire document to grasp the core concepts quickly.</p>
                                      <Button onClick={handleGenerateSummary} className="mt-4 h-12 px-8">
                                          Generate Summary <Sparkles className="ml-2 h-4 w-4" />
                                      </Button>
                                  </div>
                              )}

                              {isGeneratingSummary && (
                                  <div className="flex flex-col items-center justify-center h-full gap-4">
                                      <Loader2 className="h-12 w-12 animate-spin text-primary" />
                                      <p className="text-lg font-medium text-center">Analyzing and summarizing document...<br/><span className="text-sm text-muted-foreground font-normal">This might take a while for large files</span></p>
                                  </div>
                              )}

                              {summary && (
                                  <div className="space-y-4 pb-8 animate-in fade-in">
                                      <div className="flex justify-between items-center mb-6">
                                          <h2 className="text-2xl font-bold">Executive Summary</h2>
                                          <Button variant="outline" size="sm" onClick={handleGenerateSummary}>Regenerate</Button>
                                      </div>
                                      <div className="prose dark:prose-invert max-w-none bg-muted/20 p-6 sm:p-8 rounded-2xl border">
                                          <ReactMarkdown>{summary}</ReactMarkdown>
                                      </div>
                                  </div>
                              )}
                          </div>
                      </TabsContent>
                  </Tabs>
              </ResizablePanel>
          </ResizablePanelGroup>
      </div>
  );
}