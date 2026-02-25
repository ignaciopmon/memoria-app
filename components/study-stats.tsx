"use client"

import { useMemo, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Flame, Target, Trophy, Star, Zap, TrendingUp, CheckCircle, PieChart, Activity, Brain, Clock, CalendarDays } from "lucide-react"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts"
import { format, subDays, startOfDay, isSameDay } from "date-fns"
import { Progress } from "@/components/ui/progress"
import confetti from "canvas-confetti"

interface Review {
  rating: number
  reviewed_at: string
}

export function StudyStats({ reviews }: { reviews: Review[] }) {
  const DAILY_GOAL = 50; 
  const [showConfetti, setShowConfetti] = useState(false);

  const stats = useMemo(() => {
    const today = startOfDay(new Date())
    const last14Days = Array.from({ length: 14 }).map((_, i) => subDays(today, 13 - i))
    
    // 1. Actividad de los últimos 14 días
    const dailyData = last14Days.map(date => {
      const dayReviews = reviews.filter(r => isSameDay(new Date(r.reviewed_at), date))
      return {
        date: format(date, "MMM dd"),
        reviews: dayReviews.length,
        correct: dayReviews.filter(r => r.rating >= 3).length
      }
    })

    // 2. Racha actual (Streak)
    const daysWithReviews = new Set(reviews.map(r => format(new Date(r.reviewed_at), "yyyy-MM-dd")))
    let currentStreak = 0
    let checkDate = today

    if (!daysWithReviews.has(format(checkDate, "yyyy-MM-dd"))) {
        checkDate = subDays(checkDate, 1)
    }

    while (daysWithReviews.has(format(checkDate, "yyyy-MM-dd"))) {
        currentStreak++
        checkDate = subDays(checkDate, 1)
    }

    // 3. Tasa de retención
    const totalReviews = reviews.length
    const correctReviews = reviews.filter(r => r.rating >= 3).length
    const retentionRate = totalReviews > 0 ? Math.round((correctReviews / totalReviews) * 100) : 0
    const reviewsToday = dailyData[13].reviews

    // 4. Sistema de Niveles (RPG Logic)
    const xpPerReview = 10;
    const totalXP = totalReviews * xpPerReview;
    const baseXPForLevel = 500;
    const level = Math.floor(Math.sqrt(totalXP / baseXPForLevel)) + 1;
    const currentLevelXP = totalXP - (Math.pow(level - 1, 2) * baseXPForLevel);
    const nextLevelXP = (Math.pow(level, 2) * baseXPForLevel) - (Math.pow(level - 1, 2) * baseXPForLevel);
    const progressToNextLevel = (currentLevelXP / nextLevelXP) * 100;

    // 5. Análisis de Distribución (Ratings)
    const ratingCounts = { again: 0, hard: 0, good: 0, easy: 0 };
    const timeOfDay = { morning: 0, afternoon: 0, evening: 0, night: 0 };
    const dayOfWeek = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

    reviews.forEach(r => {
        if (r.rating === 1) ratingCounts.again++;
        if (r.rating === 2) ratingCounts.hard++;
        if (r.rating === 3) ratingCounts.good++;
        if (r.rating === 4) ratingCounts.easy++;

        const date = new Date(r.reviewed_at);
        const hour = date.getHours();
        if (hour >= 5 && hour < 12) timeOfDay.morning++;
        else if (hour >= 12 && hour < 17) timeOfDay.afternoon++;
        else if (hour >= 17 && hour < 22) timeOfDay.evening++;
        else timeOfDay.night++;

        dayOfWeek[date.getDay()]++;
    });

    // 6. Insights: Study Persona & Best Day
    let maxTime = 'morning';
    let maxTimeCount = timeOfDay.morning;
    if (timeOfDay.afternoon > maxTimeCount) { maxTime = 'afternoon'; maxTimeCount = timeOfDay.afternoon; }
    if (timeOfDay.evening > maxTimeCount) { maxTime = 'evening'; maxTimeCount = timeOfDay.evening; }
    if (timeOfDay.night > maxTimeCount) { maxTime = 'night'; maxTimeCount = timeOfDay.night; }

    const personaMap = {
        morning: { title: "Early Bird 🌅", desc: "You do your best learning in the quiet of the morning." },
        afternoon: { title: "Afternoon Achiever ☀️", desc: "Mid-day is your absolute peak performance time." },
        evening: { title: "Evening Scholar 🌇", desc: "You prefer to study and review as the day winds down." },
        night: { title: "Night Owl 🦉", desc: "The silence of the night is your domain for focus." }
    };

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let bestDayIdx = 0;
    let bestDayCount = 0;
    for (let i = 0; i < 7; i++) {
        if (dayOfWeek[i] > bestDayCount) {
            bestDayCount = dayOfWeek[i];
            bestDayIdx = i;
        }
    }
    const bestStudyDay = bestDayCount > 0 ? days[bestDayIdx] : "Not enough data";

    // 7. Tendencia de 7 días
    const last7 = reviews.filter(r => new Date(r.reviewed_at) >= subDays(today, 7)).length;
    const prev7 = reviews.filter(r => {
        const d = new Date(r.reviewed_at);
        return d >= subDays(today, 14) && d < subDays(today, 7);
    }).length;
    let trend = 0;
    if (prev7 > 0) trend = Math.round(((last7 - prev7) / prev7) * 100);
    else if (last7 > 0) trend = 100;

    return { 
        dailyData, currentStreak, retentionRate, totalReviews, reviewsToday, 
        level, currentLevelXP, nextLevelXP, progressToNextLevel, totalXP,
        ratingCounts, studyPersona: personaMap[maxTime as keyof typeof personaMap], bestStudyDay, trend, last7
    }
  }, [reviews])

  // Lógica del Confeti
  useEffect(() => {
      const todayKey = `goal_reached_${format(new Date(), 'yyyy-MM-dd')}`;
      if (stats.reviewsToday >= DAILY_GOAL && !localStorage.getItem(todayKey)) {
          setShowConfetti(true);
          localStorage.setItem(todayKey, 'true');
          
          const duration = 3000;
          const end = Date.now() + duration;

          const frame = () => {
            confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#a855f7', '#ec4899', '#eab308'] });
            confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#a855f7', '#ec4899', '#eab308'] });
            if (Date.now() < end) requestAnimationFrame(frame);
          };
          frame();
      }
  }, [stats.reviewsToday]);

  const getRankName = (level: number) => {
    if (level < 5) return "Novice Scholar";
    if (level < 10) return "Adept Learner";
    if (level < 20) return "Memory Master";
    if (level < 50) return "Grand Sage";
    return "Omniscient";
  }

  const dailyProgress = Math.min((stats.reviewsToday / DAILY_GOAL) * 100, 100);
  const goalReached = stats.reviewsToday >= DAILY_GOAL;

  // Renderizador de barras de calificación
  const renderRatingBar = (label: string, count: number, total: number, colorClass: string, textClass: string) => {
    const percent = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
                <span className={`font-semibold ${textClass}`}>{label}</span>
                <span className="text-muted-foreground font-medium">{percent}% <span className="opacity-50 text-xs">({count})</span></span>
            </div>
            <div className="h-2.5 w-full bg-muted/50 rounded-full overflow-hidden">
                <div className={`h-full ${colorClass} transition-all duration-500`} style={{ width: `${percent}%` }} />
            </div>
        </div>
    )
  }

  // Tooltip personalizado para Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl border bg-background/95 backdrop-blur-sm p-4 shadow-xl">
          <p className="font-bold mb-2 text-foreground">{label}</p>
          <div className="flex flex-col gap-1.5 text-sm">
            <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="font-medium text-muted-foreground">Total Reviews:</span>
                <span className="font-bold text-foreground">{payload[0].value}</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="font-medium text-muted-foreground">Correct:</span>
                <span className="font-bold text-foreground">{payload[0].payload.correct}</span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-6 pb-12">
      
      {/* ROW 1: KPIs Principales */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Nivel / XP */}
        <Card className="border-border shadow-sm relative overflow-hidden group bg-card hover:border-primary/50 transition-colors">
            <div className="absolute -right-6 -top-6 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-500 transform group-hover:rotate-12">
                <Trophy className="h-40 w-40" />
            </div>
            <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" /> {getRankName(stats.level)}
            </CardTitle>
            </CardHeader>
            <CardContent>
            <div className="flex items-baseline gap-2 mb-3">
                <span className="text-4xl font-black text-foreground">Lvl {stats.level}</span>
                <span className="text-sm font-medium text-muted-foreground">{stats.totalXP.toLocaleString()} XP</span>
            </div>
            <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    <span>Progress</span>
                    <span className="text-primary">{stats.currentLevelXP} / {stats.nextLevelXP}</span>
                </div>
                <Progress value={stats.progressToNextLevel} className="h-2 bg-muted" />
            </div>
            </CardContent>
        </Card>

        {/* Objetivo Diario */}
        <Card className="border-border shadow-sm overflow-hidden relative bg-card hover:border-primary/50 transition-colors">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Target className="h-4 w-4 text-pink-500" /> Daily Goal
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-4xl font-black">{stats.reviewsToday}</span>
                        <span className="text-lg text-muted-foreground font-medium">/ {DAILY_GOAL}</span>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground mb-3 h-4">
                    {goalReached 
                        ? <span className="text-green-600 dark:text-green-500 font-medium flex items-center gap-1"><CheckCircle className="h-3 w-3" /> Goal crushed!</span>
                        : `${DAILY_GOAL - stats.reviewsToday} more cards to go.`}
                </p>
                <Progress value={dailyProgress} className="h-2 bg-muted [&>div]:bg-pink-500" />
            </CardContent>
        </Card>

        {/* Racha */}
        <Card className="border-border shadow-sm bg-card hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Day Streak</CardTitle>
            <Flame className={`h-4 w-4 ${stats.currentStreak > 0 ? 'text-orange-500 fill-orange-500/20' : 'text-muted-foreground'}`} />
            </CardHeader>
            <CardContent>
            <div className="text-4xl font-black mb-1">{stats.currentStreak}</div>
            <p className="text-xs font-medium text-muted-foreground">
                {stats.currentStreak > 7 ? "You're on fire! 🔥" : stats.currentStreak > 0 ? "Keep it up!" : "Study today to start!"}
            </p>
            </CardContent>
        </Card>

        {/* Retención */}
        <Card className="border-border shadow-sm bg-card hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Retention Rate</CardTitle>
            <Brain className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
            <div className="text-4xl font-black mb-1">{stats.retentionRate}%</div>
            <p className="text-xs font-medium text-muted-foreground">
                {stats.retentionRate >= 85 ? "Excellent memory! 🎯" : "Overall accuracy"}
            </p>
            </CardContent>
        </Card>
      </div>

      {/* ROW 2: Gráficos y Desglose */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Gráfico de Actividad */}
        <Card className="md:col-span-2 border-border shadow-sm bg-card">
            <CardHeader className="flex flex-row items-center justify-between pb-6">
                <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Activity className="h-5 w-5 text-primary" /> Study Activity
                    </CardTitle>
                    <CardDescription className="mt-1">Your card reviews over the last 14 days.</CardDescription>
                </div>
                <div className="text-right hidden sm:block">
                    <div className="text-sm font-bold text-foreground">{stats.last7} cards</div>
                    <div className="text-xs text-muted-foreground">past 7 days 
                        <span className={`ml-1 font-medium ${stats.trend > 0 ? 'text-green-500' : stats.trend < 0 ? 'text-destructive' : ''}`}>
                            {stats.trend > 0 ? `+${stats.trend}%` : stats.trend < 0 ? `${stats.trend}%` : '-'}
                        </span>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={stats.dailyData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorReviews" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                            <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} className="text-muted-foreground" dy={10} />
                            <YAxis fontSize={12} tickLine={false} axisLine={false} className="text-muted-foreground" allowDecimals={false} dx={-10} />
                            <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '4 4' }} />
                            <Area 
                                type="monotone" 
                                dataKey="reviews" 
                                stroke="hsl(var(--primary))" 
                                strokeWidth={3} 
                                fillOpacity={1} 
                                fill="url(#colorReviews)" 
                                activeDot={{ r: 6, strokeWidth: 0, fill: "hsl(var(--primary))" }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>

        {/* Distribución de Calificaciones */}
        <Card className="col-span-1 border-border shadow-sm bg-card flex flex-col">
            <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-muted-foreground" /> Rating Distribution
                </CardTitle>
                <CardDescription>Accuracy breakdown across all decks.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center gap-6">
                {renderRatingBar("Again", stats.ratingCounts.again, stats.totalReviews, "bg-destructive", "text-destructive")}
                {renderRatingBar("Hard", stats.ratingCounts.hard, stats.totalReviews, "bg-orange-500", "text-orange-600 dark:text-orange-500")}
                {renderRatingBar("Good", stats.ratingCounts.good, stats.totalReviews, "bg-blue-500", "text-blue-600 dark:text-blue-500")}
                {renderRatingBar("Easy", stats.ratingCounts.easy, stats.totalReviews, "bg-green-500", "text-green-600 dark:text-green-500")}
            </CardContent>
        </Card>
      </div>

      {/* ROW 3: Insights Divertidos */}
      <div className="grid gap-4 md:grid-cols-3">
         <Card className="border-border shadow-sm bg-muted/20">
             <CardContent className="p-6 flex items-start gap-4">
                 <div className="bg-primary/10 p-3 rounded-xl"><Clock className="h-6 w-6 text-primary" /></div>
                 <div>
                     <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Study Persona</p>
                     <p className="font-bold text-foreground text-lg mb-0.5">{stats.studyPersona.title}</p>
                     <p className="text-sm text-muted-foreground leading-snug">{stats.studyPersona.desc}</p>
                 </div>
             </CardContent>
         </Card>

         <Card className="border-border shadow-sm bg-muted/20">
             <CardContent className="p-6 flex items-start gap-4">
                 <div className="bg-emerald-500/10 p-3 rounded-xl"><CalendarDays className="h-6 w-6 text-emerald-500" /></div>
                 <div>
                     <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Most Active Day</p>
                     <p className="font-bold text-foreground text-lg mb-0.5">{stats.bestStudyDay}</p>
                     <p className="text-sm text-muted-foreground leading-snug">You process the most cards on this day of the week.</p>
                 </div>
             </CardContent>
         </Card>

         <Card className="border-border shadow-sm bg-muted/20">
             <CardContent className="p-6 flex items-start gap-4">
                 <div className="bg-blue-500/10 p-3 rounded-xl"><TrendingUp className="h-6 w-6 text-blue-500" /></div>
                 <div>
                     <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total Effort</p>
                     <p className="font-bold text-foreground text-lg mb-0.5">{stats.totalReviews} Cards</p>
                     <p className="text-sm text-muted-foreground leading-snug">Total flashcards reviewed since you started your journey.</p>
                 </div>
             </CardContent>
         </Card>
      </div>

    </div>
  )
}