"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, isPast } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrainCircuit, Target, ArrowRight, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface TopicMastery {
  id: string;
  topic: string;
  current_interval: number;
  status: 'Learning' | 'Reviewing' | 'Mastered' | 'Needs Focus';
  last_score: number;
  last_reviewed_at: string;
  next_review_date: string;
}

export default function SimulationsPage() {
  const [topics, setTopics] = useState<TopicMastery[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    fetchMastery();
  }, []);

  const fetchMastery = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('topic_mastery')
      .select('*')
      .order('next_review_date', { ascending: true });

    if (!error && data) {
      setTopics(data as TopicMastery[]);
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Mastered': return <Badge className="bg-green-500/10 text-green-500">Mastered</Badge>;
      case 'Reviewing': return <Badge className="bg-blue-500/10 text-blue-500">Reviewing</Badge>;
      case 'Needs Focus': return <Badge className="bg-red-500/10 text-red-500">Needs Focus</Badge>;
      default: return <Badge variant="outline">Learning</Badge>;
    }
  };

  const getNextStepText = (topic: TopicMastery) => {
    const isDue = isPast(new Date(topic.next_review_date));
    
    if (topic.status === 'Needs Focus') {
      return <span className="text-red-500 font-medium">Handbrake active: Focus Review required</span>;
    }
    
    if (isDue) {
      return <span className="text-orange-500 font-medium">Due for Expansion (R{topic.current_interval * 2})</span>;
    }

    return <span className="text-muted-foreground">Wait for automatic review</span>;
  };

  const handleFocusReview = (topicName: string) => {
    // Redirige al generador de test pasando el topic por URL parameter
    router.push(`/dashboard?topic=${encodeURIComponent(topicName)}&focus=true`);
  };

  const handleGeneralSimulation = async () => {
    // Filtra los topics que están listos para repaso o masterizados
    const eligibleTopics = topics
        .filter(t => t.status !== 'Needs Focus')
        .map(t => t.topic);

    if (eligibleTopics.length === 0) {
        alert("Not enough learned topics to run a general simulation.");
        return;
    }

    setGenerating(true);
    
    try {
      const response = await fetch('/api/generate-simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topics: eligibleTopics.slice(0, 5), // Mezclar hasta 5 temas
          questionCount: 15,
          language: "Spanish" // Asume el idioma preferido
        })
      });

      if (!response.ok) throw new Error("Simulation generation failed");
      
      const quizData = await response.json();
      
      // Aquí guardarías el quiz generado en un estado global, o localStorage, 
      // y redirigirías al flujo del test que ya tienes creado.
      localStorage.setItem('current_simulation', JSON.stringify(quizData));
      localStorage.setItem('simulation_topics', JSON.stringify(eligibleTopics.slice(0, 5)));
      
      router.push('/ai-test'); // Redirige a tu página de visualización del test
      
    } catch (error) {
      console.error(error);
      alert("Error generating simulation");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin w-8 h-8" /></div>;
  }

  return (
    <div className="container max-w-6xl py-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expansion Cycle & Simulations</h1>
          <p className="text-muted-foreground mt-1">Track your topic mastery and prepare with infinite simulations.</p>
        </div>
        
        <Button onClick={handleGeneralSimulation} disabled={generating || topics.length === 0} size="lg" className="gap-2">
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
          Start General Simulation
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Topic Mastery Table</CardTitle>
          <CardDescription>From "knowing nothing" to "ready to test". Successful reviews double the interval (R30, R60).</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Topic</TableHead>
                  <TableHead>Mastery Status</TableHead>
                  <TableHead>Current Interval</TableHead>
                  <TableHead>Last Review</TableHead>
                  <TableHead>Next Step</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topics.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                      No topics studied yet. Take a test to start tracking!
                    </TableCell>
                  </TableRow>
                ) : (
                  topics.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.topic}</TableCell>
                      <TableCell>{getStatusBadge(t.status)}</TableCell>
                      <TableCell>R{t.current_interval}</TableCell>
                      <TableCell>{format(new Date(t.last_reviewed_at), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>{getNextStepText(t)}</TableCell>
                      <TableCell className="text-right">
                        {t.status === 'Needs Focus' ? (
                          <Button variant="destructive" size="sm" onClick={() => handleFocusReview(t.topic)}>
                            <Target className="w-4 h-4 mr-2" /> Focus
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" disabled>
                            Wait <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        )}
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
  );
}