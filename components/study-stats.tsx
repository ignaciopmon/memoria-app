"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Flame, Brain, CalendarCheck, Target } from "lucide-react"
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { format, subDays, startOfDay, isSameDay } from "date-fns"

interface Review {
  rating: number
  reviewed_at: string
}

export function StudyStats({ reviews }: { reviews: Review[] }) {
  const stats = useMemo(() => {
    const today = startOfDay(new Date())
    const last14Days = Array.from({ length: 14 }).map((_, i) => subDays(today, 13 - i))
    
    // 1. Actividad de los últimos 14 días (para el gráfico)
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

    // Si no estudió hoy, comprobamos si estudió ayer para mantener la racha
    if (!daysWithReviews.has(format(checkDate, "yyyy-MM-dd"))) {
        checkDate = subDays(checkDate, 1)
    }

    while (daysWithReviews.has(format(checkDate, "yyyy-MM-dd"))) {
        currentStreak++
        checkDate = subDays(checkDate, 1)
    }

    // 3. Tasa de retención global (Precisión)
    const totalReviews = reviews.length
    const correctReviews = reviews.filter(r => r.rating >= 3).length
    const retentionRate = totalReviews > 0 ? Math.round((correctReviews / totalReviews) * 100) : 0

    // 4. Revisiones de hoy
    const reviewsToday = dailyData[13].reviews

    return { dailyData, currentStreak, retentionRate, totalReviews, reviewsToday }
  }, [reviews])

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
      {/* Tarjeta de Racha */}
      <Card className="bg-gradient-to-br from-orange-500/10 to-background border-orange-500/20 shadow-sm transition-all hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Current Streak</CardTitle>
          <Flame className={`h-5 w-5 ${stats.currentStreak > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-black">{stats.currentStreak} <span className="text-lg font-medium text-muted-foreground">days</span></div>
          <p className="text-xs text-muted-foreground mt-1">Keep the flame alive!</p>
        </CardContent>
      </Card>

      {/* Tarjeta de Retención */}
      <Card className="bg-gradient-to-br from-green-500/10 to-background border-green-500/20 shadow-sm transition-all hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Retention Rate</CardTitle>
          <Target className="h-5 w-5 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-black">{stats.retentionRate}%</div>
          <p className="text-xs text-muted-foreground mt-1">Cards answered correctly</p>
        </CardContent>
      </Card>

      {/* Tarjeta de Hoy */}
      <Card className="bg-gradient-to-br from-blue-500/10 to-background border-blue-500/20 shadow-sm transition-all hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Reviews Today</CardTitle>
          <CalendarCheck className="h-5 w-5 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-black">{stats.reviewsToday}</div>
          <p className="text-xs text-muted-foreground mt-1">Total reviews today</p>
        </CardContent>
      </Card>

      {/* Tarjeta de Total */}
      <Card className="shadow-sm transition-all hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Reviews</CardTitle>
          <Brain className="h-5 w-5 text-purple-500" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-black">{stats.totalReviews}</div>
          <p className="text-xs text-muted-foreground mt-1">All time interactions</p>
        </CardContent>
      </Card>

      {/* Gráfico de Actividad */}
      <Card className="md:col-span-2 lg:col-span-4 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Study Activity (Last 14 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.dailyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis 
                    dataKey="date" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    className="text-muted-foreground" 
                />
                <YAxis 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    className="text-muted-foreground" 
                    allowDecimals={false}
                />
                <Tooltip 
                    cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--background)' }}
                />
                <Bar 
                    dataKey="reviews" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]} 
                    maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}