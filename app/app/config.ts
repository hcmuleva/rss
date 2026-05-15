const config = {
  // Quiz settings
  quiz: {
    questionsPerSession: 10,
    timerDurationYoung: 15,    // age <= 8
    timerDurationOlder: 15,    // age > 8
    noTimerCategories: ['emotions', 'brain'],
    hintCategories: ['brain'],
    scoreThresholds: {
      legendary: 8,
      great: 5,
    },
  },

  // Story builder settings
  story: {
    questionsPerStory: 5,
    maxSavedStories: 10,
    maxStoryWords: {
      young: 500,   // age <= 8
      older: 500,   // age > 8
    },
  },

  // AI settings
  ai: {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 1024,
    storyMaxTokens: 3000,
  },

  // Streak settings
  streak: {
    resetHours: 24,
    freezeShieldDays: 1,
    milestoneDays: [7, 30, 100],
  },

  // Player profiles
  profiles: {
    ani: {
      name: 'Ani',
      age: 13,
      theme: '#7F77DD',
      secondaryTheme: '#EEEDFE',
    },
    anu: {
      name: 'Anu',
      age: 7,
      theme: '#D85A30',
      secondaryTheme: '#FAECE7',
    },
  },

  // Flag settings
  flags: {
    totalCountries: 65,
    resetThreshold: 10,  // reset used list when fewer than this remain
  },

  // History tracking
  history: {
    maxUsedQuestions: 50,
    maxUsedFlags: 65,
  },
  xp: {
    sources: {
      quizCorrectAnswer: 1,
      quizSessionComplete: 5,
      storyComplete: 8,
      storyPerfectQuiz: 5,
      puzzlePattern: 2,
      puzzleNumbers: 3,
      puzzleMemory: 4,
      puzzleRiddles: 3,
      puzzleScramble: 3,
      puzzleLogic: 5,
      puzzleCode: 6,
      puzzleStageUp: 10,
      puzzleTypeUnlock: 20,
      puzzlePerfectStreak: 5,
      dailyChallenge: 6,
      streakMilestone: 20,
    },
    levelThresholds: [0, 50, 120, 220, 350, 520, 730, 990, 1300, 1700],
    levelUpBonusXP: 500,
  },

  // Puzzle unlock thresholds
  puzzleUnlocks: {
    patterns: 0,
    numbers: 20,
    memory: 50,
    riddles: 100,
    scramble: 180,
    logic: 280,
    codebreaker: 400,
  },

  // Puzzle adaptive difficulty
  puzzleDifficulty: {
    correctToLevelUp: 5,
    wrongToLevelDown: 3,
    maxStage: 8,
    minStage: 1,
    dailyXPLimit: 10,
  },
};

export default config;