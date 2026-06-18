const { v4: uuidv4 } = require('uuid');

const sessions = new Map();

function createSession(chapterId) {
  const sessionId = uuidv4();
  const session = {
    sessionId,
    chapterId,
    puzzles: [],
    playerState: {
      failureCount: 0,
      hintsUsed: 0,
      totalTimeSpent: 0,
      lastAttemptAnswer: null,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  sessions.set(sessionId, session);
  return session;
}

function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

function updatePlayerState(sessionId, updates) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  Object.assign(session.playerState, updates);
  session.updatedAt = new Date().toISOString();
  return session;
}

function recordAttempt(sessionId, puzzleId, answer, correct) {
  const session = sessions.get(sessionId);
  if (!session) return null;

  if (!correct) {
    session.playerState.failureCount += 1;
  }
  session.playerState.lastAttemptAnswer = answer;
  session.updatedAt = new Date().toISOString();

  const puzzleRecord = session.puzzles.find(p => p.puzzleId === puzzleId);
  if (puzzleRecord) {
    puzzleRecord.attempts.push({
      answer,
      correct,
      timestamp: new Date().toISOString(),
      failureCountAtAttempt: session.playerState.failureCount,
    });
    if (correct) {
      puzzleRecord.solved = true;
      puzzleRecord.solvedAt = new Date().toISOString();
    }
  }

  return session;
}

function addPuzzleToSession(sessionId, puzzleId, puzzleData) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  session.puzzles.push({
    puzzleId,
    answerType: puzzleData.answer.type,
    attempts: [],
    solved: false,
    createdAt: new Date().toISOString(),
  });
  session.updatedAt = new Date().toISOString();
  return session;
}

function resetSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  session.playerState = {
    failureCount: 0,
    hintsUsed: 0,
    totalTimeSpent: 0,
    lastAttemptAnswer: null,
  };
  session.updatedAt = new Date().toISOString();
  return session;
}

function listSessions() {
  return Array.from(sessions.values()).map(s => ({
    sessionId: s.sessionId,
    chapterId: s.chapterId,
    puzzleCount: s.puzzles.length,
    failureCount: s.playerState.failureCount,
    createdAt: s.createdAt,
  }));
}

module.exports = {
  createSession,
  getSession,
  updatePlayerState,
  recordAttempt,
  addPuzzleToSession,
  resetSession,
  listSessions,
};
