// Exam countdown and pace, computed from course.json examDate and attempt history.

import type { Course } from "./content/types";
import type { UnitStats } from "./attempts";

export type ExamPlan = {
  examDate: string;
  daysRemaining: number; // negative once past
  unitsRemaining: number;
  /** ceil(unitsRemaining / weeksRemaining); null when nothing remains or the exam has passed */
  unitsPerWeek: number | null;
};

export function examPlan(course: Course, stats: Map<string, UnitStats>, today = new Date()): ExamPlan | null {
  if (!course.examDate) return null;
  const [y, m, d] = course.examDate.split("-").map(Number);
  const exam = new Date(y, m - 1, d);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysRemaining = Math.round((exam.getTime() - start.getTime()) / 86_400_000);
  const unitsRemaining = course.units.filter((u) => !stats.has(`${course.slug}/${u.slug}`)).length;
  const weeks = daysRemaining / 7;
  const unitsPerWeek = daysRemaining > 0 && unitsRemaining > 0 ? Math.ceil(unitsRemaining / weeks) : null;
  return { examDate: course.examDate, daysRemaining, unitsRemaining, unitsPerWeek };
}
