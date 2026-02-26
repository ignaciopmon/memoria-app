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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, FileText, Send, Bot, User, ArrowRight, CheckCircle, XCircle, Save, Sparkles, Upload, AlignLeft, MessageSquare, ListTodo, Lightbulb, Languages, Zap, Quote, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, GraduationCap, PlusCircle, Baby, Book, Plus, FolderOpen } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import ReactMarkdown from "react-markdown";

import { createClient } from "@/lib/supabase/client";
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const supabase = createClient();

type Message = { role: "user" | "model"; content: string; excerpt?: string };
type Question = { question: string; options: { [key: string]: string }; answer: string; explanation?: string };
type WrongAnswer = Question & { userAnswer: string };

type Notebook = { id: string; name: string; created_at: string; file_path?: string; file_name?: string };

export function TurboStudyFlow({ userDecks, userId }: { userDecks: { id: string, name: string }[], userId: string }) {
  // Notebook System State
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [activeNotebook, setActiveNotebook] = useState<Notebook | null>(null);
  const [isCreatingNotebook, setIsCreatingNotebook] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState("");
  const [isLoadingNotebooks, setIsLoadingNotebooks] = useState(true);

  // Document State
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
  const popupRef = useRef<HTMLDivElement>(null);

  // Direct Flashcard Modal State
  const [isFlashcardModalOpen, setIsFlashcardModalOpen] = useState(false);
  const [isGeneratingFlashcard, setIsGeneratingFlashcard] = useState(false);
  const [flashcardDraft, setFlashcardDraft] = useState({ front: "", back: "" });
  const [flashcardDeckId, setFlashcardDeckId] = useState("");

  // AI Workspace State
  const [messages, setMessages] = useState<Message[]>([{ role: "model", content: "Hi! I'm your AI tutor. \n\n**✨ Magic Canvas:** Select any text on the document to instantly translate, explain, or create flashcards!" }]);
  const [chatInput, setChatInput] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [testState, setTestState] = useState<"setup" | "generating" | "taking" | "results">("setup");
  const [questionCount, setQuestionCount] = useState("5");
  const [language, setLanguage] = useState("English");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<string[]>([]);
  const [wrongAnswers, setWrongAnswers] = useState<WrongAnswer[]>([]);
  const [saveOption, setSaveOption] = useState<"mistakes" | "all">("mistakes");
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  
  const [summary, setSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [studyGuide, setStudyGuide] = useState<string | null>(null);
  const [isGeneratingGuide, setIsGeneratingGuide] = useState(false);

  const { toast } = useToast();

  // --- PERSISTENCE: INITIAL LOAD ---
  useEffect(() => {
    const fetchNotebooks = async () => {
        setIsLoadingNotebooks(true);
        const { data } = await supabase.from('notebooks').select('*').eq('user_id', userId).order('created_at', { ascending: false });
        if (data) setNotebooks(data);
        setIsLoadingNotebooks(false);
    };
    fetchNotebooks();
  }, [userId]);

  // --- PERSISTENCE: AUTO-SAVE ASSETS ---
  useEffect(() => {
    if (activeNotebook && messages.length > 1) {
        supabase.from('notebook_assets')
            .upsert({ notebook_id: activeNotebook.id, type: 'chat', content: messages }, { onConflict: 'notebook_id, type' })
            .then();
    }
  }, [messages, activeNotebook]);

  useEffect(() => {
    if (activeNotebook && summary) {
        supabase.from('notebook_assets')
            .upsert({ notebook_id: activeNotebook.id, type: 'summary', content: summary }, { onConflict: 'notebook_id, type' })
            .then();
    }
  }, [summary, activeNotebook]);

  useEffect(() => {
    if (activeNotebook && studyGuide) {
        supabase.from('notebook_assets')
            .upsert({ notebook_id: activeNotebook.id, type: 'guide', content: studyGuide }, { onConflict: 'notebook_id, type' })
            .then();
    }
  }, [studyGuide, activeNotebook]);

  // UI Effects
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages, summary, studyGuide]);

  useEffect(() => {
      const handleGlobalMouseDown = (e: MouseEvent) => {
          if (popupRef.current && popupRef.current.contains(e.target as Node)) return;
          setSelection(null);
      };
      document.addEventListener("mousedown", handleGlobalMouseDown);
      return () => document.removeEventListener("mousedown", handleGlobalMouseDown);
  }, []);

  const resetWorkspace = () => {
    setIsReady(false); setPdfBase64(null); setPdfFile(null); setSummary(null); setStudyGuide(null);
    setPageNumber(1); setScale(1.2); setTestState("setup"); setFileName("");
    setMessages([{ role: "model", content: "Hi! I'm your AI tutor. \n\n**✨ Magic Canvas:** Select any text on the document to instantly translate, explain, or create flashcards!" }]);
  };

  const handleExitNotebook = () => {
      resetWorkspace();
      setActiveNotebook(null);
  };

  // --- ACTIONS ---
  const handleCreateNotebook = async (e: React.FormEvent) => {
      e.preventDefault();
      if(!newNotebookName.trim()) return;
      
      const { data, error } = await supabase
          .from('notebooks')
          .insert({ user_id: userId, name: newNotebookName })
          .select()
          .single();

      if (error || !data) {
          toast({ title: "Error creating notebook", variant: "destructive" });
          return;
      }

      setNotebooks([data, ...notebooks]);
      setActiveNotebook(data);
      setIsCreatingNotebook(false);
      setNewNotebookName("");
  };

  const openNotebook = async (nb: Notebook) => {
      resetWorkspace();
      setActiveNotebook(nb);

      if (nb.file_path) {
          setIsProcessingFile(true);
          setFileName(nb.file_name || "Document.pdf");

          // 1. Download File
          const { data, error } = await supabase.storage.from('notebook_files').download(nb.file_path);
          if (!error && data) {
              const file = new File([data], nb.file_name || "Document.pdf", { type: 'application/pdf' });
              setPdfFile(file);
              const reader = new FileReader();
              reader.onload = () => {
                  const base64String = (reader.result as string).split(',')[1];
                  setPdfBase64(base64String);
                  setIsProcessingFile(false);
                  setIsReady(true);
              };
              reader.readAsDataURL(file);
          } else {
              setIsProcessingFile(false);
              toast({ title: "Error loading document from cloud", variant: "destructive" });
          }

          // 2. Load Assets (Chats, Guides, etc)
          const { data: assets } = await supabase.from('notebook_assets').select('*').eq('notebook_id', nb.id);
          if (assets && assets.length > 0) {
              const chatAsset = assets.find(a => a.type === 'chat');
              if (chatAsset) setMessages(chatAsset.content);

              const guideAsset = assets.find(a => a.type === 'guide');
              if (guideAsset) setStudyGuide(guideAsset.content);

              const summaryAsset = assets.find(a => a.type === 'summary');
              if (summaryAsset) setSummary(summaryAsset.content);
          }
      }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeNotebook) return;
    if (file.size > 10 * 1024 * 1024) return toast({ title: "File too large", variant: "destructive" });

    setIsProcessingFile(true);

    // 1. Upload to Supabase Storage
    const filePath = `${userId}/${activeNotebook.id}/${file.name}`;
    const { error: uploadError } = await supabase.storage.from('notebook_files').upload(filePath, file, { upsert: true });

    if (uploadError) {
        toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
        setIsProcessingFile(false);
        return;
    }

    // 2. Update DB Notebook Record
    await supabase.from('notebooks').update({ file_path: filePath, file_name: file.name }).eq('id', activeNotebook.id);

    // Update Local State
    const updatedNb = { ...activeNotebook, file_path: filePath, file_name: file.name };
    setActiveNotebook(updatedNb);
    setNotebooks(notebooks.map(n => n.id === activeNotebook.id ? updatedNb : n));
    
    setFileName(file.name);
    setPdfFile(file);
    
    const reader = new FileReader();
    reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        setPdfBase64(base64String);
        setIsProcessingFile(false);
        setIsReady(true);
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async (customPrompt?: string, excerptData?: string, actionType: string = "chat") => {
      const finalInput = customPrompt || chatInput;
      if (!finalInput.trim()) return;
      
      const newMessage: Message = { role: "user", content: finalInput, excerpt: excerptData };
      const newMessages = [...messages, newMessage];
      setMessages(newMessages);
      if(!customPrompt) setChatInput("");
      setIsChatting(true);
      
      setSelection(null);
      window.getSelection()?.removeAllRanges();

      const apiMessages = newMessages.map(msg => ({
          role: msg.role,
          content: msg.excerpt ? `${msg.content}\n\n[USER SELECTED EXCERPT]:\n"""\n${msg.excerpt}\n"""` : msg.content
      }));

      try {
          const res = await fetch("/api/turbo-study", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: actionType, messages: apiMessages, pdfBase64 })
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          setMessages([...newMessages, { role: "model", content: data.data }]);
      } catch (e: any) {
          toast({ title: "Chat Error", description: e.message, variant: "destructive" });
      } finally { setIsChatting(false); }
  };

  const handleTextSelection = () => {
      setTimeout(() => {
          const sel = window.getSelection();
          if (!sel || sel.isCollapsed) return;
          const text = sel.toString().trim();
          if (!text) return;
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          setSelection({ text, x: rect.left + rect.width / 2, y: rect.top - 10 });
      }, 50);
  };

  const generateDirectFlashcard = async (text: string) => {
      setIsFlashcardModalOpen(true);
      setIsGeneratingFlashcard(true);
      setSelection(null);
      setFlashcardDraft({ front: "", back: "" });

      try {
          const res = await fetch("/api/turbo-study", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "create_flashcard", messages: [{ role: "user", content: `Create a flashcard from this text: "${text}"` }] })
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error);

          const resultStr = data.data;
          const frontMatch = resultStr.match(/\*\*Front:\*\*\s*([\s\S]+?)(?=\*\*Back:\*\*|$)/i);
          const backMatch = resultStr.match(/\*\*Back:\*\*\s*([\s\S]+)$/i);
          
          setFlashcardDraft({ front: frontMatch ? frontMatch[1].trim() : "Concept from text", back: backMatch ? backMatch[1].trim() : resultStr });
      } catch (e: any) {
          toast({ title: "Error generating flashcard", variant: "destructive" });
          setIsFlashcardModalOpen(false);
      } finally { setIsGeneratingFlashcard(false); }
  };

  const saveDirectFlashcard = async () => {
      if (!flashcardDeckId || !flashcardDraft.front || !flashcardDraft.back) return;
      setIsSaving(true);
      try {
          const res = await fetch("/api/save-quiz-cards", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ deckId: flashcardDeckId, cards: [flashcardDraft] })
          });
          if (!res.ok) throw new Error("Failed to save flashcard");
          toast({ title: "Flashcard Saved!", description: "Successfully added to your deck." });
          setIsFlashcardModalOpen(false);
      } catch (e) {
          toast({ title: "Error", variant: "destructive" });
      } finally { setIsSaving(false); }
  };

  const executeActionOnSelection = (actionType: "explain" | "summarize" | "translate" | "eli5" | "flashcard") => {
      if (!selection) return;
      if (actionType === "flashcard") { generateDirectFlashcard(selection.text); return; }
      
      let prompt = "";
      if (actionType === "explain") prompt = `Please explain the selected excerpt in detail.`;
      if (actionType === "eli5") prompt = `Explain the selected text as if I were a 5-year-old.`;
      if (actionType === "summarize") prompt = `Please provide a brief summary of the selected excerpt.`;
      if (actionType === "translate") prompt = `Please translate the selected excerpt to my native language.`;

      handleSendMessage(prompt, selection.text, "chat");
  };

  const handleGenerateTest = async () => { 
      setTestState("generating");
      try {
          const res = await fetch("/api/turbo-study", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate_test", questionCount, language, pdfBase64 }) });
          const result = await res.json();
          if (result.error) throw new Error(result.error);
          setQuestions(result.data); setUserAnswers(new Array(result.data.length).fill("")); setCurrentQIndex(0); setTestState("taking");
      } catch (e: any) { toast({ title: "Error", variant: "destructive" }); setTestState("setup"); }
  };

  const handleGenerateSummary = async () => { 
      setIsGeneratingSummary(true);
      try {
          const res = await fetch("/api/turbo-study", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "summarize", pdfBase64 }) });
          const result = await res.json();
          if (result.error) throw new Error(result.error);
          setSummary(result.data);
      } catch (e: any) { toast({ title: "Error", variant: "destructive" }); } finally { setIsGeneratingSummary(false); }
  };

  const handleGenerateGuide = async () => { 
      setIsGeneratingGuide(true);
      try {
          const res = await fetch("/api/turbo-study", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "generate_guide", language, pdfBase64 }) });
          const result = await res.json();
          if (result.error) throw new Error(result.error);
          setStudyGuide(result.data);
      } catch (e: any) { toast({ title: "Error", variant: "destructive" }); } finally { setIsGeneratingGuide(false); }
  };

  const finishTest = () => { 
      const wrongs: WrongAnswer[] = [];
      questions.forEach((q, idx) => { if (userAnswers[idx] !== q.answer) { wrongs.push({ ...q, userAnswer: userAnswers[idx] }); } });
      setWrongAnswers(wrongs); setTestState("results");
  };

  const handleSaveToDeck = async () => { 
    if (!selectedDeckId) return toast({ title: "Select a deck", variant: "destructive" });
    setIsSaving(true);
    const cardsToProcess = saveOption === "all" ? questions : wrongAnswers;
    const formattedCards = cardsToProcess.map((q: any) => ({ front: q.question, back: `**Correct Answer:** ${q.options[q.answer]}\n\n*Explanation:* ${q.explanation || ""}` }));
    try {
      const res = await fetch("/api/save-quiz-cards", { method: "POST", body: JSON.stringify({ deckId: selectedDeckId, cards: formattedCards }), headers: { "Content-Type": "application/json" } });
      if (!res.ok) throw new Error("Failed to save");
      toast({ title: "Cards Saved!" });
    } catch (e) { toast({ title: "Error saving cards", variant: "destructive" }); } finally { setIsSaving(false); }
  };

  // --- RENDER VIEW: DASHBOARD ---
  if (!activeNotebook) {
      return (
          <div className="flex-1 flex overflow-hidden bg-muted/20 relative">
              <div className="flex-1 p-8 overflow-auto">
                  <div className="max-w-5xl mx-auto space-y-10">
                      <div className="flex items-center justify-between">
                          <div>
                              <h1 className="text-4xl font-extrabold tracking-tight flex items-center gap-3">
                                  <Book className="h-8 w-8 text-primary" /> My Notebooks
                              </h1>
                              <p className="text-muted-foreground mt-2 text-lg">Your intelligent workspaces and saved documents.</p>
                          </div>
                          <Button size="lg" className="rounded-xl shadow-lg" onClick={() => setIsCreatingNotebook(true)}>
                              <Plus className="mr-2 h-5 w-5" /> New Notebook
                          </Button>
                      </div>

                      {isCreatingNotebook && (
                          <Card className="border-primary/20 shadow-xl bg-card/50 backdrop-blur-sm animate-in fade-in slide-in-from-top-4">
                              <CardContent className="pt-6">
                                  <form onSubmit={handleCreateNotebook} className="flex gap-4 items-end">
                                      <div className="flex-1 space-y-2">
                                          <Label>Notebook Name</Label>
                                          <Input autoFocus placeholder="e.g. History 101, Marketing Strategy..." value={newNotebookName} onChange={e => setNewNotebookName(e.target.value)} className="h-12 text-lg" />
                                      </div>
                                      <Button type="submit" size="lg" className="h-12" disabled={!newNotebookName.trim()}>Create Workspace</Button>
                                      <Button type="button" variant="ghost" size="lg" className="h-12" onClick={() => setIsCreatingNotebook(false)}>Cancel</Button>
                                  </form>
                              </CardContent>
                          </Card>
                      )}

                      {isLoadingNotebooks ? (
                          <div className="flex justify-center py-20"><Loader2 className="h-10 w-10 animate-spin text-muted-foreground" /></div>
                      ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {notebooks.length === 0 && !isCreatingNotebook && (
                                  <div className="col-span-full py-20 text-center border-2 border-dashed rounded-3xl bg-muted/10">
                                      <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                                      <h3 className="text-xl font-bold mb-2">No Notebooks yet</h3>
                                      <p className="text-muted-foreground mb-6">Create your first intelligent workspace to start uploading documents.</p>
                                      <Button onClick={() => setIsCreatingNotebook(true)}><Plus className="mr-2 h-4 w-4"/> Create Notebook</Button>
                                  </div>
                              )}
                              {notebooks.map(nb => (
                                  <Card key={nb.id} className="group hover:border-primary/50 hover:shadow-xl transition-all cursor-pointer overflow-hidden border-border/50" onClick={() => openNotebook(nb)}>
                                      <div className={`h-2 w-full ${nb.file_path ? 'bg-gradient-to-r from-green-500/40 to-green-500/10' : 'bg-gradient-to-r from-primary/40 to-primary/10'}`} />
                                      <CardHeader>
                                          <CardTitle className="flex items-center gap-2 text-xl"><Book className="h-5 w-5 text-primary/60" /> {nb.name}</CardTitle>
                                          <CardDescription>Created {new Date(nb.created_at).toLocaleDateString()}</CardDescription>
                                      </CardHeader>
                                      <CardContent>
                                          <div className="flex gap-2 text-sm text-muted-foreground font-medium">
                                              {nb.file_path ? <span className="bg-green-500/10 text-green-600 px-2 py-1 rounded-md flex items-center gap-1"><FileText className="w-3 h-3"/> {nb.file_name}</span> : <span className="bg-muted px-2 py-1 rounded-md">Empty Workspace</span>}
                                          </div>
                                      </CardContent>
                                  </Card>
                              ))}
                          </div>
                      )}
                  </div>
              </div>
          </div>
      );
  }

  // --- RENDER VIEW: UPLOAD DOCUMENT INTO NOTEBOOK ---
  if (!isReady) {
      return (
          <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
              <Button variant="ghost" className="absolute top-4 left-4" onClick={handleExitNotebook}><ChevronLeft className="mr-2 h-4 w-4"/> Back to Notebooks</Button>
              <div className="max-w-2xl w-full animate-in fade-in slide-in-from-bottom-4">
                  <div className="mb-10 text-center space-y-3">
                      <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-2"><Zap className="h-8 w-8 text-primary fill-primary/20" /></div>
                      <h1 className="text-4xl font-extrabold tracking-tight">{activeNotebook.name} <span className="text-primary text-xl align-top font-bold uppercase tracking-widest bg-primary/10 px-2 py-1 rounded-md ml-1">Studio</span></h1>
                      <p className="text-muted-foreground text-lg max-w-lg mx-auto">Upload a document to this notebook. It will be saved securely to the cloud.</p>
                  </div>
                  <Card className="border-muted shadow-2xl bg-card/40 backdrop-blur-xl ring-1 ring-border/50">
                      <CardContent className="pt-8 pb-8">
                          <div className="flex flex-col items-center justify-center p-14 border-2 border-dashed border-primary/20 rounded-2xl bg-muted/10 hover:bg-muted/30 transition-all duration-300 group cursor-pointer relative overflow-hidden" onClick={() => !isProcessingFile && document.getElementById('pdf-upload')?.click()}>
                              {isProcessingFile ? (
                                  <div className="flex flex-col items-center text-primary z-10">
                                      <Loader2 className="h-12 w-12 animate-spin mb-4" />
                                      <p className="font-semibold text-lg tracking-wide">Syncing to Cloud Canvas...</p>
                                  </div>
                              ) : (
                                  <div className="flex flex-col items-center z-10 pointer-events-none">
                                      <div className="p-4 bg-background rounded-full shadow-sm mb-6 group-hover:scale-110 transition-transform duration-300"><Upload className="h-10 w-10 text-primary" /></div>
                                      <h3 className="text-2xl font-bold mb-2">Add Source Document</h3>
                                      <p className="text-muted-foreground text-center mb-6 max-w-sm">Drop your PDF here to persist it in this workspace.</p>
                                      <Button className="pointer-events-auto shadow-lg shadow-primary/20 h-12 px-8 text-md rounded-full" onClick={(e) => e.stopPropagation()}>
                                          <Label htmlFor="pdf-upload" className="cursor-pointer w-full h-full flex items-center">Select File</Label>
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

  // --- RENDER VIEW: ACTIVE WORKSPACE ---
  return (
      <div className="flex flex-col h-full w-full bg-background/95 relative">
          
          {/* FLOATING ACTION MENU */}
          {selection && (
              <div ref={popupRef} className="fixed z-[100] flex gap-1.5 items-center bg-background/95 backdrop-blur-xl border border-border/60 shadow-2xl p-1.5 rounded-xl animate-in fade-in zoom-in-95 pointer-events-auto" style={{ top: Math.max(10, selection.y - 60), left: selection.x, transform: 'translateX(-50%)' }}>
                  <Button size="sm" variant="ghost" className="h-9 px-3 rounded-lg hover:bg-yellow-500/10 hover:text-yellow-600 transition-colors" onMouseDown={(e) => { e.preventDefault(); executeActionOnSelection('explain'); }}><Lightbulb className="w-4 h-4 mr-2 text-yellow-500" /> Explain</Button>
                  <Button size="sm" variant="ghost" className="h-9 px-3 rounded-lg hover:bg-pink-500/10 hover:text-pink-600 transition-colors" onMouseDown={(e) => { e.preventDefault(); executeActionOnSelection('eli5'); }}><Baby className="w-4 h-4 mr-2 text-pink-500" /> ELI5</Button>
                  <div className="w-[1px] h-6 bg-border mx-1"></div>
                  <Button size="sm" variant="ghost" className="h-9 px-3 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors" onMouseDown={(e) => { e.preventDefault(); executeActionOnSelection('flashcard'); }}><PlusCircle className="w-4 h-4 mr-2 text-primary" /> Flashcard</Button>
              </div>
          )}

          {/* FLASHCARD DIRECT MODAL */}
          <Dialog open={isFlashcardModalOpen} onOpenChange={setIsFlashcardModalOpen}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-primary"/> Magic Flashcard</DialogTitle>
                    <DialogDescription>Review and save directly to your decks.</DialogDescription>
                </DialogHeader>
                
                {isGeneratingFlashcard ? (
                    <div className="py-12 flex flex-col items-center justify-center space-y-4">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-muted-foreground font-medium animate-pulse">Extracting concepts...</p>
                    </div>
                ) : (
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Front (Question)</Label>
                            <Input value={flashcardDraft.front} onChange={e => setFlashcardDraft({...flashcardDraft, front: e.target.value})} className="font-medium"/>
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Back (Answer)</Label>
                            <Textarea value={flashcardDraft.back} onChange={e => setFlashcardDraft({...flashcardDraft, back: e.target.value})} className="min-h-[100px] resize-none" />
                        </div>
                        <div className="space-y-2 pt-2 border-t">
                            <Label className="text-xs font-bold uppercase text-muted-foreground">Destination Deck</Label>
                            <Select value={flashcardDeckId} onValueChange={setFlashcardDeckId}>
                                <SelectTrigger><SelectValue placeholder="Select a deck..." /></SelectTrigger>
                                <SelectContent>
                                    {userDecks.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                )}

                <DialogFooter className="sm:justify-end">
                    <Button variant="outline" onClick={() => setIsFlashcardModalOpen(false)}>Cancel</Button>
                    <Button onClick={saveDirectFlashcard} disabled={isGeneratingFlashcard || !flashcardDeckId || isSaving}>
                        {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <Save className="h-4 w-4 mr-2"/>} Save Card
                    </Button>
                </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Top Navbar */}
          <div className="h-14 bg-background/80 backdrop-blur-md border-b flex justify-between items-center px-4 shrink-0 shadow-sm z-20">
              <div className="flex items-center gap-4 overflow-hidden">
                  <Button variant="ghost" size="sm" className="h-8 px-2" onClick={handleExitNotebook}>
                      <ChevronLeft className="h-4 w-4 mr-1"/> My Notebooks
                  </Button>
                  <div className="h-4 w-[1px] bg-border"></div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary/80">
                      <Book className="h-4 w-4"/> {activeNotebook.name}
                  </div>
                  <div className="flex items-center gap-2 opacity-50">
                      <ChevronRight className="h-4 w-4" />
                      <FileText className="h-4 w-4" />
                      <span className="text-xs truncate max-w-[150px]">{fileName}</span>
                  </div>
              </div>
          </div>

          {/* Main Workspace */}
          <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
              
              {/* Left Panel: PDF VIEWER */}
              <ResizablePanel defaultSize={50} minSize={30} className="bg-zinc-100 dark:bg-zinc-900/50 hidden md:flex flex-col border-r relative z-10">
                  <div className="h-12 bg-background/80 border-b flex items-center justify-between px-4 shrink-0 backdrop-blur-md z-20">
                      <div className="flex items-center gap-2">
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPageNumber(p => Math.max(1, p - 1))} disabled={pageNumber <= 1}><ChevronLeft className="h-4 w-4" /></Button>
                          <span className="text-sm font-medium w-24 text-center">Page {pageNumber} of {numPages || '-'}</span>
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPageNumber(p => Math.min(numPages, p + 1))} disabled={pageNumber >= numPages}><ChevronRight className="h-4 w-4" /></Button>
                      </div>
                      <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setScale(s => Math.max(0.5, s - 0.2))}><ZoomOut className="h-4 w-4" /></Button>
                          <span className="text-xs font-semibold w-12 text-center">{Math.round(scale * 100)}%</span>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setScale(s => Math.min(3, s + 0.2))}><ZoomIn className="h-4 w-4" /></Button>
                      </div>
                  </div>

                  <div className="flex-1 overflow-auto relative" onMouseUp={handleTextSelection} onScroll={() => { if(selection) setSelection(null); }}>
                      <div className="flex justify-center p-8 min-h-full min-w-max">
                          {pdfFile && (
                              <Document file={pdfFile} onLoadSuccess={({ numPages }) => setNumPages(numPages)} loading={<div className="flex flex-col items-center mt-32 text-muted-foreground"><Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" /><p>Rendering document...</p></div>}>
                                  <div className="shadow-2xl border border-border/50 rounded-sm bg-white ring-1 ring-black/5">
                                      <Page pageNumber={pageNumber} scale={scale} renderTextLayer={true} renderAnnotationLayer={true} className="pdf-page-container" />
                                  </div>
                              </Document>
                          )}
                      </div>
                  </div>
              </ResizablePanel>

              <ResizableHandle withHandle className="bg-border/50 hover:bg-primary/50 transition-colors" />

              {/* Right Panel: AI Tools */}
              <ResizablePanel defaultSize={50} minSize={30} className="flex flex-col bg-background/50 relative">
                  <Tabs defaultValue="chat" className="flex-1 flex flex-col h-full overflow-hidden">
                      <TabsList className="grid w-full grid-cols-4 rounded-none h-14 border-b bg-muted/10 p-1 gap-1">
                          <TabsTrigger value="chat" className="text-xs sm:text-sm rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"><MessageSquare className="w-4 h-4 sm:mr-2"/><span className="hidden sm:inline">Copilot</span></TabsTrigger>
                          <TabsTrigger value="guide" className="text-xs sm:text-sm rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"><GraduationCap className="w-4 h-4 sm:mr-2"/><span className="hidden sm:inline">Cheat Sheet</span></TabsTrigger>
                          <TabsTrigger value="test" className="text-xs sm:text-sm rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"><ListTodo className="w-4 h-4 sm:mr-2"/><span className="hidden sm:inline">Quiz Maker</span></TabsTrigger>
                          <TabsTrigger value="summary" className="text-xs sm:text-sm rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"><AlignLeft className="w-4 h-4 sm:mr-2"/><span className="hidden sm:inline">Summary</span></TabsTrigger>
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
                                              
                                              {msg.excerpt && (
                                                  <div className="bg-primary-foreground/10 border border-primary-foreground/20 rounded-xl p-3 text-sm mt-1">
                                                      <div className="flex items-center gap-2 font-semibold text-primary-foreground/90 mb-2 text-xs uppercase tracking-wider"><Quote className="h-3 w-3" /> Attached Excerpt</div>
                                                      <div className="text-primary-foreground/80 italic line-clamp-3 overflow-hidden text-ellipsis text-[13px] leading-relaxed border-l-2 border-primary-foreground/30 pl-3">{msg.excerpt}</div>
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
                          <div className="bg-background/80 backdrop-blur-xl border-t p-4 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)] z-10">
                              <div className="max-w-3xl mx-auto">
                                  <form onSubmit={e => { e.preventDefault(); handleSendMessage(); }} className="relative group">
                                      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-primary/10 rounded-2xl blur opacity-30 group-focus-within:opacity-100 transition duration-500"></div>
                                      <div className="relative flex items-end gap-2 bg-card border rounded-2xl p-1 shadow-sm focus-within:ring-1 focus-within:ring-primary/50 transition-all">
                                          <Textarea 
                                              value={chatInput} 
                                              onChange={e => setChatInput(e.target.value)}
                                              placeholder="Ask anything, or select text in the PDF for tools..." 
                                              className="min-h-[52px] max-h-[200px] border-0 focus-visible:ring-0 resize-y bg-transparent py-3 px-4 text-[15px]"
                                              onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                                          />
                                          <Button size="icon" type="submit" disabled={isChatting || !chatInput.trim()} className="h-10 w-10 mb-1 mr-1 rounded-xl shadow-md shrink-0"><Send className="h-4 w-4" /></Button>
                                      </div>
                                  </form>
                              </div>
                          </div>
                      </TabsContent>

                      {/* GUIDE TAB */}
                      <TabsContent value="guide" className="flex-1 overflow-auto p-4 sm:p-8 m-0 bg-background data-[state=inactive]:hidden">
                          <div className="max-w-3xl mx-auto h-full flex flex-col">
                              {!studyGuide && !isGeneratingGuide && (
                                  <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
                                      <div className="bg-primary/10 p-5 rounded-3xl shadow-inner border border-primary/10"><GraduationCap className="h-10 w-10 text-primary" /></div>
                                      <h2 className="text-3xl font-bold">Smart Cheat Sheet</h2>
                                      <p className="text-muted-foreground text-lg max-w-md mx-auto">Generate a complete study guide from this notebook document instantly.</p>
                                      <div className="w-full max-w-xs space-y-3 mt-4 text-left">
                                          <Label className="text-sm font-semibold uppercase tracking-wider text-muted-foreground ml-1">Language</Label>
                                          <Select value={language} onValueChange={setLanguage}>
                                              <SelectTrigger className="h-12 bg-background shadow-sm"><SelectValue /></SelectTrigger>
                                              <SelectContent><SelectItem value="English">English</SelectItem><SelectItem value="Spanish">Spanish</SelectItem><SelectItem value="Portuguese">Portuguese</SelectItem></SelectContent>
                                          </Select>
                                      </div>
                                      <Button size="lg" onClick={handleGenerateGuide} className="w-full max-w-xs h-14 text-lg rounded-xl shadow-lg">Generate Guide <Sparkles className="ml-2 h-5 w-5" /></Button>
                                  </div>
                              )}
                              {isGeneratingGuide && <div className="flex flex-col items-center justify-center h-full gap-6"><Loader2 className="h-16 w-16 animate-spin text-primary" /><p className="text-2xl font-bold">Structuring knowledge...</p></div>}
                              {studyGuide && (
                                  <div className="space-y-6 pb-12 mt-4">
                                      <div className="flex justify-between items-center bg-muted/30 p-4 rounded-xl border">
                                          <h2 className="text-xl font-bold flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary"/> Study Guide</h2>
                                          <Button variant="outline" size="sm" onClick={handleGenerateGuide}>Regenerate</Button>
                                      </div>
                                      <Card className="border-border shadow-xl"><CardContent className="p-8"><div className="prose prose-lg dark:prose-invert max-w-none"><ReactMarkdown>{studyGuide}</ReactMarkdown></div></CardContent></Card>
                                  </div>
                              )}
                          </div>
                      </TabsContent>

                      {/* TEST TAB */}
                      <TabsContent value="test" className="flex-1 overflow-auto p-4 sm:p-8 m-0 bg-background data-[state=inactive]:hidden">
                          <div className="max-w-2xl mx-auto h-full flex flex-col">
                              {testState === "setup" && (
                                  <div className="space-y-8 mt-4">
                                      <div className="text-center space-y-2"><div className="inline-flex p-3 bg-primary/10 rounded-full mb-2"><ListTodo className="h-8 w-8 text-primary"/></div><h2 className="text-3xl font-bold">Notebook Quiz</h2><p className="text-muted-foreground">Test your knowledge on this document.</p></div>
                                      <Card className="shadow-lg border-primary/10 bg-card/50 backdrop-blur-sm">
                                          <CardContent className="space-y-6 pt-8">
                                              <div className="grid grid-cols-2 gap-6">
                                                  <div className="space-y-3"><Label>Length</Label><Select value={questionCount} onValueChange={setQuestionCount}><SelectTrigger className="h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="5">5 Questions</SelectItem><SelectItem value="10">10 Questions</SelectItem><SelectItem value="15">15 Questions</SelectItem></SelectContent></Select></div>
                                                  <div className="space-y-3"><Label>Language</Label><Select value={language} onValueChange={setLanguage}><SelectTrigger className="h-12"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="English">English</SelectItem><SelectItem value="Spanish">Spanish</SelectItem><SelectItem value="Portuguese">Portuguese</SelectItem></SelectContent></Select></div>
                                              </div>
                                              <Button className="w-full h-14 text-lg rounded-xl" onClick={handleGenerateTest}>Initialize Test <Sparkles className="ml-2 h-5 w-5" /></Button>
                                          </CardContent>
                                      </Card>
                                  </div>
                              )}
                              {testState === "generating" && <div className="flex flex-col items-center justify-center h-full gap-6"><Loader2 className="h-16 w-16 animate-spin text-primary" /><p className="text-2xl font-bold">Synthesizing material...</p></div>}
                              {testState === "taking" && questions.length > 0 && (
                                  <div className="mt-4 flex flex-col h-full pb-4">
                                      <div className="flex items-center gap-4 mb-6"><div className="flex-1 h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${((currentQIndex) / questions.length) * 100}%` }} /></div><span className="text-sm font-bold text-muted-foreground shrink-0">Q {currentQIndex + 1} / {questions.length}</span></div>
                                      <Card className="shadow-xl flex-1 animate-in fade-in slide-in-from-right-8"><CardHeader><CardTitle className="text-2xl">{questions[currentQIndex].question}</CardTitle></CardHeader><CardContent><RadioGroup value={userAnswers[currentQIndex]} onValueChange={(val) => { const newAns = [...userAnswers]; newAns[currentQIndex] = val; setUserAnswers(newAns); }} className="space-y-3">{Object.entries(questions[currentQIndex].options).map(([key, value]) => (<Label key={key} htmlFor={`opt-${key}`} className={`flex items-start space-x-4 p-5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${userAnswers[currentQIndex] === key ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/40'}`}><RadioGroupItem value={key} id={`opt-${key}`} className="mt-1 shrink-0" /><span className="text-base font-medium">{value}</span></Label>))}</RadioGroup></CardContent></Card>
                                      <div className="mt-6 flex justify-end"><Button size="lg" className="h-14 px-10 text-lg rounded-xl" disabled={!userAnswers[currentQIndex]} onClick={() => { if (currentQIndex < questions.length - 1) setCurrentQIndex(p => p + 1); else finishTest(); }}>{currentQIndex === questions.length - 1 ? "Complete Exam" : "Next Question"} <ArrowRight className="ml-2 h-5 w-5" /></Button></div>
                                  </div>
                              )}
                              {testState === "results" && (
                                  <div className="space-y-8 pb-10 mt-4">
                                      <div className="text-center p-10 bg-gradient-to-br from-muted/50 to-muted border rounded-3xl"><h2 className="text-6xl font-black text-primary mb-4">{questions.length - wrongAnswers.length} <span className="text-4xl text-muted-foreground">/ {questions.length}</span></h2><p className="text-xl font-medium text-muted-foreground">Score Finalized.</p></div>
                                      <Card className="border-border shadow-xl overflow-hidden rounded-2xl">
                                          <CardHeader className="bg-muted/30 pb-6 border-b"><CardTitle className="text-2xl flex items-center justify-between"><span className="flex items-center gap-2"><ListTodo className="h-6 w-6 text-primary" /> Test Review</span></CardTitle></CardHeader>
                                          <CardContent className="p-0">
                                              <ScrollArea className="h-[400px]">
                                                  <div className="p-6 space-y-6">
                                                      {questions.map((q, i) => {
                                                          const isCorrect = userAnswers[i] === q.answer;
                                                          return (
                                                              <div key={i} className={`p-6 border rounded-xl shadow-sm ${isCorrect ? 'bg-green-50/50 border-green-200' : 'bg-red-50/50 border-red-200'}`}>
                                                                  <p className="font-bold text-lg mb-4 flex items-start gap-3"><span className="mt-1">{isCorrect ? <CheckCircle className="w-5 h-5 text-green-600"/> : <XCircle className="w-5 h-5 text-destructive"/>}</span>{q.question}</p>
                                                                  <div className="space-y-3 ml-8 text-[15px]">
                                                                      {!isCorrect && <div className="flex items-center gap-2 text-destructive font-medium p-2 rounded border border-red-100"><span>Your Answer:</span> <span className="line-through">{q.options[userAnswers[i] as keyof typeof q.options]}</span></div>}
                                                                      <div className="flex items-center gap-2 text-green-700 font-bold p-2 rounded border border-green-100"><span>Correct Answer:</span> <span>{q.options[q.answer as keyof typeof q.options]}</span></div>
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
                                                  <RadioGroup value={saveOption} onValueChange={(val: any) => setSaveOption(val)} className="flex gap-4 mb-4">
                                                      <Label htmlFor="save-mistakes" className={`flex-1 flex items-center p-4 border-2 rounded-xl cursor-pointer ${saveOption === 'mistakes' ? 'border-primary bg-primary/5' : 'border-muted'}`}><RadioGroupItem value="mistakes" id="save-mistakes" className="mr-3" /> Save Mistakes Only</Label>
                                                      <Label htmlFor="save-all" className={`flex-1 flex items-center p-4 border-2 rounded-xl cursor-pointer ${saveOption === 'all' ? 'border-primary bg-primary/5' : 'border-muted'}`}><RadioGroupItem value="all" id="save-all" className="mr-3" /> Save All</Label>
                                                  </RadioGroup>
                                                  <div className="flex gap-4 items-end">
                                                      <div className="flex-1 space-y-2"><Label>Destination Deck</Label><Select value={selectedDeckId} onValueChange={setSelectedDeckId}><SelectTrigger className="h-12"><SelectValue placeholder="Select deck..." /></SelectTrigger><SelectContent>{userDecks.map(deck => (<SelectItem key={deck.id} value={deck.id}>{deck.name}</SelectItem>))}</SelectContent></Select></div>
                                                      <Button onClick={handleSaveToDeck} disabled={isSaving || !selectedDeckId || (saveOption === 'mistakes' && wrongAnswers.length === 0)} className="h-12 px-8">{isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Save className="mr-2 h-5 w-5" />} Export</Button>
                                                  </div>
                                              </div>
                                          </CardFooter>
                                      </Card>
                                      <Button variant="ghost" className="w-full h-14" onClick={() => setTestState("setup")}>Start a New Session</Button>
                                  </div>
                              )}
                          </div>
                      </TabsContent>

                      {/* SUMMARY TAB */}
                      <TabsContent value="summary" className="flex-1 overflow-auto p-4 sm:p-8 m-0 bg-background data-[state=inactive]:hidden">
                          <div className="max-w-3xl mx-auto h-full flex flex-col">
                              {!summary && !isGeneratingSummary && (
                                  <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
                                      <div className="bg-primary/10 p-5 rounded-3xl shadow-inner border border-primary/10"><AlignLeft className="h-10 w-10 text-primary" /></div>
                                      <h2 className="text-3xl font-bold">Executive Intelligence</h2>
                                      <p className="text-muted-foreground text-lg max-w-md mx-auto">Generate a high-level summary of the entire document instantly.</p>
                                      <Button size="lg" onClick={handleGenerateSummary} className="mt-4 h-14 px-10 text-lg rounded-xl shadow-lg shadow-primary/20">Generate Analysis <Sparkles className="ml-2 h-5 w-5" /></Button>
                                  </div>
                              )}
                              {isGeneratingSummary && <div className="flex flex-col items-center justify-center h-full gap-6"><Loader2 className="h-16 w-16 animate-spin text-primary" /><p className="text-2xl font-bold">Extracting insights...</p></div>}
                              {summary && (
                                  <div className="space-y-6 pb-12 mt-4">
                                      <div className="flex justify-between items-center bg-muted/30 p-4 rounded-xl border"><h2 className="text-xl font-bold flex items-center gap-2"><AlignLeft className="h-5 w-5 text-primary"/> Summary</h2><Button variant="outline" size="sm" onClick={handleGenerateSummary}>Regenerate</Button></div>
                                      <Card className="border-border shadow-xl"><CardContent className="p-8"><div className="prose prose-lg dark:prose-invert max-w-none"><ReactMarkdown>{summary}</ReactMarkdown></div></CardContent></Card>
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