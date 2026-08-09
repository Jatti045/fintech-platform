/**
 * Goal-pace helpers — pure functions used by the “Ascent” goals experience.
 *
 * Because goals carry `createdAt` and `progress` (but no planned completion
 * date), we derive a contribution *pace* from those two fields and use it to
 * estimate how many days remain until the target is reached.
 */

import { safeAmount } from "@/utils/transaction/helpers";

const DAY_MS = 86_400_000;

export interface GoalPace {
  /** Whole days since the goal was created. */
  daysActive: number;
  /**
   * Average contribution per 7-day block so far.
   * `null` when there is not enough data yet.
   */
  weeklyContribution: number | null;
  /**
   * Estimated days until the remaining target is reached at the current
   * pace. `null` when the pace is unknown or the goal is already achieved.
   */
  completionDays: number | null;
}

export function calcGoalPace(
  goal: {
    createdAt?: string | null;
    progress?: number | string;
    target?: number | string;
  },
  now: Date = new Date(),
): GoalPace {
  const progress = safeAmount(goal.progress);
  const target = safeAmount(goal.target);
  const remaining = Math.max(0, target - progress);

  let daysActive = 0;
  if (goal.createdAt) {
    const created = new Date(goal.createdAt);
    if (!Number.isNaN(created.getTime())) {
      daysActive = Math.max(
        0,
        Math.floor((now.getTime() - created.getTime()) / DAY_MS),
      );
    }
  }

  const hasData = daysActive > 0 && progress > 0;
  const weeklyContribution =
    daysActive > 0 && progress > 0 ? progress / (daysActive / 7) : null;

  if (!hasData || remaining <= 0) {
    return { daysActive, weeklyContribution, completionDays: null };
  }

  const pacePerDay = progress / daysActive;
  const rawDays = Math.ceil(remaining / pacePerDay);
  return {
    daysActive,
    weeklyContribution,
    completionDays: Number.isFinite(rawDays) ? Math.max(1, rawDays) : null,
  };
}

/**
 * Human-friendly estimate like "~46d" — or `null` when unknown.
 */
export function completionEstimateLabel(goal: GoalPace): string | null {
  if (goal.completionDays == null) return null;
  const d = goal.completionDays;
  if (d <= 1) return "~1 day";
  if (d < 7) return `~${d} days`;
  const weeks = Math.round(d / 7);
  return weeks <= 1 ? "~1 wk" : `~${weeks} wks`;
}