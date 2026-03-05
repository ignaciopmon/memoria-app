export type ExpansionStatus = "Learning" | "Reviewing" | "Mastered" | "Needs Focus";

export const EXPANSION_PASS_THRESHOLD = 80;
export const EXPANSION_INITIAL_INTERVAL = 30;
export const EXPANSION_HAND_BRAKE_INTERVAL = 3;
export const EXPANSION_MASTERED_FROM = 60;

export interface ExpansionCycleUpdateInput {
  score: number;
  total: number;
  currentInterval?: number | null;
  currentStatus?: ExpansionStatus | null;
}

export interface ExpansionCycleUpdate {
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  previousInterval: number;
  previousStatus: ExpansionStatus;
  newInterval: number;
  newStatus: ExpansionStatus;
}

export const toReviewLevel = (interval: number) => `R${Math.max(0, Math.round(interval))}`;

export const calculateExpansionCycleUpdate = ({
  score,
  total,
  currentInterval,
  currentStatus,
}: ExpansionCycleUpdateInput): ExpansionCycleUpdate | null => {
  if (!Number.isFinite(total) || total <= 0) {
    return null;
  }

  const safeScore = Number.isFinite(score) ? Math.max(0, score) : 0;
  const previousInterval = Math.max(0, Math.floor(currentInterval ?? 0));
  const previousStatus: ExpansionStatus = (currentStatus as ExpansionStatus) ?? "Learning";
  const percentage = Math.round((safeScore / total) * 100);
  const passed = percentage >= EXPANSION_PASS_THRESHOLD;

  let newInterval = 0;
  let newStatus: ExpansionStatus = "Learning";

  if (passed) {
    newInterval = previousInterval === 0 ? EXPANSION_INITIAL_INTERVAL : previousInterval * 2;
    newStatus = newInterval >= EXPANSION_MASTERED_FROM ? "Mastered" : "Reviewing";
  } else {
    newInterval = EXPANSION_HAND_BRAKE_INTERVAL;
    newStatus = "Needs Focus";
  }

  return {
    score: safeScore,
    total,
    percentage,
    passed,
    previousInterval,
    previousStatus,
    newInterval,
    newStatus,
  };
};
