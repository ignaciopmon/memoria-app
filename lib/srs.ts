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
  enable_max_interval?: boolean; // NUEVO: Switch para activar
  max_interval_days?: number;    // NUEVO: Límite de días
  zen_mode?: boolean;
  sound_enabled?: boolean;
}

export type Rating = 1 | 2 | 3 | 4;

const ABSOLUTE_MAX_INTERVAL = 3650; // Límite de seguridad de 10 años para evitar errores en BD

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

  if (rating < 3) {
    repetitions = 0;
    if (rating === 1) {
      interval = 0;
      nextReviewDate = addMinutes(now, safeSettings.again);
    } else {
      if (card.last_rating === 2) {
        interval = Math.max(1, Math.round(interval * 0.5));
      } else {
        interval = safeSettings.hard;
      }
    }
  } else {
    repetitions += 1;
    if (repetitions === 1) {
      interval = safeSettings.good;
    } else if (repetitions === 2) {
      interval = safeSettings.easy;
    } else {
      interval = Math.round(interval * ease_factor);
    }
  }

  // Ajuste del Ease Factor
  ease_factor = ease_factor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
  ease_factor = Math.max(1.3, Number(ease_factor.toFixed(2)));

  // 1. Aplicamos el límite absoluto de seguridad siempre
  interval = Math.min(interval, ABSOLUTE_MAX_INTERVAL);

  // 2. Si el "Modo Examen" está activado, aplicamos tu límite personalizado
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