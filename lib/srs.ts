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
}

export type Rating = 1 | 2 | 3 | 4;

/**
 * Calculates the next review schedule based on the rating and user settings.
 * Implements a variation of the SM-2 algorithm.
 */
export const calculateNextReview = (card: CardSRS, rating: Rating, settings: UserSettings) => {
  let { ease_factor, interval, repetitions } = card;

  // Default values if settings are missing/partial
  const safeSettings = {
    again: settings?.again_interval_minutes ?? 1,
    hard: settings?.hard_interval_days ?? 1,
    good: settings?.good_interval_days ?? 3,
    easy: settings?.easy_interval_days ?? 7,
  };

  const now = new Date();
  let nextReviewDate = now;

  if (rating < 3) {
    // Incorrect answer (Again or Hard)
    repetitions = 0;
    if (rating === 1) {
      interval = 0;
      nextReviewDate = addMinutes(now, safeSettings.again);
    } else {
      if (card.last_rating === 2) {
        interval = Math.max(1, Math.ceil(interval * 0.5));
      } else {
        interval = safeSettings.hard;
      }
    }
  } else {
    // Correct answer (Good or Easy)
    repetitions += 1;
    if (repetitions === 1) {
      interval = safeSettings.good;
    } else if (repetitions === 2) {
      interval = safeSettings.easy;
    } else {
      interval = Math.ceil(interval * ease_factor);
    }
  }

  // Adjust Ease Factor (Standard SM-2 adjustment)
  // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  ease_factor = Math.max(1.3, ease_factor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02)));

  // Apply interval for valid ratings > 1 (Again handled by minutes above)
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