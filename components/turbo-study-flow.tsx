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
import { Loader2, FileText, Send, Bot, User, ArrowRight, CheckCircle, XCircle, Save, Sparkles, Upload, AlignLeft, MessageSquare, ListTodo, Lightbulb, Languages, Zap, Quote, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import ReactMarkdown from "react-markdown";

// Configuración del Worker para react-pdf
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type Message = { role: "user" | "model"; content: string; excerpt?: string };
type Question = { question: string; options: { [key: string]: string }; answer: string; explanation?: string };
type WrongAnswer = Question & { userAnswer: string };

export function TurboStudyFlow({ userDecks }: { userDecks: { id: string, name: string }[] }) {
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  // Custom PDF Viewer State
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.2);
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([{ role: "model", content: "Hi! I'm your AI tutor. \n\n**✨ Magic Feature:** Select any text directly on the document to instantly translate, summarize or explain it!" }]);
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

  // Cerrar el menú flotante si hacemos clic fuera
  useEffect(() => {
      const handleMouseDown = () => {
          if (selection) setSelection(null);
      };
      document.addEventListener("mousedown", handleMouseDown);
      return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [selection]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
        return toast({ title: "File too large", description: "Please upload a PDF smaller than 4MB.", variant: "destructive" });
    }

    setIsProcessingFile(true);
    setFileName(file.name);
    setPdfFile(file);
    
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
    setIsReady(false);
    setPdfBase64(null);
    setPdfFile(null);
    setSummary(null);
    setPageNumber(1);
    setScale(1.2);
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
      setSelection(null); // Hide popup

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

  // --- FLOATING MENU HIGHLIGHT DETECTOR ---
  const handleTextSelection = (e: React.MouseEvent) => {
      // Small delay to allow double-click selection to register
      setTimeout(() => {
          const sel = window.getSelection();
          if (!sel || sel.isCollapsed) return;

          const text = sel.toString().trim();
          if (!text) return;

          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();

          setSelection({
              text,
              x: rect.left + rect.width / 2,
              y: rect.top - 10
          });
      }, 10);
  };

  const executeActionOnSelection = (actionType: "explain" | "summarize" | "translate") => {
      if (!selection) return;
      
      let prompt = "";
      if (actionType === "explain") prompt = `Please explain the selected excerpt in simple terms.`;
      if (actionType === "summarize") prompt = `Please provide a brief, easy-to-understand summary of the selected excerpt.`;
      if (actionType === "translate") prompt = `Please translate the selected excerpt to my native language and briefly explain its context.`;

      handleSendMessage(prompt, selection.text);
  };

  const handleGenerateTest = async () => { /* ... (Same logic as before) ... */ 
      setTestState("generating");
      try {
          const res = await fetch("/api/turbo-study", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate_test", questionCount, language, pdfBase64 }) });
          const result = await res.json();
          if (result.error) throw new Error(result.error);
          setQuestions(result.data); setUserAnswers(new Array(result.data.length).fill("")); setCurrentQIndex(0); setTestState("taking");
      } catch (e: any) {
          toast({ title: "Error generating test", description: e.message, variant: "destructive" }); setTestState("setup");
      }
  };

  const handleGenerateSummary = async () => { /* ... (Same logic as before) ... */ 
      setIsGeneratingSummary(true);
      try {
          const res = await fetch("/api/turbo-study", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "summarize", pdfBase64 }) });
          const result = await res.json();
          if (result.error) throw new Error(result.error);
          setSummary(result.data);
      } catch (e: any) {
          toast({ title: "Error generating summary", description: e.message, variant: "destructive" });
      } finally {
          setIsGeneratingSummary(false);
      }
  };

  const finishTest = () => { /* ... (Same logic as before) ... */ 
      const wrongs: WrongAnswer[] = [];
      questions.forEach((q, idx) => { if (userAnswers[idx] !== q.answer) { wrongs.push({ ...q, userAnswer: userAnswers[idx] }); } });
      setWrongAnswers(wrongs); setTestState("results");
  };

  const handleSaveToDeck = async () => { /* ... (Same logic as before) ... */ 
    if (!selectedDeckId) return toast({ title: "Select a deck", variant: "destructive" });
    setIsSaving(true);
    const cardsToProcess = saveOption === "all" ? questions : wrongAnswers;
    const formattedCards = cardsToProcess.map((q: any) => ({ front: q.question, back: `**Correct Answer:** ${q.options[q.answer]}\n\n*Explanation:* ${q.explanation || "Generated by Turbo Study AI"}` }));
    try {
      const res = await fetch("/api/save-quiz-cards", { method: "POST", body: JSON.stringify({ deckId: selectedDeckId, newDeckName: null, cards: formattedCards }), headers: { "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("Failed to save");
      toast({ title: "Cards Saved!", description: `Successfully added ${formattedCards.length} cards to your deck.` });
    } catch (e) {
      toast({ title: "Error saving cards", variant: "destructive" });
    } finally { setIsSaving(false); }
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
                          </div>
                      </CardContent>
                  </Card>
              </div>
          </div>
      );
  }

  return (
      <div className="flex flex-col h-full w-full bg-background/95 relative">
          
          {/* FLOATING ACTION MENU (Magic Highlight popup) */}
          {selection && (
              <div 
                  className="fixed z-[100] flex gap-1.5 items-center bg-background/95 backdrop-blur-xl border shadow-2xl p-1.5 rounded-xl animate-in fade-in zoom-in-95 pointer-events-auto"
                  style={{ top: Math.max(10, selection.y - 60), left: selection.x, transform: 'translateX(-50%)' }}
                  onMouseDown={(e) => e.stopPropagation()} // Prevent clicking the menu from hiding it
              >
                  <Button size="sm" variant="ghost" className="h-9 px-3 rounded-lg hover:bg-yellow-500/10 hover:text-yellow-600 transition-colors" onClick={() => executeActionOnSelection('explain')}>
                      <Lightbulb className="w-4 h-4 mr-2 text-yellow-500" /> Explain
                  </Button>
                  <div className="w-[1px] h-6 bg-border mx-1"></div>
                  <Button size="sm" variant="ghost" className="h-9 px-3 rounded-lg hover:bg-blue-500/10 hover:text-blue-600 transition-colors" onClick={() => executeActionOnSelection('summarize')}>
                      <AlignLeft className="w-4 h-4 mr-2 text-blue-500" /> Summarize
                  </Button>
                  <div className="w-[1px] h-6 bg-border mx-1"></div>
                  <Button size="sm" variant="ghost" className="h-9 px-3 rounded-lg hover:bg-green-500/10 hover:text-green-600 transition-colors" onClick={() => executeActionOnSelection('translate')}>
                      <Languages className="w-4 h-4 mr-2 text-green-500" /> Translate
                  </Button>
              </div>
          )}

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
              
              {/* Left Panel: CUSTOM PDF VIEWER */}
              <ResizablePanel defaultSize={50} minSize={30} className="bg-zinc-100 dark:bg-zinc-950 hidden md:flex flex-col border-r relative z-10">
                  {/* PDF Toolbar */}
                  <div className="h-12 bg-background/50 border-b flex items-center justify-between px-4 shrink-0 backdrop-blur-md">
                      <div className="flex items-center gap-2">
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPageNumber(p => Math.max(1, p - 1))} disabled={pageNumber <= 1}>
                              <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <span className="text-sm font-medium w-24 text-center">
                              Page {pageNumber} of {numPages || '-'}
                          </span>
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPageNumber(p => Math.min(numPages, p + 1))} disabled={pageNumber >= numPages}>
                              <ChevronRight className="h-4 w-4" />
                          </Button>
                      </div>
                      <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setScale(s => Math.max(0.5, s - 0.2))}>
                              <ZoomOut className="h-4 w-4" />
                          </Button>
                          <span className="text-xs font-semibold w-12 text-center">{Math.round(scale * 100)}%</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setScale(s => Math.min(3, s + 0.2))}>
                              <ZoomIn className="h-4 w-4" />
                          </Button>
                      </div>
                  </div>

                  {/* PDF Content Area */}
                  <ScrollArea className="flex-1 w-full" onMouseUp={handleTextSelection}>
                      <div className="flex justify-center p-8 min-h-full">
                          {pdfFile && (
                              <Document 
                                  file={pdfFile} 
                                  onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                                  loading={
                                      <div className="flex flex-col items-center justify-center mt-20 text-muted-foreground">
                                          <Loader2 className="h-8 w-8 animate-spin mb-4" />
                                          <p>Rendering native PDF...</p>
                                      </div>
                                  }
                                  className="flex flex-col items-center"
                              >
                                  <div className="shadow-2xl border border-border/50 rounded-sm overflow-hidden bg-white">
                                      <Page 
                                          pageNumber={pageNumber} 
                                          scale={scale} 
                                          renderTextLayer={true}
                                          renderAnnotationLayer={true}
                                          className="pdf-page-container"
                                      />
                                  </div>
                              </Document>
                          )}
                      </div>
                  </ScrollArea>
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

                          {/* Chat Input */}
                          <div className="bg-background/80 backdrop-blur-xl border-t p-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)] z-10">
                              <div className="max-w-3xl mx-auto">
                                  <form onSubmit={e => { e.preventDefault(); handleSendMessage(); }} className="relative group">
                                      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-primary/10 rounded-2xl blur opacity-30 group-focus-within:opacity-100 transition duration-500"></div>
                                      <div className="relative flex items-end gap-2 bg-card border rounded-2xl p-1 shadow-sm focus-within:ring-1 focus-within:ring-primary/50 transition-all">
                                          <Textarea 
                                              value={chatInput} 
                                              onChange={e => setChatInput(e.target.value)}
                                              placeholder="Ask a question or select text on the PDF to use Magic Actions..." 
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

                      {/* TEST TAB (Igual que antes) */}
                      <TabsContent value="test" className="flex-1 overflow-auto p-4 sm:p-8 m-0 bg-background data-[state=inactive]:hidden">
                          {/* ... contenido del tab de test previo (no modificado para no alargar el código) ... */}
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
                              {/* ... el resto del test/resultados es exactamente igual ... */}
                          </div>
                      </TabsContent>

                      {/* SUMMARY TAB (Igual que antes) */}
                      <TabsContent value="summary" className="flex-1 overflow-auto p-4 sm:p-8 m-0 bg-background data-[state=inactive]:hidden">
                          {/* ... contenido del tab de summary previo ... */}
                      </TabsContent>
                  </Tabs>
              </ResizablePanel>
          </ResizablePanelGroup>
      </div>
  );
}