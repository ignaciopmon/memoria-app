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
import { Loader2, FileText, Send, Bot, User, ArrowRight, CheckCircle, XCircle, Save, Sparkles, BookOpen, Upload, AlignLeft, MessageSquare, ListTodo, ClipboardPaste, Lightbulb, Languages, Zap, Quote } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import ReactMarkdown from "react-markdown";

// Added 'excerpt' to hold the raw copied text cleanly
type Message = { role: "user" | "model"; content: string; excerpt?: string };
type Question = { question: string; options: { [key: string]: string }; answer: string; explanation?: string };
type WrongAnswer = Question & { userAnswer: string };

export function TurboStudyFlow({ userDecks }: { userDecks: { id: string, name: string }[] }) {
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([{ role: "model", content: "Hi! I'm your AI tutor. You can ask me anything about the document. \n\n**💡 Pro Tip:** Select and copy any text from the PDF, then use the Quick Actions below to instantly explain or translate it!" }]);
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
  
  // Save Cards State
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveOption, setSaveOption] = useState<"mistakes" | "all">("mistakes");
  
  // Summary State
  const [summary, setSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

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
    
    const objectUrl = URL.createObjectURL(file);
    setPdfUrl(objectUrl);
    
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
    setMessages([{ role: "model", content: "Hi! I'm your AI tutor. What would you like to learn today?" }]);
    setTestState("setup");
  };

  const handleSendMessage = async (customPrompt?: string, excerptData?: string) => {
      const finalInput = customPrompt || chatInput;
      if (!finalInput.trim()) return;
      
      const newMessage: Message = { role: "user", content: finalInput, excerpt: excerptData };
      const newMessages = [...messages, newMessage];
      setMessages(newMessages);
      if(!customPrompt) setChatInput("");
      setIsChatting(true);

      // Format messages for the AI, injecting the excerpt cleanly so it has the context
      const apiMessages = newMessages.map(msg => ({
          role: msg.role,
          content: msg.excerpt ? `${msg.content}\n\n[USER SELECTED EXCERPT]:\n"""\n${msg.excerpt}\n"""` : msg.content
      }));

      try {
          const res = await fetch("/api/turbo-study", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "chat", messages: apiMessages, pdfBase64 })
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

  // --- SMART CLIPBOARD ACTIONS ---
  const handleSmartAction = async (actionType: "explain" | "summarize" | "translate") => {
      try {
          const text = await navigator.clipboard.readText();
          if (!text || text.trim() === "") {
              return toast({ title: "Clipboard is empty", description: "Please copy some text from the PDF first.", variant: "destructive" });
          }

          let prompt = "";
          if (actionType === "explain") prompt = `Please explain the selected excerpt in simple terms.`;
          if (actionType === "summarize") prompt = `Please provide a brief, easy-to-understand summary of the selected excerpt.`;
          if (actionType === "translate") prompt = `Please translate the selected excerpt to my native language and briefly explain its context.`;

          // Pass both the command and the raw text
          handleSendMessage(prompt, text);
      } catch (err) {
          toast({ title: "Clipboard access denied", description: "Please allow clipboard permissions in your browser.", variant: "destructive" });
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
    
    const cardsToProcess = saveOption === "all" ? questions : wrongAnswers;
    
    const formattedCards = cardsToProcess.map((q: any) => ({
        front: q.question,
        back: `**Correct Answer:** ${q.options[q.answer]}\n\n*Explanation:* ${q.explanation || "Generated by Turbo Study AI"}`
    }));

    try {
      const res = await fetch("/api/save-quiz-cards", {
        method: "POST",
        body: JSON.stringify({ deckId: selectedDeckId, newDeckName: null, cards: formattedCards }),
        headers: { "Content-Type": "application/json" }
      });
      
      if (!res.ok) throw new Error("Failed to save");
      toast({ title: "Cards Saved!", description: `Successfully added ${formattedCards.length} cards to your deck.` });
    } catch (e) {
      toast({ title: "Error saving cards", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isReady) {
      return (
          <div className="flex-1 flex items-center justify-center p-4">
              <div className="max-w-2xl w-full animate-in fade-in slide-in-from-bottom-4">
                  <div className="mb-10 text-center space-y-3">
                      <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-2">
                          <Zap className="h-8 w-8 text-primary fill-primary/20" />
                      </div>
                      <h1 className="text-5xl font-extrabold tracking-tight">Turbo Study <span className="text-primary text-xl align-top font-bold uppercase tracking-widest bg-primary/10 px-2 py-1 rounded-md ml-1">Pro</span></h1>
                      <p className="text-muted-foreground text-lg max-w-lg mx-auto">Your ultra-advanced AI workspace. Extract intelligence, chat with complex documents, and master any subject instantly.</p>
                  </div>
                  <Card className="border-muted shadow-2xl bg-card/40 backdrop-blur-xl ring-1 ring-border/50">
                      <CardContent className="pt-8 pb-8">
                          <div className="flex flex-col items-center justify-center p-14 border-2 border-dashed border-primary/20 rounded-2xl bg-muted/10 hover:bg-muted/30 transition-all duration-300 group cursor-pointer relative overflow-hidden" onClick={() => !isProcessingFile && document.getElementById('pdf-upload')?.click()}>
                              {isProcessingFile ? (
                                  <div className="flex flex-col items-center text-primary z-10">
                                      <Loader2 className="h-12 w-12 animate-spin mb-4" />
                                      <p className="font-semibold text-lg tracking-wide">Initializing Neural Workspace...</p>
                                  </div>
                              ) : (
                                  <div className="flex flex-col items-center z-10 pointer-events-none">
                                      <div className="p-4 bg-background rounded-full shadow-sm mb-6 group-hover:scale-110 transition-transform duration-300">
                                          <Upload className="h-10 w-10 text-primary" />
                                      </div>
                                      <h3 className="text-2xl font-bold mb-2">Upload a Document</h3>
                                      <p className="text-muted-foreground text-center mb-6 max-w-sm">Drop your PDF here or click to browse. Let the AI do the heavy lifting.</p>
                                      <Button className="pointer-events-auto shadow-lg shadow-primary/20 h-12 px-8 text-md rounded-full" onClick={(e) => e.stopPropagation()}>
                                          <Label htmlFor="pdf-upload" className="cursor-pointer w-full h-full flex items-center">
                                              Select File
                                          </Label>
                                      </Button>
                                      <Input id="pdf-upload" type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" />
                                  </div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                          </div>
                      </CardContent>
                  </Card>
              </div>
          </div>
      );
  }

  return (
      <div className="flex flex-col h-full w-full bg-background/95">
          {/* Top Navbar */}
          <div className="h-14 bg-background/80 backdrop-blur-md border-b flex justify-between items-center px-4 shrink-0 shadow-sm z-20">
              <div className="flex items-center gap-3 overflow-hidden">
                  <div className="bg-primary/10 p-2 rounded-lg border border-primary/20">
                      <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-semibold text-sm truncate max-w-[200px] sm:max-w-[400px]">
                      {fileName}
                  </span>
              </div>
              <Button variant="ghost" size="sm" className="hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={resetWorkspace}>
                  Close Workspace
              </Button>
          </div>

          {/* Main Workspace */}
          <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
              {/* Left Panel: PDF Viewer */}
              <ResizablePanel defaultSize={50} minSize={30} className="bg-zinc-950 hidden md:flex flex-col border-r relative z-10">
                  {pdfUrl ? (
                      <iframe src={`${pdfUrl}#toolbar=0&navpanes=0`} className="w-full h-full border-none rounded-tl-sm" title="PDF Viewer" />
                  ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">Loading viewer...</div>
                  )}
              </ResizablePanel>

              <ResizableHandle withHandle className="bg-border/50 hover:bg-primary/50 transition-colors" />

              {/* Right Panel: AI Tools */}
              <ResizablePanel defaultSize={50} minSize={30} className="flex flex-col bg-background/50 relative">
                  <Tabs defaultValue="chat" className="flex-1 flex flex-col h-full overflow-hidden">
                      <TabsList className="grid w-full grid-cols-3 rounded-none h-14 border-b bg-muted/10 p-1 gap-1">
                          <TabsTrigger value="chat" className="text-sm rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"><MessageSquare className="w-4 h-4 mr-2"/> Copilot</TabsTrigger>
                          <TabsTrigger value="test" className="text-sm rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"><ListTodo className="w-4 h-4 mr-2"/> Quiz Maker</TabsTrigger>
                          <TabsTrigger value="summary" className="text-sm rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"><AlignLeft className="w-4 h-4 mr-2"/> Executive Summary</TabsTrigger>
                      </TabsList>

                      {/* CHAT TAB */}
                      <TabsContent value="chat" className="flex-1 flex flex-col m-0 p-0 h-full overflow-hidden data-[state=inactive]:hidden relative">
                          <div className="flex-1 overflow-y-auto p-4 sm:p-6 min-h-0 space-y-6">
                              <div className="max-w-3xl mx-auto space-y-6 pb-4 w-full">
                                  {messages.map((msg, i) => (
                                      <div key={i} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                                          {msg.role === 'model' && <div className="bg-primary/10 border border-primary/20 p-2.5 rounded-xl h-fit shadow-sm"><Bot className="h-5 w-5 text-primary" /></div>}
                                          <div className={`p-4 rounded-2xl max-w-[85%] text-[15px] leading-relaxed shadow-sm flex flex-col gap-3 ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-card border rounded-tl-sm prose dark:prose-invert prose-p:leading-relaxed prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800'}`}>
                                              {/* Main text content */}
                                              {msg.role === 'user' ? msg.content : <ReactMarkdown>{msg.content}</ReactMarkdown>}
                                              
                                              {/* Beautiful Smart Attachment for Excerpts */}
                                              {msg.excerpt && (
                                                  <div className="bg-primary-foreground/10 border border-primary-foreground/20 rounded-xl p-3 text-sm mt-1">
                                                      <div className="flex items-center gap-2 font-semibold text-primary-foreground/90 mb-2 text-xs uppercase tracking-wider">
                                                          <Quote className="h-3 w-3" /> Attached Excerpt
                                                      </div>
                                                      <div className="text-primary-foreground/80 italic line-clamp-3 overflow-hidden text-ellipsis text-[13px] leading-relaxed border-l-2 border-primary-foreground/30 pl-3">
                                                          {msg.excerpt}
                                                      </div>
                                                  </div>
                                              )}
                                          </div>
                                          {msg.role === 'user' && <div className="bg-muted border p-2.5 rounded-xl h-fit shadow-sm"><User className="h-5 w-5 text-muted-foreground" /></div>}
                                      </div>
                                  ))}
                                  {isChatting && (
                                      <div className="flex gap-4 justify-start animate-in fade-in">
                                          <div className="bg-primary/10 border border-primary/20 p-2.5 rounded-xl h-fit shadow-sm"><Bot className="h-5 w-5 text-primary" /></div>
                                          <div className="p-5 rounded-2xl bg-card border rounded-tl-sm flex gap-2 items-center h-[56px] shadow-sm">
                                              <div className="h-2 w-2 bg-primary/40 rounded-full animate-bounce" />
                                              <div className="h-2 w-2 bg-primary/40 rounded-full animate-bounce delay-75" />
                                              <div className="h-2 w-2 bg-primary/40 rounded-full animate-bounce delay-150" />
                                          </div>
                                      </div>
                                  )}
                                  <div ref={scrollRef} />
                              </div>
                          </div>

                          {/* Chat Input & Smart Actions Area */}
                          <div className="bg-background/80 backdrop-blur-xl border-t p-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)] z-10">
                              <div className="max-w-3xl mx-auto">
                                  {/* Smart Actions Bar */}
                                  <div className="flex gap-2 overflow-x-auto pb-3 mb-1 no-scrollbar items-center">
                                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1 shrink-0">Smart Clipboard:</span>
                                      <Button variant="secondary" size="sm" className="h-8 text-xs rounded-full shrink-0 shadow-sm" onClick={() => handleSmartAction('explain')}>
                                          <Lightbulb className="w-3 h-3 mr-1.5 text-yellow-500" /> Explain Selection
                                      </Button>
                                      <Button variant="secondary" size="sm" className="h-8 text-xs rounded-full shrink-0 shadow-sm" onClick={() => handleSmartAction('summarize')}>
                                          <AlignLeft className="w-3 h-3 mr-1.5 text-blue-500" /> Summarize Selection
                                      </Button>
                                      <Button variant="secondary" size="sm" className="h-8 text-xs rounded-full shrink-0 shadow-sm" onClick={() => handleSmartAction('translate')}>
                                          <Languages className="w-3 h-3 mr-1.5 text-green-500" /> Translate Selection
                                      </Button>
                                  </div>

                                  <form onSubmit={e => { e.preventDefault(); handleSendMessage(); }} className="relative group">
                                      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-primary/10 rounded-2xl blur opacity-30 group-focus-within:opacity-100 transition duration-500"></div>
                                      <div className="relative flex items-end gap-2 bg-card border rounded-2xl p-1 shadow-sm focus-within:ring-1 focus-within:ring-primary/50 transition-all">
                                          <Textarea 
                                              value={chatInput} 
                                              onChange={e => setChatInput(e.target.value)}
                                              placeholder="Ask a question or type a custom prompt..." 
                                              className="min-h-[52px] max-h-[200px] border-0 focus-visible:ring-0 resize-y bg-transparent py-3 px-4 text-[15px]"
                                              onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                                          />
                                          <Button size="icon" type="submit" disabled={isChatting || !chatInput.trim()} className="h-10 w-10 mb-1 mr-1 rounded-xl shadow-md shrink-0">
                                              <Send className="h-4 w-4" />
                                          </Button>
                                      </div>
                                  </form>
                              </div>
                          </div>
                      </TabsContent>

                      {/* TEST TAB */}
                      <TabsContent value="test" className="flex-1 overflow-auto p-4 sm:p-8 m-0 bg-background data-[state=inactive]:hidden">
                          <div className="max-w-2xl mx-auto h-full flex flex-col">
                              {testState === "setup" && (
                                  <div className="space-y-8 mt-4 animate-in fade-in slide-in-from-bottom-4">
                                      <div className="text-center space-y-2">
                                          <div className="inline-flex p-3 bg-primary/10 rounded-full mb-2"><ListTodo className="h-8 w-8 text-primary"/></div>
                                          <h2 className="text-3xl font-bold">Generate Smart Quiz</h2>
                                          <p className="text-muted-foreground text-lg">Test your knowledge. The AI will design a targeted exam based on the core concepts.</p>
                                      </div>
                                      <Card className="shadow-lg border-primary/10 bg-card/50 backdrop-blur-sm">
                                          <CardContent className="space-y-6 pt-8">
                                              <div className="grid grid-cols-2 gap-6">
                                                  <div className="space-y-3">
                                                      <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Length</Label>
                                                      <Select value={questionCount} onValueChange={setQuestionCount}>
                                                          <SelectTrigger className="h-12 bg-background"><SelectValue /></SelectTrigger>
                                                          <SelectContent>
                                                              <SelectItem value="5">5 Questions</SelectItem>
                                                              <SelectItem value="10">10 Questions</SelectItem>
                                                              <SelectItem value="15">15 Questions</SelectItem>
                                                              <SelectItem value="20">20 Questions</SelectItem>
                                                          </SelectContent>
                                                      </Select>
                                                  </div>
                                                  <div className="space-y-3">
                                                      <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Language</Label>
                                                      <Select value={language} onValueChange={setLanguage}>
                                                          <SelectTrigger className="h-12 bg-background"><SelectValue /></SelectTrigger>
                                                          <SelectContent>
                                                              <SelectItem value="English">English</SelectItem>
                                                              <SelectItem value="Spanish">Spanish</SelectItem>
                                                              <SelectItem value="French">French</SelectItem>
                                                              <SelectItem value="German">German</SelectItem>
                                                          </SelectContent>
                                                      </Select>
                                                  </div>
                                              </div>
                                              <Button className="w-full h-14 text-lg font-semibold shadow-md rounded-xl" onClick={handleGenerateTest}>
                                                  Initialize Test <Sparkles className="ml-2 h-5 w-5" />
                                              </Button>
                                          </CardContent>
                                      </Card>
                                  </div>
                              )}

                              {testState === "generating" && (
                                  <div className="flex flex-col items-center justify-center h-full gap-6">
                                      <div className="relative">
                                          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse"></div>
                                          <Loader2 className="h-16 w-16 animate-spin text-primary relative z-10" />
                                      </div>
                                      <div className="text-center space-y-2">
                                          <p className="text-2xl font-bold">Synthesizing material...</p>
                                          <p className="text-muted-foreground">Crafting deep-thinking questions from your document.</p>
                                      </div>
                                  </div>
                              )}

                              {testState === "taking" && questions.length > 0 && (
                                  <div className="mt-4 flex flex-col h-full pb-4">
                                      <div className="flex items-center gap-4 mb-6">
                                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                                              <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${((currentQIndex) / questions.length) * 100}%` }} />
                                          </div>
                                          <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider shrink-0">
                                              Q {currentQIndex + 1} / {questions.length}
                                          </span>
                                      </div>

                                      <Card className="shadow-xl border-primary/20 flex-1 animate-in fade-in slide-in-from-right-8 bg-card/80 backdrop-blur-md">
                                          <CardHeader className="pb-6">
                                              <CardTitle className="text-2xl leading-relaxed">{questions[currentQIndex].question}</CardTitle>
                                          </CardHeader>
                                          <CardContent>
                                              <RadioGroup 
                                                  value={userAnswers[currentQIndex]} 
                                                  onValueChange={(val) => {
                                                      const newAns = [...userAnswers];
                                                      newAns[currentQIndex] = val;
                                                      setUserAnswers(newAns);
                                                  }}
                                                  className="space-y-3"
                                              >
                                                  {Object.entries(questions[currentQIndex].options).map(([key, value]) => (
                                                      <Label 
                                                          key={key}
                                                          htmlFor={`opt-${key}`}
                                                          className={`flex items-start space-x-4 p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${userAnswers[currentQIndex] === key ? 'border-primary bg-primary/5 shadow-md scale-[1.01]' : 'border-muted hover:border-primary/40 hover:bg-muted/50'}`}
                                                      >
                                                          <RadioGroupItem value={key} id={`opt-${key}`} className="mt-1 shrink-0" />
                                                          <span className="text-base font-medium leading-relaxed">{value}</span>
                                                      </Label>
                                                  ))}
                                              </RadioGroup>
                                          </CardContent>
                                      </Card>
                                      
                                      <div className="mt-6 flex justify-end">
                                          <Button size="lg" className="h-14 px-10 text-lg rounded-xl shadow-lg" disabled={!userAnswers[currentQIndex]} onClick={() => {
                                              if (currentQIndex < questions.length - 1) setCurrentQIndex(p => p + 1);
                                              else finishTest();
                                          }}>
                                              {currentQIndex === questions.length - 1 ? "Complete Exam" : "Next Question"} <ArrowRight className="ml-2 h-5 w-5" />
                                          </Button>
                                      </div>
                                  </div>
                              )}

                              {testState === "results" && (
                                  <div className="space-y-8 pb-10 animate-in fade-in slide-in-from-bottom-8 mt-4">
                                      <div className="text-center p-10 bg-gradient-to-br from-muted/50 to-muted border rounded-3xl shadow-inner relative overflow-hidden">
                                          <div className="absolute top-0 right-0 p-8 opacity-10"><CheckCircle className="w-32 h-32"/></div>
                                          <h2 className="text-6xl font-black text-primary mb-4 drop-shadow-sm">
                                              {questions.length - wrongAnswers.length} <span className="text-4xl text-muted-foreground">/ {questions.length}</span>
                                          </h2>
                                          <p className="text-xl font-medium text-muted-foreground">Score Finalized.</p>
                                      </div>

                                      <Card className="border-border shadow-xl overflow-hidden rounded-2xl">
                                          <CardHeader className="bg-muted/30 pb-6 border-b">
                                              <CardTitle className="text-2xl flex items-center justify-between">
                                                  <span className="flex items-center gap-2"><ListTodo className="h-6 w-6 text-primary" /> Test Review</span>
                                                  <span className="text-sm font-normal text-muted-foreground">{wrongAnswers.length} mistakes</span>
                                              </CardTitle>
                                          </CardHeader>
                                          <CardContent className="p-0">
                                              <ScrollArea className="h-[400px]">
                                                  <div className="p-6 space-y-6">
                                                      {questions.map((q, i) => {
                                                          const isCorrect = userAnswers[i] === q.answer;
                                                          return (
                                                              <div key={i} className={`p-6 border rounded-xl shadow-sm ${isCorrect ? 'bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900/50' : 'bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50'}`}>
                                                                  <p className="font-bold text-lg mb-4 flex items-start gap-3">
                                                                      <span className="mt-1">{isCorrect ? <CheckCircle className="w-5 h-5 text-green-600 shrink-0"/> : <XCircle className="w-5 h-5 text-destructive shrink-0"/>}</span>
                                                                      {q.question}
                                                                  </p>
                                                                  <div className="space-y-3 ml-8 text-[15px]">
                                                                      {!isCorrect && (
                                                                          <div className="flex items-center gap-2 text-destructive font-medium bg-background/50 p-2 rounded border border-red-100 dark:border-red-900">
                                                                              <span>Your Answer:</span> <span className="line-through opacity-80">{q.options[userAnswers[i] as keyof typeof q.options]}</span>
                                                                          </div>
                                                                      )}
                                                                      <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-bold bg-background/50 p-2 rounded border border-green-100 dark:border-green-900">
                                                                          <span>Correct Answer:</span> <span>{q.options[q.answer as keyof typeof q.options]}</span>
                                                                      </div>
                                                                      {q.explanation && (
                                                                          <div className="mt-4 pt-4 border-t border-border/50">
                                                                              <p className="text-muted-foreground leading-relaxed"><span className="font-semibold text-foreground">AI Explanation:</span> {q.explanation}</p>
                                                                          </div>
                                                                      )}
                                                                  </div>
                                                              </div>
                                                          );
                                                      })}
                                                  </div>
                                              </ScrollArea>
                                          </CardContent>
                                          <CardFooter className="bg-card border-t flex-col gap-6 pt-8 pb-8">
                                              <div className="w-full space-y-4">
                                                  <h4 className="font-semibold text-lg border-b pb-2">Export to Flashcards</h4>
                                                  
                                                  <RadioGroup value={saveOption} onValueChange={(val: any) => setSaveOption(val)} className="flex flex-col sm:flex-row gap-4 mb-4">
                                                      <Label htmlFor="save-mistakes" className={`flex-1 flex items-center justify-between border-2 p-4 rounded-xl cursor-pointer transition-all ${saveOption === 'mistakes' ? 'border-primary bg-primary/5 shadow-sm' : 'border-muted hover:bg-muted/50'}`}>
                                                          <div className="flex items-center gap-3">
                                                              <RadioGroupItem value="mistakes" id="save-mistakes" />
                                                              <div>
                                                                  <p className="font-semibold text-base">Save Mistakes Only</p>
                                                                  <p className="text-sm text-muted-foreground">Focus on weak spots ({wrongAnswers.length} cards)</p>
                                                              </div>
                                                          </div>
                                                      </Label>
                                                      <Label htmlFor="save-all" className={`flex-1 flex items-center justify-between border-2 p-4 rounded-xl cursor-pointer transition-all ${saveOption === 'all' ? 'border-primary bg-primary/5 shadow-sm' : 'border-muted hover:bg-muted/50'}`}>
                                                          <div className="flex items-center gap-3">
                                                              <RadioGroupItem value="all" id="save-all" />
                                                              <div>
                                                                  <p className="font-semibold text-base">Save All Questions</p>
                                                                  <p className="text-sm text-muted-foreground">Full comprehensive review ({questions.length} cards)</p>
                                                              </div>
                                                          </div>
                                                      </Label>
                                                  </RadioGroup>

                                                  <div className="flex flex-col sm:flex-row gap-4 items-end">
                                                      <div className="flex-1 w-full space-y-2">
                                                          <Label className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Destination Deck</Label>
                                                          <Select value={selectedDeckId} onValueChange={setSelectedDeckId}>
                                                              <SelectTrigger className="h-12 bg-background text-base"><SelectValue placeholder="Select a deck..." /></SelectTrigger>
                                                              <SelectContent>
                                                                  {userDecks.map(deck => (
                                                                      <SelectItem key={deck.id} value={deck.id}>{deck.name}</SelectItem>
                                                                  ))}
                                                              </SelectContent>
                                                          </Select>
                                                      </div>
                                                      <Button onClick={handleSaveToDeck} disabled={isSaving || !selectedDeckId || (saveOption === 'mistakes' && wrongAnswers.length === 0)} className="w-full sm:w-auto h-12 px-8 font-semibold shadow-md">
                                                          {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Save className="mr-2 h-5 w-5" />} Export Cards
                                                      </Button>
                                                  </div>
                                              </div>
                                          </CardFooter>
                                      </Card>
                                      
                                      <Button variant="ghost" className="w-full h-14 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl" onClick={() => setTestState("setup")}>
                                          Start a New Session
                                      </Button>
                                  </div>
                              )}
                          </div>
                      </TabsContent>

                      {/* SUMMARY TAB */}
                      <TabsContent value="summary" className="flex-1 overflow-auto p-4 sm:p-8 m-0 bg-background data-[state=inactive]:hidden">
                          <div className="max-w-3xl mx-auto h-full flex flex-col">
                              {!summary && !isGeneratingSummary && (
                                  <div className="flex flex-col items-center justify-center h-full text-center space-y-6 animate-in fade-in slide-in-from-bottom-4">
                                      <div className="bg-primary/10 p-5 rounded-3xl shadow-inner border border-primary/10">
                                          <AlignLeft className="h-10 w-10 text-primary" />
                                      </div>
                                      <div className="space-y-2">
                                          <h2 className="text-3xl font-bold">Executive Intelligence</h2>
                                          <p className="text-muted-foreground text-lg max-w-md mx-auto">Generate a high-level, perfectly structured summary of the entire document instantly.</p>
                                      </div>
                                      <Button size="lg" onClick={handleGenerateSummary} className="mt-4 h-14 px-10 text-lg rounded-xl shadow-lg shadow-primary/20">
                                          Generate Analysis <Sparkles className="ml-2 h-5 w-5" />
                                      </Button>
                                  </div>
                              )}

                              {isGeneratingSummary && (
                                  <div className="flex flex-col items-center justify-center h-full gap-6">
                                      <div className="relative">
                                          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse"></div>
                                          <Loader2 className="h-16 w-16 animate-spin text-primary relative z-10" />
                                      </div>
                                      <div className="text-center space-y-2">
                                          <p className="text-2xl font-bold">Extracting key insights...</p>
                                          <p className="text-muted-foreground">Reading the full context of the document.</p>
                                      </div>
                                  </div>
                              )}

                              {summary && (
                                  <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-8 mt-4">
                                      <div className="flex justify-between items-center bg-muted/30 p-4 rounded-xl border">
                                          <div className="flex items-center gap-3">
                                              <div className="bg-primary/20 p-2 rounded-lg"><AlignLeft className="h-5 w-5 text-primary"/></div>
                                              <h2 className="text-xl font-bold">Executive Summary</h2>
                                          </div>
                                          <Button variant="outline" size="sm" onClick={handleGenerateSummary} className="h-9">Regenerate</Button>
                                      </div>
                                      <Card className="border-border shadow-xl">
                                          <CardContent className="p-8 sm:p-10">
                                              <div className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-bold prose-h1:text-3xl prose-h2:text-2xl prose-a:text-primary prose-li:marker:text-primary">
                                                  <ReactMarkdown>{summary}</ReactMarkdown>
                                              </div>
                                          </CardContent>
                                      </Card>
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