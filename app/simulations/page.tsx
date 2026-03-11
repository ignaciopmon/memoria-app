"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  CalendarClock,
  CheckCircle2,
  FileText,
  Flame,
  ListChecks,
  Loader2,
  PencilLine,
  Plus,
  Search,
  Sparkles,
  Star,
  Tag,
  Timer,
  Trash2,
  TrendingUp,
} from "lucide-react";

type ManualField = {
  id: string;
  label: string;
  value: string;
};

type ManualEntry = {
  id: string;
  title: string;
  rating: string;
  rLevel: string;
  notes: string;
  tags: string[];
  sessionDate: string;
  fields: ManualField[];
  createdAt: string;
  updatedAt: string;
};

type ManualProfile = {
  weeklyGoal: number;
  focusArea: string;
  ritual: string;
};

type ManualEntryRow = {
  id: string;
  user_id: string;
  title: string | null;
  rating: string | null;
  r_level: string | null;
  notes: string | null;
  tags: string[] | null;
  session_date: string | null;
  fields: ManualField[] | null;
  created_at: string;
  updated_at: string;
};

const QUICK_FIELDS = ["R10", "R30", "R60", "R90", "Tiempo", "Tema", "Energía", "Dificultad"] as const;

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const createEntry = (): ManualEntry => {
  const now = new Date().toISOString();
  return {
    id: createId(),
    title: "",
    rating: "",
    rLevel: "",
    notes: "",
    tags: [],
    sessionDate: now.slice(0, 10),
    fields: [],
    createdAt: now,
    updatedAt: now,
  };
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseNumericRating = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  return null;
};

const mapRowToEntry = (row: ManualEntryRow): ManualEntry => {
  return {
    id: row.id,
    title: row.title ?? "",
    rating: row.rating ?? "",
    rLevel: row.r_level ?? "",
    notes: row.notes ?? "",
    tags: Array.isArray(row.tags) ? row.tags : [],
    sessionDate: row.session_date ?? "",
    fields: Array.isArray(row.fields) ? row.fields : [],
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.created_at ?? new Date().toISOString(),
  };
};

export default function SimulationsPage() {
  const supabase = createClient();
  const router = useRouter();
  const { toast } = useToast();

  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<ManualEntry[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Record<string, "idle" | "saving" | "error">>({});
  const [profile, setProfile] = useState<ManualProfile>({ weeklyGoal: 4, focusArea: "", ritual: "" });
  const [profileReady, setProfileReady] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      if (!user) {
        router.push("/auth/login");
        return;
      }

      if (!isMounted) return;
      setUserId(user.id);

      const { data: entryRows, error: entriesError } = await supabase
        .from("manual_simulation_entries")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (entriesError) {
        toast({
          variant: "destructive",
          title: "No se pudieron cargar las entradas",
          description: "Intenta recargar la página.",
        });
      }

      const nextEntries = (entryRows ?? []).map((row) => mapRowToEntry(row as ManualEntryRow));
      setEntries(nextEntries);
      setActiveId(nextEntries[0]?.id ?? null);

      const { data: profileRows } = await supabase
        .from("manual_simulation_profile")
        .select("*")
        .eq("user_id", user.id);

      const profileRow = profileRows?.[0];
      if (profileRow) {
        setProfile({
          weeklyGoal: profileRow.weekly_goal ?? 4,
          focusArea: profileRow.focus_area ?? "",
          ritual: profileRow.ritual ?? "",
        });
      }

      setProfileReady(true);
      setLoading(false);
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [router, supabase, toast]);

  useEffect(() => {
    if (!profileReady || !userId) return;

    const timer = setTimeout(async () => {
      setProfileSaving(true);
      const { error } = await supabase.from("manual_simulation_profile").upsert({
        user_id: userId,
        weekly_goal: Math.max(1, profile.weeklyGoal || 1),
        focus_area: profile.focusArea,
        ritual: profile.ritual,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        toast({
          variant: "destructive",
          title: "No se pudo guardar el objetivo",
        });
      }
      setProfileSaving(false);
    }, 700);

    return () => clearTimeout(timer);
  }, [profile, profileReady, supabase, toast, userId]);

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return sortedEntries;

    return sortedEntries.filter((entry) => {
      const haystack = [
        entry.title,
        entry.notes,
        entry.rating,
        entry.rLevel,
        entry.tags.join(" "),
        entry.fields.map((field) => `${field.label} ${field.value}`).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(trimmed);
    });
  }, [query, sortedEntries]);

  const activeEntry = entries.find((entry) => entry.id === activeId) ?? null;
  const activeSaveState = activeEntry ? savingIds[activeEntry.id] ?? "idle" : "idle";

  const persistEntry = async (entry: ManualEntry) => {
    if (!userId) return;
    setSavingIds((prev) => ({ ...prev, [entry.id]: "saving" }));

    const { error } = await supabase.from("manual_simulation_entries").upsert({
      id: entry.id,
      user_id: userId,
      title: entry.title || null,
      rating: entry.rating || null,
      r_level: entry.rLevel || null,
      notes: entry.notes || null,
      tags: entry.tags,
      session_date: entry.sessionDate || null,
      fields: entry.fields,
      updated_at: entry.updatedAt,
    });

    if (error) {
      setSavingIds((prev) => ({ ...prev, [entry.id]: "error" }));
      toast({
        variant: "destructive",
        title: "No se pudo guardar",
        description: "Revisa tu conexión y vuelve a intentarlo.",
      });
      return;
    }

    setSavingIds((prev) => ({ ...prev, [entry.id]: "idle" }));
  };

  const queueSave = (entry: ManualEntry) => {
    if (!userId) return;

    const existing = saveTimers.current[entry.id];
    if (existing) {
      clearTimeout(existing);
    }

    saveTimers.current[entry.id] = setTimeout(() => {
      persistEntry(entry);
    }, 500);
  };

  const updateEntry = (id: string, updater: (entry: ManualEntry) => ManualEntry) => {
    setEntries((prev) => {
      let nextEntry: ManualEntry | null = null;
      const next = prev.map((entry) => {
        if (entry.id !== id) return entry;
        nextEntry = {
          ...updater(entry),
          updatedAt: new Date().toISOString(),
        };
        return nextEntry;
      });

      if (nextEntry) {
        queueSave(nextEntry);
      }

      return next;
    });
  };

  const handleCreate = () => {
    const next = createEntry();
    setEntries((prev) => [next, ...prev]);
    setActiveId(next.id);
    persistEntry(next);
  };

  const handleDelete = async (id: string) => {
    setEntries((prev) => {
      const next = prev.filter((entry) => entry.id !== id);
      if (activeId === id) {
        setActiveId(next[0]?.id ?? null);
      }
      return next;
    });

    if (!userId) return;
    const { error } = await supabase.from("manual_simulation_entries").delete().eq("id", id);
    if (error) {
      toast({
        variant: "destructive",
        title: "No se pudo eliminar",
      });
    }
  };

  const handleAddField = (id: string, label = "") => {
    updateEntry(id, (entry) => ({
      ...entry,
      fields: [...entry.fields, { id: createId(), label, value: "" }],
    }));
  };

  const handleUpdateField = (entryId: string, fieldId: string, data: Partial<ManualField>) => {
    updateEntry(entryId, (entry) => ({
      ...entry,
      fields: entry.fields.map((field) => (field.id === fieldId ? { ...field, ...data } : field)),
    }));
  };

  const handleDeleteField = (entryId: string, fieldId: string) => {
    updateEntry(entryId, (entry) => ({
      ...entry,
      fields: entry.fields.filter((field) => field.id !== fieldId),
    }));
  };

  const entriesWithDates = entries.filter((entry) => Boolean(entry.sessionDate));
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);

  const sessionsThisWeek = useMemo(() => {
    const start = new Date(today);
    start.setDate(today.getDate() - 6);

    return entriesWithDates.filter((entry) => {
      const date = new Date(entry.sessionDate);
      date.setHours(0, 0, 0, 0);
      return date >= start && date <= today;
    }).length;
  }, [entriesWithDates, today]);

  const currentStreak = useMemo(() => {
    const dateSet = new Set(entriesWithDates.map((entry) => entry.sessionDate));
    let count = 0;
    const cursor = new Date(today);

    while (dateSet.has(toDateKey(cursor))) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return count;
  }, [entriesWithDates, today]);

  const lastSessionDate = useMemo(() => {
    if (entriesWithDates.length === 0) return null;
    return [...entriesWithDates].sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))[0]?.sessionDate ?? null;
  }, [entriesWithDates]);

  const averageRating = useMemo(() => {
    const ratings = entries
      .map((entry) => parseNumericRating(entry.rating))
      .filter((value): value is number => value !== null);

    if (ratings.length === 0) return null;
    const sum = ratings.reduce((acc, value) => acc + value, 0);
    return sum / ratings.length;
  }, [entries]);

  const tagStats = useMemo(() => {
    const counts = new Map<string, number>();
    entries.forEach((entry) => {
      entry.tags.forEach((tag) => {
        const clean = tag.trim();
        if (!clean) return;
        counts.set(clean, (counts.get(clean) ?? 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [entries]);

  const rLevelStats = useMemo(() => {
    const counts = new Map<string, number>();
    entries.forEach((entry) => {
      const key = entry.rLevel.trim();
      if (!key) return;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [entries]);

  const weeklyGoal = Math.max(1, profile.weeklyGoal || 1);
  const goalProgress = Math.min(100, Math.round((sessionsThisWeek / weeklyGoal) * 100));

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Cargando tu espacio manual...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-rose-50/40 to-sky-50/30 pb-16 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
        <Card className="relative overflow-hidden border-0 bg-gradient-to-r from-amber-100/80 via-rose-100/80 to-sky-100/80 shadow-xl dark:from-amber-500/10 dark:via-rose-500/10 dark:to-sky-500/10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.8),transparent_55%)] dark:bg-[radial-gradient(circle_at_top,rgba(148,163,184,0.15),transparent_60%)]" />
          <CardHeader className="relative space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-3xl font-black tracking-tight">Simulación Manual</CardTitle>
                <CardDescription className="text-base text-muted-foreground">
                  Un espacio tipo Notion para registrar sesiones a tu manera: calificaciones, notas, R30 o lo que quieras.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="gap-1 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  <Sparkles className="h-3.5 w-3.5" />
                  Guardado en tu cuenta
                </Badge>
                <Button onClick={handleCreate} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nueva entrada
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {entries.length} entradas
              </span>
              <span className="inline-flex items-center gap-2">
                <ListChecks className="h-4 w-4" />
                100% manual y autónomo
              </span>
            </div>
          </CardHeader>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="space-y-1">
              <CardDescription className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-amber-500" />
                Racha actual
              </CardDescription>
              <CardTitle className="text-3xl font-black">{currentStreak} días</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="space-y-1">
              <CardDescription className="flex items-center gap-2">
                <Timer className="h-4 w-4 text-sky-500" />
                Sesiones últimos 7 días
              </CardDescription>
              <CardTitle className="text-3xl font-black">{sessionsThisWeek}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="space-y-1">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Calificación media
              </CardDescription>
              <CardTitle className="text-3xl font-black">{averageRating ? averageRating.toFixed(1) : "—"}</CardTitle>
              <CardDescription className="text-xs">Solo valores numéricos</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="space-y-1">
              <CardDescription className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-rose-500" />
                Última sesión
              </CardDescription>
              <CardTitle className="text-2xl font-black">{lastSessionDate ?? "—"}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Objetivo semanal
                </CardTitle>
                <CardDescription>Define tu meta y observa el progreso.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Sesiones por semana</Label>
                  <Input
                    type="number"
                    min={1}
                    value={profile.weeklyGoal}
                    onChange={(event) =>
                      setProfile((prev) => ({
                        ...prev,
                        weeklyGoal: Number(event.target.value),
                      }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Progreso</span>
                    <span>
                      {sessionsThisWeek}/{weeklyGoal}
                    </span>
                  </div>
                  <Progress value={goalProgress} className="h-2" />
                </div>
                <div className="space-y-2">
                  <Label>Enfoque de la semana</Label>
                  <Input
                    value={profile.focusArea}
                    onChange={(event) => setProfile((prev) => ({ ...prev, focusArea: event.target.value }))}
                    placeholder="Ej. Anatomía, verbos irregulares, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ritual / Preparación</Label>
                  <Textarea
                    rows={3}
                    value={profile.ritual}
                    onChange={(event) => setProfile((prev) => ({ ...prev, ritual: event.target.value }))}
                    placeholder="Ej. 10 min de repaso, agua, temporizador 25/5."
                  />
                </div>
                <div className="text-xs text-muted-foreground">
                  {profileSaving ? "Guardando objetivo..." : "Guardado automático en tu cuenta"}
                </div>
              </CardContent>
            </Card>

            <Card className="h-fit">
              <CardHeader className="space-y-2">
                <CardTitle className="text-lg">Tu base personal</CardTitle>
                <CardDescription>Filtra, busca y elige qué editar.</CardDescription>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Buscar por título, notas, R30…"
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {filteredEntries.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    Aún no hay entradas. Crea una para empezar tu sistema manual.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredEntries.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setActiveId(entry.id)}
                        className={cn(
                          "w-full rounded-lg border px-3 py-3 text-left transition hover:bg-muted/40",
                          activeId === entry.id ? "border-primary/60 bg-primary/5" : "border-border/60",
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">{entry.title.trim() ? entry.title : "Sin título"}</p>
                            <p className="text-xs text-muted-foreground">
                              {entry.sessionDate ? `Fecha: ${entry.sessionDate}` : "Sin fecha"}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {entry.rating ? (
                              <Badge variant="secondary" className="gap-1">
                                <Star className="h-3 w-3" />
                                {entry.rating}
                              </Badge>
                            ) : null}
                            {entry.rLevel ? (
                              <Badge className="bg-sky-500/10 text-sky-700 dark:text-sky-300">{entry.rLevel}</Badge>
                            ) : null}
                          </div>
                        </div>
                        {entry.tags.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {entry.tags.slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="outline" className="text-[10px]">
                                {tag}
                              </Badge>
                            ))}
                            {entry.tags.length > 3 ? (
                              <Badge variant="outline" className="text-[10px]">
                                +{entry.tags.length - 3}
                              </Badge>
                            ) : null}
                          </div>
                        ) : null}
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="space-y-1">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Señales rápidas
                </CardTitle>
                <CardDescription>Etiquetas y R-level más usados.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Top etiquetas</p>
                  {tagStats.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aún sin etiquetas.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {tagStats.map(([tag, count]) => (
                        <Badge key={tag} variant="secondary" className="gap-1">
                          {tag}
                          <span className="text-[10px] text-muted-foreground">{count}</span>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <Separator />
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">R-level</p>
                  {rLevelStats.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aún sin R-levels.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {rLevelStats.map(([level, count]) => (
                        <Badge key={level} className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
                          {level} · {count}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-lg flex items-center gap-2">
                <PencilLine className="h-4 w-4" />
                Editor manual
              </CardTitle>
              <CardDescription>Todo se guarda en tu cuenta. Ajusta el contenido como quieras.</CardDescription>
              {activeEntry ? (
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {activeSaveState === "saving"
                      ? "Guardando cambios..."
                      : activeSaveState === "error"
                      ? "Error al guardar"
                      : "Guardado"}
                  </span>
                  <span>·</span>
                  <span>Última edición: {new Date(activeEntry.updatedAt).toLocaleString()}</span>
                </div>
              ) : null}
            </CardHeader>
            <CardContent>
              {!activeEntry ? (
                <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                  Selecciona una entrada para editarla o crea una nueva.
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Título</Label>
                      <Input
                        value={activeEntry.title}
                        onChange={(event) =>
                          updateEntry(activeEntry.id, (entry) => ({
                            ...entry,
                            title: event.target.value,
                          }))
                        }
                        placeholder="Ej. Sesión de Biología - Repaso final"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4" />
                        Fecha
                      </Label>
                      <Input
                        type="date"
                        value={activeEntry.sessionDate}
                        onChange={(event) =>
                          updateEntry(activeEntry.id, (entry) => ({
                            ...entry,
                            sessionDate: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Calificación</Label>
                      <Input
                        value={activeEntry.rating}
                        onChange={(event) =>
                          updateEntry(activeEntry.id, (entry) => ({
                            ...entry,
                            rating: event.target.value,
                          }))
                        }
                        placeholder="Ej. 4/5, A, 85%"
                      />
                      <div className="flex flex-wrap gap-2">
                        {"12345".split("").map((value) => (
                          <Button
                            key={value}
                            type="button"
                            size="sm"
                            variant={activeEntry.rating === value ? "default" : "outline"}
                            onClick={() =>
                              updateEntry(activeEntry.id, (entry) => ({
                                ...entry,
                                rating: value,
                              }))
                            }
                          >
                            {value}
                          </Button>
                        ))}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            updateEntry(activeEntry.id, (entry) => ({
                              ...entry,
                              rating: "",
                            }))
                          }
                        >
                          Limpiar
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>R-level / R30 / Nivel</Label>
                      <Input
                        value={activeEntry.rLevel}
                        onChange={(event) =>
                          updateEntry(activeEntry.id, (entry) => ({
                            ...entry,
                            rLevel: event.target.value,
                          }))
                        }
                        placeholder="Ej. R30, R60, Nivel 2"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      Etiquetas
                    </Label>
                    <Input
                      value={activeEntry.tags.join(", ")}
                      onChange={(event) =>
                        updateEntry(activeEntry.id, (entry) => ({
                          ...entry,
                          tags: event.target.value
                            .split(",")
                            .map((tag) => tag.trim())
                            .filter(Boolean),
                        }))
                      }
                      placeholder="Ej. biología, examen, focus"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Notas libres</Label>
                    <Textarea
                      value={activeEntry.notes}
                      onChange={(event) =>
                        updateEntry(activeEntry.id, (entry) => ({
                          ...entry,
                          notes: event.target.value,
                        }))
                      }
                      placeholder="Escribe tus observaciones, recordatorios o próximos pasos."
                      rows={6}
                    />
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold">Campos personalizados</h3>
                        <p className="text-xs text-muted-foreground">
                          Agrega tus propios campos tipo Notion: R30, tiempo, esfuerzo, etc.
                        </p>
                      </div>
                      <Button type="button" size="sm" onClick={() => handleAddField(activeEntry.id)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Nuevo campo
                      </Button>
                    </div>

                    {activeEntry.fields.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                        No hay campos personalizados. Añade uno para comenzar.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {activeEntry.fields.map((field) => (
                          <div key={field.id} className="grid gap-2 md:grid-cols-[1fr_1.5fr_auto]">
                            <Input
                              value={field.label}
                              onChange={(event) => handleUpdateField(activeEntry.id, field.id, { label: event.target.value })}
                              placeholder="Nombre del campo"
                            />
                            <Input
                              value={field.value}
                              onChange={(event) => handleUpdateField(activeEntry.id, field.id, { value: event.target.value })}
                              placeholder="Valor"
                            />
                            <Button type="button" variant="ghost" size="icon" onClick={() => handleDeleteField(activeEntry.id, field.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {QUICK_FIELDS.map((label) => (
                        <Button key={label} type="button" size="sm" variant="outline" onClick={() => handleAddField(activeEntry.id, label)}>
                          + {label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-muted-foreground">
                      Última edición: {new Date(activeEntry.updatedAt).toLocaleString()}
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(activeEntry.id)}
                      className="gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar entrada
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
