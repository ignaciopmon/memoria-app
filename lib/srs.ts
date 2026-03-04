// lib/srs.ts
import { addDays, addMinutes } from 'date-fns';

export interface CardSRS {
  id?: string;
  ease_factor: number;
  interval: number;
  repetitions: number;
  last_rating: number | null;
}

export interface UserSettings {
  again_interval_minutes: number;
  hard_interval_days: number;
  good_interval_days: number;
  easy_interval_days: number;
  enable_max_interval?: boolean;
  max_interval_days?: number;
  zen_mode?: boolean;
  sound_enabled?: boolean;
}

export type Rating = 1 | 2 | 3 | 4;

const ABSOLUTE_MAX_INTERVAL = 3650; // Límite de seguridad de 10 años

export const calculateNextReview = (card: CardSRS, rating: Rating, settings: UserSettings) => {
  let { ease_factor, interval, repetitions } = card;

  const safeSettings = {
    again: settings?.again_interval_minutes ?? 1,
    hard: settings?.hard_interval_days ?? 1,
    good: settings?.good_interval_days ?? 3,
    easy: settings?.easy_interval_days ?? 7,
    enable_max: settings?.enable_max_interval ?? false,
    max_days: settings?.max_interval_days ?? 30,
  };

  const now = new Date();
  let nextReviewDate = now;

  // LÓGICA DE FRENO DE MANO Y REGLA DEL DOBLE
  if (rating < 3) {
    // Si falla (1 o 2), se reinicia la tarjeta
    repetitions = 0;
    if (rating === 1) {
      interval = 0;
      nextReviewDate = addMinutes(now, safeSettings.again);
    } else {
      interval = safeSettings.hard; // Hard te da un pequeño margen de 1 día
    }
  } else {
    // Si acierta (3 o 4)
    repetitions += 1;
    if (repetitions === 1) {
      interval = safeSettings.good;
    } else if (repetitions === 2) {
      interval = safeSettings.easy;
    } else {
      // REGLA DEL DOBLE: R30 -> R60 -> R120
      interval = interval === 0 ? safeSettings.good : interval * 2;
    }
  }

  // Mantenemos el ease_factor por compatibilidad con la base de datos
  ease_factor = ease_factor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
  ease_factor = Math.max(1.3, Number(ease_factor.toFixed(2)));

  // Límite absoluto
  interval = Math.min(interval, ABSOLUTE_MAX_INTERVAL);

  // Límite de usuario (Modo Examen)
  if (safeSettings.enable_max) {
    interval = Math.min(interval, safeSettings.max_days);
  }

  if (rating > 1) {
    nextReviewDate = addDays(now, interval);
  }

  return {
    ease_factor,
    interval,
    repetitions,
    next_review_date: nextReviewDate.toISOString(),
    last_rating: rating,
  };
};