// components/study-stats.tsx
"use client"

import { useMemo, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Flame, CalendarCheck, Target, Trophy, Star, Zap, TrendingUp, CheckCircle } from "lucide-react"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts"
import { format, subDays, startOfDay, isSameDay } from "date-fns"
import { Progress } from "@/components/ui/progress"
import confetti from "canvas-confetti"

interface Review {
  rating: number
  reviewed_at: string
}

export function StudyStats({ reviews }: { reviews: Review[] }) {
  const DAILY_GOAL = 50; // Meta diaria de tarjetas revisadas
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

    return { dailyData, currentStreak, retentionRate, totalReviews, reviewsToday, level, currentLevelXP, nextLevelXP, progressToNextLevel, totalXP }
  }, [reviews])

  // Lógica del Confeti para la meta diaria
  useEffect(() => {
      const todayKey = `goal_reached_${format(new Date(), 'yyyy-MM-dd')}`;
      if (stats.reviewsToday >= DAILY_GOAL && !localStorage.getItem(todayKey)) {
          setShowConfetti(true);
          localStorage.setItem(todayKey, 'true');
          
          const duration = 3000;
          const end = Date.now() + duration;

          const frame = () => {
            confetti({
              particleCount: 5,
              angle: 60,
              spread: 55,
              origin: { x: 0 },
              colors: ['#a855f7', '#ec4899', '#eab308']
            });
            confetti({
              particleCount: 5,
              angle: 120,
              spread: 55,
              origin: { x: 1 },
              colors: ['#a855f7', '#ec4899', '#eab308']
            });
      
            if (Date.now() < end) {
              requestAnimationFrame(frame);
            }
          };
          frame();
      }
  }, [stats.reviewsToday]);

  const getRankName = (level: number) => {
    if (level < 5) return "Novice Scholar 🌱";
    if (level < 10) return "Adept Learner 📘";
    if (level < 20) return "Memory Master 🧠";
    if (level < 50) return "Grand Sage 🧙‍♂️";
    return "Omniscient 👑";
  }

  const dailyProgress = Math.min((stats.reviewsToday / DAILY_GOAL) * 100, 100);
  const goalReached = stats.reviewsToday >= DAILY_GOAL;

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
      
      {/* 1. TARJETA DE NIVEL MEJORADA */}
      <Card className="md:col-span-2 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-background border-purple-500/20 shadow-md relative overflow-hidden group">
        <div className="absolute -right-10 -top-10 opacity-5 group-hover:opacity-10 transition-opacity duration-700 transform group-hover:rotate-12">
            <Trophy className="h-48 w-48" />
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-2">
            <Star className="h-4 w-4" /> {getRankName(stats.level)}
          </CardTitle>
          <CardDescription>Keep studying to level up your brain.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 mb-5">
             <span className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600">Lvl {stats.level}</span>
             <span className="text-muted-foreground font-medium mb-2">{stats.totalXP.toLocaleString()} Total XP</span>
          </div>
          <div className="space-y-2 bg-background/50 p-3 rounded-lg border border-purple-100 dark:border-purple-900/30 backdrop-blur-sm">
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>To Lvl {stats.level + 1}</span>
                  <span className="text-purple-600 dark:text-purple-400">{stats.currentLevelXP} / {stats.nextLevelXP} XP</span>
              </div>
              <Progress value={stats.progressToNextLevel} className="h-2.5 bg-purple-500/20" />
          </div>
        </CardContent>
      </Card>

      {/* 2. TARJETA DE OBJETIVO DIARIO (NUEVA) */}
      <Card className="md:col-span-2 bg-gradient-to-br from-pink-500/10 to-orange-500/5 border-pink-500/20 shadow-md overflow-hidden relative">
        <div className="absolute -right-4 -bottom-4 opacity-5">
            <Target className="h-32 w-32" />
        </div>
        <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold text-pink-600 dark:text-pink-400 uppercase tracking-wider flex items-center gap-2">
                <Zap className="h-4 w-4" /> Daily Goal
            </CardTitle>
        </CardHeader>
        <CardContent>
            <div className="flex items-center justify-between mb-2">
                <div className="text-4xl font-black">
                    {stats.reviewsToday} <span className="text-xl text-muted-foreground font-semibold">/ {DAILY_GOAL}</span>
                </div>
                {goalReached && (
                    <div className="flex items-center gap-1 bg-green-500/20 text-green-600 dark:text-green-400 px-3 py-1 rounded-full text-xs font-bold animate-in zoom-in">
                        <CheckCircle className="h-4 w-4" /> Goal Met!
                    </div>
                )}
            </div>
            <p className="text-sm text-muted-foreground mb-4 h-5">
                {goalReached 
                    ? "Awesome! You crushed your daily target. 🎉" 
                    : `Just ${DAILY_GOAL - stats.reviewsToday} more cards to hit your daily goal!`}
            </p>
            <Progress value={dailyProgress} className="h-3 bg-pink-500/20 [&>div]:bg-gradient-to-r [&>div]:from-pink-500 [&>div]:to-orange-500" />
        </CardContent>
      </Card>

      {/* 3. RACHA (STREAK) */}
      <Card className="bg-gradient-to-b from-orange-500/10 to-background border-orange-500/20 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md duration-300">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-orange-600 dark:text-orange-500">Day Streak</CardTitle>
          <div className={`p-2 rounded-full ${stats.currentStreak > 0 ? 'bg-orange-500/20 text-orange-500' : 'bg-muted text-muted-foreground'}`}>
            <Flame className={`h-5 w-5 ${stats.currentStreak > 0 ? 'animate-pulse' : ''}`} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-5xl font-black mb-1">{stats.currentStreak}</div>
          <p className="text-xs font-medium text-muted-foreground">
            {stats.currentStreak > 7 ? "Unstoppable! 🔥" : stats.currentStreak > 2 ? "Keep the momentum going!" : "Study today to build it!"}
          </p>
        </CardContent>
      </Card>

      {/* 4. RETENCIÓN */}
      <Card className="bg-gradient-to-b from-emerald-500/10 to-background border-emerald-500/20 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md duration-300">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-500">Retention</CardTitle>
          <div className="p-2 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="h-5 w-5" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-5xl font-black mb-1">{stats.retentionRate}%</div>
          <p className="text-xs font-medium text-muted-foreground">
             {stats.retentionRate > 85 ? "Excellent memory! 🎯" : "Accuracy across all decks"}
          </p>
        </CardContent>
      </Card>

      {/* 5. HEATMAP */}
      <Card className="md:col-span-2 lg:col-span-4 shadow-sm border-muted/60">
        <CardHeader className="pb-4 border-b bg-muted/5 mb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" /> Activity Heatmap (Last 14 days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.dailyData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" fontSize={12} tickLine={false} axisLine={false} className="text-muted-foreground" />
                <YAxis fontSize={12} tickLine={false} axisLine={false} className="text-muted-foreground" allowDecimals={false} />
                <Tooltip 
                    cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                />
                <Bar dataKey="reviews" radius={[6, 6, 0, 0]} maxBarSize={50}>
                  {stats.dailyData.map((entry, index) => (
                    <Cell 
                        key={`cell-${index}`} 
                        fill={entry.reviews >= DAILY_GOAL ? "#a855f7" : entry.reviews > 0 ? "hsl(var(--primary))" : "hsl(var(--muted))"} 
                        className="transition-all duration-300 hover:opacity-80"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}