import type { ProgressRating, ReportStatus, ToastVariant, TutorCardStatus } from "@/lib/types";

export const APP_NAME = "TechCiti Tutor Portal";
export const APP_FULL_NAME = "TechCiti Tutor Report Portal";
export const SITE_URL = "https://techciti.ng";
export const WHATSAPP_NUMBER = "2348012345678";
export const DEFAULT_COUNTRY_CODE = "234";

export const GRADES = [
  "Primary 1",
  "Primary 2",
  "Primary 3",
  "Primary 4",
  "Primary 5",
  "Primary 6",
  "JSS 1",
  "JSS 2",
  "JSS 3",
  "SSS 1",
  "SSS 2",
  "SSS 3",
] as const;

export const SUBJECTS = [
  "Mathematics",
  "English Language",
  "Basic Science",
  "Social Studies",
  "Computer Studies",
  "Basic Technology",
  "Civic Education",
  "Nigerian History",
  "Agricultural Science",
  "Further Mathematics",
  "Arts & Crafts",
  "Creative Arts",
] as const;

export const GENDERS = ["Male", "Female"] as const;

/** Chips offered above the "Topics covered" textarea to save typing. */
export const TOPIC_SUGGESTIONS: Record<string, string[]> = {
  Mathematics: [
    "Place value",
    "Addition & subtraction",
    "Multiplication tables",
    "Fractions",
    "Measurement & perimeter",
    "Word problems",
    "Shapes & angles",
    "Data handling",
  ],
  "English Language": [
    "Phonics",
    "Spelling rules",
    "Sentence construction",
    "Paragraph writing",
    "Comprehension",
    "Grammar & punctuation",
    "Vocabulary building",
    "Oral comprehension",
  ],
  "Basic Science": [
    "Living things",
    "Matter & materials",
    "Energy forms",
    "The human body",
    "Plants & animals",
    "Simple machines",
    "Forces & motion",
    "Our environment",
  ],
  "Computer Studies": [
    "Parts of a computer",
    "Keyboard & mouse skills",
    "Microsoft Word basics",
    "Typing speed",
    "Internet safety",
    "Digital citizenship",
    "Algorithms & flowcharts",
    "Introduction to coding",
  ],
  "Social Studies": [
    "Family & community",
    "Citizenship",
    "The Nigerian environment",
    "Map work",
    "Leadership & responsibility",
    "Cultural diversity",
  ],
  "Basic Technology": [
    "Safety in the workshop",
    "Tools and materials",
    "Measurement in technology",
    "Simple construction",
    "Electrical safety",
  ],
  "Civic Education": [
    "Rights and duties",
    "The Nigerian constitution",
    "National symbols",
    "Rule of law",
    "Environmental responsibility",
  ],
} as const;

export function topicSuggestionsFor(subject: string): string[] {
  return (TOPIC_SUGGESTIONS as Record<string, string[] | undefined>)[subject] ?? [];
}

/** Rating chip metadata — colour + helper copy, all from brand tokens. */
export const RATING_META: Record<
  ProgressRating,
  { variant: ToastVariant; description: string }
> = {
  Excellent: {
    variant: "success",
    description: "Consistently ahead, grasping new concepts quickly.",
  },
  Good: {
    variant: "default",
    description: "On track and meeting expectations.",
  },
  Fair: {
    variant: "warning",
    description: "Some gaps — needs extra practice.",
  },
  "Needs attention": {
    variant: "destructive",
    description: "Struggling; continuity next month is important.",
  },
};

/** Maps a report status to its badge tone (Tailwind classes, never raw hex). */
export const STATUS_META: Record<
  TutorCardStatus | ReportStatus,
  { label: string; badge: string; dot: string }
> = {
  not_started: {
    label: "Not started",
    badge: "bg-background text-muted-foreground border border-border",
    dot: "bg-muted-foreground",
  },
  draft: {
    label: "Draft",
    badge: "bg-warning-soft text-warning border border-transparent",
    dot: "bg-warning",
  },
  submitted: {
    label: "Submitted",
    badge: "bg-primary-soft text-primary border border-transparent",
    dot: "bg-primary",
  },
  reviewed: {
    label: "Reviewed",
    badge: "bg-success-soft text-success border border-transparent",
    dot: "bg-success",
  },
  needs_revision: {
    label: "Needs revision",
    badge: "bg-danger-soft text-danger border border-transparent",
    dot: "bg-danger",
  },
};

/** Grades grouped for a friendlier select. */
export function gradeGroups(): { label: string; grades: readonly string[] }[] {
  return [
    { label: "Primary", grades: GRADES.slice(0, 6) },
    { label: "Junior Secondary", grades: GRADES.slice(6, 9) },
    { label: "Senior Secondary", grades: GRADES.slice(9) },
  ];
}

/** Shown on the login page and in the README for local development. */
export const DEMO_ADMIN = {
  email: "admin@techciti.ng",
  password: "TechCiti2026!",
};

export const PLACEHOLDER_STUDENT_IMAGE =
  "https://images.unsplash.com/photo-1544716798-6792525b84c2?auto=format&fit=crop&w=400&q=60";