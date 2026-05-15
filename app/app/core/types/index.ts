// User & Authentication Types
export interface User {
  id: number;
  email: string;
  firstName: string;
  fatherName: string;
  husbandName?: string | null;
  gotra: string;
  dob: string;
  gender: 'M' | 'F' | 'O';
  family_id: number;
  role: string;
  roleCategoryLabel?: string | null;
  maritalStatus?: string | null;
  occupation?: string | null;
  districtCode?: string | null;
  seerviCardId?: string | null;
  profilePhotoUrl?: string | null;
  assignment_level?: string | null;
  state?: string | null;
  district?: string | null;
  tehsil?: string | null;
  village?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  firstName: string;
  fatherName: string;
  dob: string;
  gotra: string;
  gender: 'M' | 'F' | 'O';
  maritalStatus: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  data: {
    user: User;
    tokens: AuthTokens;
  };
}

// ELS Profile Types
export interface ELSProfile {
  id: number;
  userId: number;
  profileName: string;
  dateOfBirth: string;
  ageGroup: 'AG1' | 'AG2' | 'AG3' | 'AG4';
  age: number;
  gender: 'female' | 'male' | 'other' | 'prefer_not_to_say';
  gradeLevel?: string;
  theme: string;
  secondaryColor?: string;
  difficultyPreference?: 'auto' | 'easy' | 'medium' | 'hard';
  sessionTimeLimit?: number;
  hasBaselineAssessment: boolean;
  baselineCompletedAt?: string;
  lastELSEvaluationAt?: string;
  xp?: {
    total: number;
    level: number;
  };
  streak?: {
    current: number;
    longest: number;
  };
  createdAt: string;
}

export interface CreateProfileRequest {
  userId: number;
  profileName: string;
  dateOfBirth: string;
  ageGroup: 'AG1' | 'AG2' | 'AG3' | 'AG4';
  gender: 'female' | 'male' | 'other' | 'prefer_not_to_say';
  gradeLevel?: string;
  theme: string;
}

// XP & Progress Types
export interface XPData {
  profileId: number;
  totalXP: number;
  currentLevel: number;
  xpToNextLevel: number;
  xpInCurrentLevel: number;
  progressPercent: number;
  breakdown: {
    quizXP: number;
    storyXP: number;
    puzzleXP: number;
  };
  dailyXP: number;
}

export interface StreakData {
  profileId: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate?: string;
  hasShield: boolean;
  shieldUsedDate?: string;
}

// Activity Tracking Types
export interface ActivityTrackRequest {
  profileId: number;
  activityType: 'quiz' | 'story' | 'puzzle';
  activityId: string;
  durationSeconds: number;
  score?: number;
  totalQuestions?: number;
  categoryMappings?: Array<{
    category: string;
    value: number;
  }>;
  focusDuration?: number;
  distractions?: number;
  hintsUsed?: number;
}

export interface ActivitySummary {
  profileId: number;
  period: {
    start: string;
    end: string;
  };
  totalActivities: number;
  totalHours: number;
  avgAccuracy: number;
  breakdown: {
    quiz: number;
    story: number;
    puzzle: number;
  };
}

// Baseline Assessment Types
export interface BaselineAssessment {
  assessmentId: number;
  profileId: number;
  status: 'in_progress' | 'completed';
  startedAt: string;
  completedAt?: string;
  totalQuestions: number;
  sections: string[];
}

export interface BaselineResponse {
  categoryCode: string;
  questionId: string;
  questionText: string;
  questionType: string;
  responseValue: any;
  responseScore: number;
  weight?: number;
}

export interface BaselineReport {
  assessmentId: number;
  profileId: number;
  completedAt: string;
  completedBy: string;
  parentConfidence: number;
  overallScore: number;
  categoryScores: Array<{
    code: string;
    name: string;
    score: number;
    confidence: number;
  }>;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
