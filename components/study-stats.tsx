// components/study-stats.tsx
"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Flame, Brain, CalendarCheck, Target, Trophy, Star } from "lucide-react"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts"
import { format, subDays, startOfDay, isSameDay } from "date-fns"
import { Progress } from "@/components/ui/progress"

interface Review {
  rating: number
  reviewed_at: string
}

export function StudyStats({ reviews }: { reviews: Review[] }) {
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
    // Fórmula simple: Nivel = raíz cuadrada del multiplicador de XP
    const level = Math.floor(Math.sqrt(totalXP / baseXPForLevel)) + 1;
    const currentLevelXP = totalXP - (Math.pow(level - 1, 2) * baseXPForLevel);
    const nextLevelXP = (Math.pow(level, 2) * baseXPForLevel) - (Math.pow(level - 1, 2) * baseXPForLevel);
    const progressToNextLevel = (currentLevelXP / nextLevelXP) * 100;

    return { dailyData, currentStreak, retentionRate, totalReviews, reviewsToday, level, currentLevelXP, nextLevelXP, progressToNextLevel, totalXP }
  }, [reviews])

  // Determinar el rango/título del usuario
  const getRankName = (level: number) => {
    if (level < 5) return "Novice Scholar";
    if (level < 10) return "Adept Learner";
    if (level < 20) return "Memory Master";
    if (level < 50) return "Grand Sage";
    return "Omniscient";
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
      
      {/* NUEVO: Tarjeta de Nivel (Ocupa 2 columnas en pantallas grandes) */}
      <Card className="md:col-span-2 bg-gradient-to-br from-purple-500/10 via-background to-primary/5 border-purple-500/20 shadow-sm relative overflow-hidden">
        <div className="absolute -right-6 -top-6 opacity-10">
            <Trophy className="h-32 w-32" />
        </div>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-2">
            <Star className="h-4 w-4" /> {getRankName(stats.level)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 mb-4">
             <span className="text-5xl font-black text-foreground">Lvl {stats.level}</span>
             <span className="text-muted-foreground font-medium mb-1">{stats.totalXP} Total XP</span>
          </div>
          <div className="space-y-2">
              <div className="flex justify-between text-xs font-medium text-muted-foreground">
                  <span>Progress to Level {stats.level + 1}</span>
                  <span>{stats.currentLevelXP} / {stats.nextLevelXP} XP</span>
              </div>
              <Progress value={stats.progressToNextLevel} className="h-3 bg-purple-500/20" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-orange-500/10 to-background border-orange-500/20 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md duration-300">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Current Streak</CardTitle>
          <Flame className={`h-5 w-5 ${stats.currentStreak > 0 ? 'text-orange-500 animate-pulse' : 'text-muted-foreground'}`} />
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-black">{stats.currentStreak} <span className="text-lg font-medium text-muted-foreground">days</span></div>
          <p className="text-xs text-muted-foreground mt-1">
            {stats.currentStreak > 3 ? "You're on fire! 🔥" : "Study today to build your streak!"}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-green-500/10 to-background border-green-500/20 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md duration-300">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Retention Rate</CardTitle>
          <Target className="h-5 w-5 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-black">{stats.retentionRate}%</div>
          <p className="text-xs text-muted-foreground mt-1">Accuracy across all decks</p>
        </CardContent>
      </Card>

      <Card className="md:col-span-2 lg:col-span-4 shadow-sm border-muted/60">
        <CardHeader className="pb-4">
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
                    contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--background)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="reviews" radius={[6, 6, 0, 0]} maxBarSize={50}>
                  {stats.dailyData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.reviews > 0 ? "hsl(var(--primary))" : "hsl(var(--muted))"} />
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