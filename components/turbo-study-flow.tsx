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
import { Loader2, FileText, Youtube, Send, Bot, User, ArrowRight, CheckCircle, XCircle, Save, Sparkles, BookOpen, Upload } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import ReactMarkdown from "react-markdown";

type Message = { role: "user" | "model"; content: string };
type Question = { question: string; options: { [key: string]: string }; answer: string; explanation?: string };
type WrongAnswer = Question & { userAnswer: string };

export function TurboStudyFlow({ userDecks }: { userDecks: { id: string, name: string }[] }) {
  const [sourceType, setSourceType] = useState<"pdf" | "youtube" | null>(null);
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false); // NUEVO ESTADO

  // Chat State
  const [messages, setMessages] = useState<Message[]>([{ role: "model", content: "Hi! I have analyzed your material. What questions do you have or what concepts would you like me to explain?" }]);
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
  
  // Save State
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Handle File Upload (Convert to Base64) with improvements
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (limit to ~4MB to avoid serverless payload limits)
    if (file.size > 4 * 1024 * 1024) {
        return toast({ 
            title: "File too large", 
            description: "Please upload a PDF smaller than 4MB.", 
            variant: "destructive" 
        });
    }

    setIsProcessingFile(true);
    setFileName(file.name);
    
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

  const handleStartWithYoutube = () => {
      if (!youtubeUrl.includes("youtube.com") && !youtubeUrl.includes("youtu.be")) {
          return toast({ title: "Invalid URL", description: "Please enter a valid YouTube link.", variant: "destructive" });
      }
      setIsReady(true);
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
              body: JSON.stringify({
                  action: "chat",
                  messages: newMessages,
                  pdfBase64,
                  youtubeUrl: sourceType === 'youtube' ? youtubeUrl : null
              })
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
              body: JSON.stringify({
                  action: "generate_test",
                  questionCount,
                  language,
                  pdfBase64,
                  youtubeUrl: sourceType === 'youtube' ? youtubeUrl : null
              })
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
        body: JSON.stringify({ 
            deckId: selectedDeckId,
            newDeckName: null,
            cards: formattedCards
        }),
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
          <div className="max-w-2xl mx-auto mt-12 animate-in fade-in slide-in-from-bottom-4 w-full">
              <Card className="border-muted shadow-xl">
                  <CardHeader className="text-center">
                      <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
                          <BookOpen className="h-8 w-8 text-primary" />
                      </div>
                      <CardTitle className="text-3xl font-bold">Turbo Study</CardTitle>
                      <CardDescription className="text-lg">Upload a document or paste a link to start studying with AI.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                          <div 
                              className={`cursor-pointer border-2 rounded-xl p-6 flex flex-col items-center gap-3 transition-all ${sourceType === "pdf" ? "border-primary bg-primary/5" : "hover:border-primary/50"}`}
                              onClick={() => setSourceType("pdf")}
                          >
                              <FileText className={`h-8 w-8 ${sourceType === "pdf" ? "text-primary" : "text-muted-foreground"}`} />
                              <span className="font-semibold">PDF Document</span>
                          </div>
                          <div 
                              className={`cursor-pointer border-2 rounded-xl p-6 flex flex-col items-center gap-3 transition-all ${sourceType === "youtube" ? "border-red-500 bg-red-500/5" : "hover:border-red-500/50"}`}
                              onClick={() => setSourceType("youtube")}
                          >
                              <Youtube className={`h-8 w-8 ${sourceType === "youtube" ? "text-red-500" : "text-muted-foreground"}`} />
                              <span className="font-semibold">YouTube Video</span>
                          </div>
                      </div>

                      {sourceType === "pdf" && (
                          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl bg-muted/20">
                              {isProcessingFile ? (
                                  <div className="flex flex-col items-center text-primary">
                                      <Loader2 className="h-10 w-10 animate-spin mb-4" />
                                      <p className="font-medium">Reading document...</p>
                                  </div>
                              ) : (
                                  <>
                                      <Upload className="h-10 w-10 text-muted-foreground mb-4" />
                                      <Label htmlFor="pdf-upload" className="cursor-pointer bg-primary text-primary-foreground px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors">
                                          Select PDF File
                                      </Label>
                                      <Input 
                                          id="pdf-upload"
                                          type="file" 
                                          accept=".pdf" 
                                          onChange={handleFileUpload} 
                                          className="hidden" 
                                      />
                                      <p className="text-xs text-muted-foreground mt-4">Max size: 4MB</p>
                                  </>
                              )}
                          </div>
                      )}

                      {sourceType === "youtube" && (
                          <div className="space-y-4">
                              <Input 
                                  placeholder="https://www.youtube.com/watch?v=..." 
                                  value={youtubeUrl} 
                                  onChange={e => setYoutubeUrl(e.target.value)}
                                  className="h-12 text-base"
                              />
                              <Button className="w-full h-12 text-base" onClick={handleStartWithYoutube} disabled={!youtubeUrl}>
                                  Load Video Transcript
                              </Button>
                          </div>
                      )}
                  </CardContent>
              </Card>
          </div>
      );
  }

  return (
      <div className="max-w-5xl mx-auto h-[80vh] flex flex-col mt-4 border rounded-xl shadow-lg overflow-hidden bg-background w-full">
          <div className="bg-muted/30 p-4 border-b flex justify-between items-center">
              <div className="flex items-center gap-2 overflow-hidden">
                  <Sparkles className="h-5 w-5 text-primary shrink-0" />
                  <span className="font-semibold truncate max-w-[200px] sm:max-w-[400px]">
                      {sourceType === 'pdf' ? fileName : 'YouTube Material'}
                  </span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => {
                  setIsReady(false);
                  setMessages([{ role: "model", content: "Hi! I have analyzed your material. What questions do you have or what concepts would you like me to explain?" }]);
                  setTestState("setup");
              }}>
                  Change Material
              </Button>
          </div>

          <Tabs defaultValue="chat" className="flex-1 flex flex-col h-full overflow-hidden">
              <TabsList className="grid w-full grid-cols-2 rounded-none h-12">
                  <TabsTrigger value="chat" className="text-base">💬 Chat with Document</TabsTrigger>
                  <TabsTrigger value="test" className="text-base">📝 Generate Test</TabsTrigger>
              </TabsList>

              {/* CHAT TAB */}
              <TabsContent value="chat" className="flex-1 flex flex-col m-0 p-0 h-full overflow-hidden data-[state=inactive]:hidden">
                  <ScrollArea className="flex-1 p-4">
                      <div className="space-y-6 max-w-3xl mx-auto pb-4">
                          {messages.map((msg, i) => (
                              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                  {msg.role === 'model' && <div className="bg-primary/10 p-2 rounded-full h-fit"><Bot className="h-5 w-5 text-primary" /></div>}
                                  <div className={`p-4 rounded-2xl max-w-[80%] ${msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted rounded-tl-sm prose dark:prose-invert prose-p:leading-relaxed'}`}>
                                      {msg.role === 'user' ? msg.content : <ReactMarkdown>{msg.content}</ReactMarkdown>}
                                  </div>
                                  {msg.role === 'user' && <div className="bg-muted p-2 rounded-full h-fit"><User className="h-5 w-5" /></div>}
                              </div>
                          ))}
                          {isChatting && (
                              <div className="flex gap-3 justify-start animate-pulse">
                                  <div className="bg-primary/10 p-2 rounded-full h-fit"><Bot className="h-5 w-5 text-primary" /></div>
                                  <div className="p-4 rounded-2xl bg-muted rounded-tl-sm flex gap-2 items-center">
                                      <div className="h-2 w-2 bg-foreground/30 rounded-full animate-bounce" />
                                      <div className="h-2 w-2 bg-foreground/30 rounded-full animate-bounce delay-75" />
                                      <div className="h-2 w-2 bg-foreground/30 rounded-full animate-bounce delay-150" />
                                  </div>
                              </div>
                          )}
                          <div ref={scrollRef} />
                      </div>
                  </ScrollArea>
                  <div className="p-4 bg-background border-t">
                      <form onSubmit={e => { e.preventDefault(); handleSendMessage(); }} className="flex gap-2 max-w-3xl mx-auto relative">
                          <Textarea 
                              value={chatInput} 
                              onChange={e => setChatInput(e.target.value)}
                              placeholder="Ask something about the document..." 
                              className="min-h-[60px] resize-none pr-14 rounded-xl text-base"
                              onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                          />
                          <Button size="icon" type="submit" disabled={isChatting || !chatInput.trim()} className="absolute right-3 top-3 h-10 w-10 rounded-lg">
                              <Send className="h-4 w-4" />
                          </Button>
                      </form>
                  </div>
              </TabsContent>

              {/* TEST TAB */}
              <TabsContent value="test" className="flex-1 overflow-auto p-4 sm:p-6 m-0 bg-muted/10 data-[state=inactive]:hidden">
                  <div className="max-w-3xl mx-auto h-full flex flex-col">
                      {testState === "setup" && (
                          <Card className="mt-4 sm:mt-8 shadow-sm">
                              <CardHeader>
                                  <CardTitle>Configure your Test</CardTitle>
                                  <CardDescription>We will extract the most important questions from your material.</CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-4">
                                  <div className="grid sm:grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                          <Label>Number of questions</Label>
                                          <Select value={questionCount} onValueChange={setQuestionCount}>
                                              <SelectTrigger><SelectValue /></SelectTrigger>
                                              <SelectContent>
                                                  <SelectItem value="5">5 Questions</SelectItem>
                                                  <SelectItem value="10">10 Questions</SelectItem>
                                                  <SelectItem value="15">15 Questions</SelectItem>
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
                                              </SelectContent>
                                          </Select>
                                      </div>
                                  </div>
                                  <Button className="w-full mt-6 h-12 text-base" onClick={handleGenerateTest}>
                                      Generate Test <Sparkles className="ml-2 h-4 w-4" />
                                  </Button>
                              </CardContent>
                          </Card>
                      )}

                      {testState === "generating" && (
                          <div className="flex flex-col items-center justify-center h-full gap-4">
                              <Loader2 className="h-12 w-12 animate-spin text-primary" />
                              <p className="text-lg font-medium">The AI is reading the content and creating questions...</p>
                          </div>
                      )}

                      {testState === "taking" && questions.length > 0 && (
                          <Card className="shadow-lg border-primary/20 animate-in fade-in slide-in-from-right-4">
                              <CardHeader>
                                  <div className="flex justify-between items-center text-sm font-medium text-muted-foreground mb-4">
                                      <span>Question {currentQIndex + 1} of {questions.length}</span>
                                  </div>
                                  <CardTitle className="text-xl leading-relaxed">{questions[currentQIndex].question}</CardTitle>
                              </CardHeader>
                              <CardContent>
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
                                          <div key={key} className={`flex items-start space-x-3 border-2 p-4 rounded-xl cursor-pointer transition-colors ${userAnswers[currentQIndex] === key ? 'border-primary bg-primary/5' : 'border-transparent bg-muted/50 hover:bg-muted'}`}>
                                              <RadioGroupItem value={key} id={`opt-${key}`} className="mt-1" />
                                              <Label htmlFor={`opt-${key}`} className="flex-1 cursor-pointer text-base leading-snug">{value}</Label>
                                          </div>
                                      ))}
                                  </RadioGroup>
                              </CardContent>
                              <CardFooter className="justify-end pt-4">
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
                          <div className="space-y-6 pb-8 animate-in fade-in slide-in-from-bottom-4">
                              <div className="text-center p-8 bg-muted/30 rounded-2xl border">
                                  <h2 className="text-4xl font-bold mb-2">
                                      {questions.length - wrongAnswers.length} / {questions.length}
                                  </h2>
                                  <p className="text-muted-foreground">Correct answers. Good job!</p>
                              </div>

                              {wrongAnswers.length > 0 && (
                                  <Card className="border-destructive/20 shadow-sm">
                                      <CardHeader className="bg-destructive/5 pb-4 border-b">
                                          <CardTitle className="text-destructive flex items-center gap-2">
                                              <XCircle className="h-5 w-5" /> Review Mistakes ({wrongAnswers.length})
                                          </CardTitle>
                                      </CardHeader>
                                      <CardContent className="p-0">
                                          <ScrollArea className="h-[300px]">
                                              <div className="p-4 space-y-4">
                                                  {wrongAnswers.map((w, i) => (
                                                      <div key={i} className="p-4 border rounded-xl bg-background">
                                                          <p className="font-semibold mb-3">{w.question}</p>
                                                          <div className="space-y-2 text-sm">
                                                              <div className="flex items-start gap-2 text-destructive">
                                                                  <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                                                  <span>Your answer: {w.options[w.userAnswer as keyof typeof w.options]}</span>
                                                              </div>
                                                              <div className="flex items-start gap-2 text-green-600">
                                                                  <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                                                  <span>Correct: {w.options[w.answer as keyof typeof w.options]}</span>
                                                              </div>
                                                              {w.explanation && (
                                                                  <p className="mt-3 pt-3 border-t text-muted-foreground italic">"{w.explanation}"</p>
                                                              )}
                                                          </div>
                                                      </div>
                                                  ))}
                                              </div>
                                          </ScrollArea>
                                      </CardContent>
                                      <CardFooter className="bg-muted/10 border-t flex-col sm:flex-row gap-4 justify-between pt-6">
                                          <Select value={selectedDeckId} onValueChange={setSelectedDeckId}>
                                              <SelectTrigger className="w-full sm:w-[250px]"><SelectValue placeholder="Select a deck to save..." /></SelectTrigger>
                                              <SelectContent>
                                                  {userDecks.map(deck => (
                                                      <SelectItem key={deck.id} value={deck.id}>{deck.name}</SelectItem>
                                                  ))}
                                              </SelectContent>
                                          </Select>
                                          <Button onClick={handleSaveToDeck} disabled={isSaving || !selectedDeckId} className="w-full sm:w-auto">
                                              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />} Save Mistakes
                                          </Button>
                                      </CardFooter>
                                  </Card>
                              )}
                              
                              <Button variant="outline" className="w-full h-12" onClick={() => setTestState("setup")}>
                                  Create another test
                              </Button>
                          </div>
                      )}
                  </div>
              </TabsContent>
          </Tabs>
      </div>
  );
}