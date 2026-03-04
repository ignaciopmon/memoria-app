"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, isPast } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Layers, RotateCcw, Play, Check, X, AlertTriangle, Infinity as InfinityIcon, Loader2, Target } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";

type DeckMastery = {
  deck_id: string;
  deck_name: string;
  current_interval: number;
  status: 'Learning' | 'Reviewing' | 'Mastered' | 'Needs Focus';
  last_score: number;
  next_review_date: string;
  isDue: boolean;
};

type Flashcard = {
  id: string;
  deck_id: string;
  deck_name: string;
  front: string;
  back: string;
};

type AppState = "hub" | "loading_cards" | "studying" | "results";

export default function SimulationsPage() {
  const [state, setState] = useState<AppState>("hub");
  const [masteryData, setMasteryData] = useState<DeckMastery[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Flashcard Study State
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [sessionResults, setSessionResults] = useState<{ [deckId: string]: { score: number, total: number, name: string } }>({});
  const [savingResults, setSavingResults] = useState(false);

  const supabase = createClient();
  const { toast } = useToast();

  useEffect(() => {
    fetchHubData();
  }, []);

  const fetchHubData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Obtener todos los mazos que no son carpetas
    const { data: decks } = await supabase.from('decks').select('id, name').eq('is_folder', false).is('deleted_at', null);
    // Obtener la maestría
    const { data: mastery } = await supabase.from('deck_mastery').select('*');

    if (decks) {
      const merged: DeckMastery[] = decks.map(deck => {
        const m = mastery?.find(x => x.deck_id === deck.id);
        const nextReview = m ? new Date(m.next_review_date) : new Date(); // Si no tiene, toca hoy
        return {
          deck_id: deck.id,
          deck_name: deck.name,
          current_interval: m ? m.current_interval : 0,
          status: m ? m.status : 'Learning',
          last_score: m ? m.last_score : 0,
          next_review_date: m ? m.next_review_date : new Date().toISOString(),
          isDue: isPast(nextReview) || (m && m.status === 'Needs Focus')
        };
      }).sort((a, b) => new Date(a.next_review_date).getTime() - new Date(b.next_review_date).getTime());
      
      setMasteryData(merged);
    }
    setLoading(false);
  };

  const startSimulation = async (specificDeckId?: string) => {
    setState("loading_cards");
    
    // Si pasamos un ID, simulamos solo ese. Si no, cogemos todos los "isDue"
    const targetDeckIds = specificDeckId 
        ? [specificDeckId] 
        : masteryData.filter(d => d.isDue).map(d => d.deck_id);

    if (targetDeckIds.length === 0) {
      toast({ title: "Todo al día", description: "No hay mazos pendientes para el ciclo de expansión." });
      setState("hub");
      return;
    }

    // Extraer tarjetas reales de la BD
    const { data: fetchedCards } = await supabase
        .from('cards')
        .select('id, deck_id, front, back, decks(name)')
        .in('deck_id', targetDeckIds)
        .is('deleted_at', null);

    if (!fetchedCards || fetchedCards.length === 0) {
        toast({ variant: "destructive", title: "Mazos vacíos", description: "Añade tarjetas a tus mazos primero." });
        setState("hub");
        return;
    }

// Formatear, mezclar y limitar (ej. máximo 30 tarjetas por simulación para no saturar)
    const formattedCards: Flashcard[] = fetchedCards.map((c: any) => {
        // Supabase a veces devuelve la relación como objeto y otras como array según los tipos generados
        const deckName = Array.isArray(c.decks) ? c.decks[0]?.name : c.decks?.name;

        return {
            id: c.id,
            deck_id: c.deck_id,
            deck_name: deckName || 'Unknown',
            front: c.front,
            back: c.back
        };
    }).sort(() => Math.random() - 0.5).slice(0, 30);

    setCards(formattedCards);
    setCurrentIndex(0);
    setIsFlipped(false);
    
    // Inicializar contadores de resultados
    const initialResults: any = {};
    targetDeckIds.forEach(id => {
        const deckName = masteryData.find(m => m.deck_id === id)?.deck_name || "Mazo";
        initialResults[id] = { score: 0, total: 0, name: deckName };
    });
    setSessionResults(initialResults);
    
    setState("studying");
  };

  const handleRate = (rating: number) => {
    const card = cards[currentIndex];
    const newResults = { ...sessionResults };
    
    // Sumamos al total del mazo
    if (newResults[card.deck_id]) {
        newResults[card.deck_id].total += 1;
        // Si vota Good(3) o Easy(4), lo contamos como acierto para el ciclo macro
        if (rating >= 3) {
            newResults[card.deck_id].score += 1;
        }
    }
    setSessionResults(newResults);

    // Siguiente tarjeta o terminar
    if (currentIndex < cards.length - 1) {
        setIsFlipped(false);
        setCurrentIndex(prev => prev + 1);
    } else {
        finishSimulation(newResults);
    }
  };

  const finishSimulation = async (finalResults: any) => {
    setState("results");
    setSavingResults(true);

    try {
        await fetch('/api/process-simulation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resultsByDeck: finalResults })
        });
        fetchHubData(); // Recarga los datos en segundo plano
    } catch (e) {
        toast({ variant: "destructive", title: "Error guardando progreso" });
    } finally {
        setSavingResults(false);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="container max-w-5xl py-8">
      {/* --- PANTALLA 1: EL HUB DE MAESTRÍA --- */}
      {state === "hub" && (
        <div className="space-y-8 animate-in fade-in duration-500">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-primary/5 p-6 rounded-2xl border border-primary/10">
            <div>
              <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
                <InfinityIcon className="text-primary w-8 h-8"/> Expansion Cycle
              </h1>
              <p className="text-muted-foreground mt-2 max-w-xl">
                Lleva tus mazos al nivel de dominio absoluto (R30, R60). Realiza simulacros combinados con tus tarjetas reales para empujar los intervalos.
              </p>
            </div>
            
            <Button onClick={() => startSimulation()} size="lg" className="rounded-xl h-14 px-8 shadow-lg hover:scale-105 transition-all gap-2 text-lg">
              <Play className="w-5 h-5 fill-current" />
              Simulado Infinito
            </Button>
          </div>

          <Card className="shadow-sm border-muted">
            <CardHeader>
              <CardTitle className="text-xl">Estado de tus Mazos</CardTitle>
              <CardDescription>R30: Éxito = R60. Fallo = Freno de mano (R3).</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Mazo</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Nivel</TableHead>
                      <TableHead>Última Nota</TableHead>
                      <TableHead>Próximo Repaso</TableHead>
                      <TableHead className="text-right">Acción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {masteryData.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8">No tienes mazos disponibles.</TableCell></TableRow>
                    ) : (
                      masteryData.map((d) => (
                        <TableRow key={d.deck_id} className={d.status === 'Needs Focus' ? 'bg-red-500/5 dark:bg-red-900/10' : ''}>
                          <TableCell className="font-medium flex items-center gap-2">
                            <Layers className="w-4 h-4 text-muted-foreground"/> {d.deck_name}
                          </TableCell>
                          <TableCell>
                            {d.status === 'Mastered' && <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20 shadow-none border-none">Mastered</Badge>}
                            {d.status === 'Reviewing' && <Badge className="bg-blue-500/10 text-blue-600 shadow-none border-none">Reviewing</Badge>}
                            {d.status === 'Needs Focus' && <Badge variant="destructive" className="animate-pulse shadow-none border-none flex w-fit gap-1"><AlertTriangle className="w-3 h-3"/> Focus</Badge>}
                            {d.status === 'Learning' && <Badge variant="secondary" className="shadow-none border-none">Learning</Badge>}
                          </TableCell>
                          <TableCell className="font-mono font-bold text-primary">R{d.current_interval}</TableCell>
                          <TableCell>{d.last_score > 0 ? `${d.last_score}%` : '-'}</TableCell>
                          <TableCell>
                            {d.isDue ? (
                                <span className="text-amber-500 font-bold text-sm">¡Toca hoy!</span>
                            ) : (
                                <span className="text-muted-foreground text-sm">{format(new Date(d.next_review_date), 'MMM dd, yyyy')}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                             <Button variant="ghost" size="sm" onClick={() => startSimulation(d.deck_id)} className="rounded-lg hover:bg-primary/10 hover:text-primary">
                                Forzar Test
                             </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* --- PANTALLA 2: CARGANDO TARJETAS --- */}
      {state === "loading_cards" && (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-6">
            <Loader2 className="h-16 w-16 animate-spin text-primary" />
            <h2 className="text-2xl font-bold">Mezclando tarjetas...</h2>
            <p className="text-muted-foreground">Preparando el simulacro con tus mazos pendientes.</p>
        </div>
      )}

      {/* --- PANTALLA 3: INTERFAZ DE ESTUDIO DE TARJETAS --- */}
      {state === "studying" && cards.length > 0 && (
        <div className="max-w-3xl mx-auto py-4 animate-in slide-in-from-bottom-8 duration-500">
            <div className="mb-8 space-y-4">
                <div className="flex justify-between items-center text-sm font-medium">
                    <Badge variant="outline" className="px-3 py-1 rounded-full border-primary/30 text-primary bg-primary/5">
                        Mazo: {cards[currentIndex].deck_name}
                    </Badge>
                    <span className="text-muted-foreground bg-muted px-3 py-1 rounded-full">
                        {currentIndex + 1} / {cards.length}
                    </span>
                </div>
                <Progress value={(currentIndex / cards.length) * 100} className="h-2 rounded-full" />
            </div>
            
            {/* Flashcard 3D effect simulation */}
            <div 
                className="w-full h-[400px] cursor-pointer perspective-1000" 
                onClick={() => !isFlipped && setIsFlipped(true)}
            >
                <div className={`relative w-full h-full transition-all duration-500 ease-in-out ${isFlipped ? '' : 'hover:scale-[1.02]'}`}>
                    
                    {/* FRONT */}
                    {!isFlipped && (
                        <Card className="absolute inset-0 flex flex-col items-center justify-center p-8 shadow-xl border-primary/20 bg-card hover:border-primary/50 transition-colors">
                            <p className="text-3xl text-center font-medium leading-relaxed">{cards[currentIndex].front}</p>
                            <p className="absolute bottom-6 text-sm text-muted-foreground animate-pulse flex items-center gap-2">
                                <RotateCcw className="w-4 h-4"/> Toca para girar
                            </p>
                        </Card>
                    )}

                    {/* BACK */}
                    {isFlipped && (
                        <Card className="absolute inset-0 flex flex-col items-center justify-center p-8 shadow-xl border-primary/20 bg-card animate-in fade-in zoom-in-95 duration-300">
                            <div className="flex-1 flex flex-col items-center justify-center w-full">
                                <p className="text-xl text-center text-muted-foreground mb-6 pb-6 border-b w-full max-w-lg">{cards[currentIndex].front}</p>
                                <p className="text-3xl text-center font-bold text-primary leading-relaxed">{cards[currentIndex].back}</p>
                            </div>
                        </Card>
                    )}
                </div>
            </div>

            {/* Botones de valoración */}
            <div className={`mt-8 grid grid-cols-4 gap-3 transition-opacity duration-300 ${isFlipped ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <Button variant="outline" className="h-16 flex flex-col gap-1 border-red-200 hover:bg-red-50 hover:text-red-600" onClick={(e) => { e.stopPropagation(); handleRate(1); }}>
                    <X className="w-5 h-5"/> <span className="font-semibold">Again</span>
                </Button>
                <Button variant="outline" className="h-16 flex flex-col gap-1 border-orange-200 hover:bg-orange-50 hover:text-orange-600" onClick={(e) => { e.stopPropagation(); handleRate(2); }}>
                    <Target className="w-5 h-5"/> <span className="font-semibold">Hard</span>
                </Button>
                <Button variant="outline" className="h-16 flex flex-col gap-1 border-green-200 hover:bg-green-50 hover:text-green-600" onClick={(e) => { e.stopPropagation(); handleRate(3); }}>
                    <Check className="w-5 h-5"/> <span className="font-semibold">Good</span>
                </Button>
                <Button variant="outline" className="h-16 flex flex-col gap-1 border-blue-200 hover:bg-blue-50 hover:text-blue-600" onClick={(e) => { e.stopPropagation(); handleRate(4); }}>
                    <Play className="w-5 h-5"/> <span className="font-semibold">Easy</span>
                </Button>
            </div>
        </div>
      )}

      {/* --- PANTALLA 4: RESULTADOS MACRO --- */}
      {state === "results" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8">
            <div className="text-center space-y-3 py-6">
                <div className="inline-flex bg-primary/10 p-4 rounded-full mb-2">
                    <Check className="w-12 h-12 text-primary" />
                </div>
                <h1 className="text-4xl font-black">Simulacro Completado</h1>
                <p className="text-lg text-muted-foreground">
                    {savingResults ? "Aplicando Regla del Doble a tus mazos..." : "Tu Ciclo de Expansión ha sido actualizado."}
                </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 max-w-4xl mx-auto">
                {Object.entries(sessionResults).map(([deckId, data]: [string, any]) => {
                    if (data.total === 0) return null;
                    const perc = Math.round((data.score / data.total) * 100);
                    const isSuccess = perc >= 80;

                    return (
                        <Card key={deckId} className={`overflow-hidden border-2 ${isSuccess ? 'border-green-500/20' : 'border-red-500/20'}`}>
                            <div className={`p-4 ${isSuccess ? 'bg-green-50 dark:bg-green-950/20' : 'bg-red-50 dark:bg-red-950/20'}`}>
                                <h3 className="font-bold text-lg mb-1 truncate">{data.name}</h3>
                                <div className="flex items-end justify-between">
                                    <div className="space-y-1">
                                        <p className="text-3xl font-black">{perc}% <span className="text-base font-normal text-muted-foreground">acierto</span></p>
                                    </div>
                                    <div className="text-right">
                                        {isSuccess ? (
                                            <Badge className="bg-green-500 text-white font-bold py-1 px-3 shadow-md">¡Sube Nivel! (x2)</Badge>
                                        ) : (
                                            <Badge variant="destructive" className="font-bold py-1 px-3 shadow-md">Freno de Mano (R3)</Badge>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </Card>
                    )
                })}
            </div>

            <div className="flex justify-center pt-8">
                <Button size="lg" disabled={savingResults} onClick={() => setState("hub")} className="rounded-xl h-14 px-10 text-lg">
                    {savingResults ? <Loader2 className="animate-spin w-5 h-5 mr-2" /> : <RotateCcw className="w-5 h-5 mr-2" />}
                    Volver al Dashboard
                </Button>
            </div>
        </div>
      )}
    </div>
  );
}