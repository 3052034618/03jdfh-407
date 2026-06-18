const VALID_ANSWER_TYPES = ['frequency', 'date', 'name', 'direction', 'code'];
const VALID_PLATFORMS = ['pc', 'console', 'mobile'];

const DIRECTION_VALUES = ['北', '南', '东', '西', '东北', '西北', '东南', '西南'];

const FREQUENCY_RANGES = [
  { min: 88.0, max: 92.0 },
  { min: 98.5, max: 104.5 },
  { min: 108.0, max: 120.0 },
];

const DATE_CONTEXTS = [
  { era: '民国', yearRange: [20, 38] },
  { era: '', yearRange: [1960, 1999] },
  { era: '', yearRange: [2000, 2024] },
];

function createPuzzleRequest(data) {
  const errors = [];
  if (!data.chapterId) errors.push('chapterId is required');
  if (!data.currentMap) errors.push('currentMap is required');
  if (!data.answerType || !VALID_ANSWER_TYPES.includes(data.answerType)) {
    errors.push(`answerType must be one of: ${VALID_ANSWER_TYPES.join(', ')}`);
  }
  if (data.platform && !VALID_PLATFORMS.includes(data.platform)) {
    errors.push(`platform must be one of: ${VALID_PLATFORMS.join(', ')}`);
  }

  return {
    chapterId: data.chapterId || '',
    currentMap: data.currentMap || '',
    playerItems: Array.isArray(data.playerItems) ? data.playerItems : [],
    forbiddenInfo: Array.isArray(data.forbiddenInfo) ? data.forbiddenInfo : [],
    answerType: data.answerType || 'frequency',
    platform: data.platform || 'pc',
    valid: errors.length === 0,
    errors,
  };
}

function createDifficultyConstraint(data) {
  return {
    minClueAppearances: data.minClueAppearances ?? 2,
    allowReversePlayback: data.allowReversePlayback ?? true,
    requiresPenAndPaper: data.requiresPenAndPaper ?? false,
    platform: data.platform || 'pc',
    maxSubSteps: data.maxSubSteps ?? 3,
    timeLimitSeconds: data.timeLimitSeconds ?? null,
    allowAudioOnly: data.allowAudioOnly ?? false,
  };
}

function createPlayerState(data) {
  return {
    failureCount: data.failureCount ?? 0,
    lastAttemptAnswer: data.lastAttemptAnswer || null,
    hintsUsed: data.hintsUsed ?? 0,
    totalTimeSpent: data.totalTimeSpent ?? 0,
  };
}

module.exports = {
  VALID_ANSWER_TYPES,
  VALID_PLATFORMS,
  DIRECTION_VALUES,
  FREQUENCY_RANGES,
  DATE_CONTEXTS,
  createPuzzleRequest,
  createDifficultyConstraint,
  createPlayerState,
};
