/** Shared, framework-agnostic constants and domain vocabulary. */

/** Monthly report cadence and level vocabulary. */
export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export const AGE_GROUPS = ["KIDS", "TEENS", "ADULTS"] as const;
export const LEVELS = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
export const PROGRESS_RATINGS = ["EXCELLENT", "GOOD", "FAIR", "NEEDS_ATTENTION"] as const;
export const REPORT_STATUSES = ["DRAFT", "SUBMITTED", "REVIEWED", "NEEDS_REVISION"] as const;
export const COURSE_CATEGORIES = [
  "Web",
  "Programming",
  "Design",
  "Data",
  "Robotics",
  "Kids Coding",
] as const;

/** Human labels used in PDFs, Word docs and emails. */
export const AGE_GROUP_LABELS: Record<string, string> = {
  KIDS: "Kids",
  TEENS: "Teens",
  ADULTS: "Adults",
};

export const LEVEL_LABELS: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

export const RATING_LABELS: Record<string, string> = {
  EXCELLENT: "Excellent",
  GOOD: "Good",
  FAIR: "Fair",
  NEEDS_ATTENTION: "Needs attention",
};

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  REVIEWED: "Reviewed",
  NEEDS_REVISION: "Needs revision",
  NOT_STARTED: "Not started",
};

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Marks a status as "counted as finished" for the tutor progress bar. */
export const COMPLETED_REPORT_STATUSES = ["SUBMITTED", "REVIEWED"] as const;