const { v4: uuidv4 } = require('uuid');

const sessions = new Map();

function createTimelineEvent(type, data = {}) {
  return {
    id: uuidv4(),
    type,
    timestamp: new Date().toISOString(),
    ...data,
  };
}

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
    timeline: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  session.timeline.push(createTimelineEvent('session_created', {
    chapterId,
    failureCount: 0,
  }));
  sessions.set(sessionId, session);
  return session;
}

function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

function getSessionTimeline(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  return session.timeline.slice().sort((a, b) =>
    new Date(a.timestamp) - new Date(b.timestamp)
  );
}

function updatePlayerState(sessionId, updates) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  const beforeFailure = session.playerState.failureCount;
  Object.assign(session.playerState, updates);
  session.updatedAt = new Date().toISOString();
  if (updates.failureCount !== undefined && beforeFailure !== updates.failureCount) {
    session.timeline.push(createTimelineEvent('player_state_updated', {
      beforeFailure,
      afterFailure: session.playerState.failureCount,
      updates,
    }));
  }
  return session;
}

function recordAttempt(sessionId, puzzleId, answer, correct) {
  const session = sessions.get(sessionId);
  if (!session) return null;

  const beforeFailure = session.playerState.failureCount;
  if (!correct) {
    session.playerState.failureCount += 1;
  }
  session.playerState.lastAttemptAnswer = answer;
  session.updatedAt = new Date().toISOString();

  const puzzleRecord = session.puzzles.find(p => p.puzzleId === puzzleId);
  let puzzleIndex = session.puzzles.findIndex(p => p.puzzleId === puzzleId);
  if (puzzleIndex < 0) puzzleIndex = 0;
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

  session.timeline.push(createTimelineEvent('attempt_recorded', {
    puzzleId,
    puzzleIndex,
    answer,
    correct,
    beforeFailure,
    afterFailure: session.playerState.failureCount,
    deltaFailure: session.playerState.failureCount - beforeFailure,
  }));

  return session;
}

function addPuzzleToSession(sessionId, puzzleId, puzzleData, snapshot = null) {
  const session = sessions.get(sessionId);
  if (!session) return null;

  const index = session.puzzles.length;
  const record = {
    puzzleId,
    answerType: puzzleData.answer?.type,
    answerValue: puzzleData.answer?.value,
    currentMap: puzzleData.currentMap,
    platform: puzzleData.platform,
    adaptationLevel: puzzleData.adaptation?.level,
    attempts: [],
    solved: false,
    createdAt: new Date().toISOString(),
    fullSnapshot: snapshot,
  };
  session.puzzles.push(record);
  session.updatedAt = new Date().toISOString();

  session.timeline.push(createTimelineEvent('puzzle_generated', {
    puzzleId,
    puzzleIndex: index,
    answerType: record.answerType,
    currentMap: record.currentMap,
    platform: record.platform,
    failureCountAtGen: session.playerState.failureCount,
    adaptationLevel: record.adaptationLevel,
    broadcastSnapshot: snapshot ? {
      text: snapshot.broadcast?.text,
      clues: snapshot.clues?.map(c => ({ id: c.id, type: c.type, text: c.text })),
      adaptationLevel: snapshot.adaptation?.level,
      adaptationName: snapshot.adaptation?.name,
    } : null,
  }));

  return session;
}

function recordReplay(sessionId, puzzleId, level, failureCount, snapshot = null) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  const puzzleIndex = session.puzzles.findIndex(p => p.puzzleId === puzzleId);

  session.timeline.push(createTimelineEvent('replay_requested', {
    puzzleId,
    puzzleIndex,
    adaptationLevel: level,
    failureCount,
    replayBroadcast: snapshot ? {
      text: snapshot.broadcast?.text,
      adaptationLevel: snapshot.adaptation?.level,
      adaptationName: snapshot.adaptation?.name,
      clues: snapshot.clues?.map(c => ({ id: c.id, type: c.type, text: c.text })),
    } : null,
  }));

  return session;
}

function recordFailureReport(sessionId, countBefore, countAfter, reason = 'manual') {
  const session = sessions.get(sessionId);
  if (!session) return null;

  session.timeline.push(createTimelineEvent('failure_reported', {
    beforeFailure: countBefore,
    afterFailure: countAfter,
    delta: countAfter - countBefore,
    reason,
  }));

  return session;
}

function resetSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  const beforeFailure = session.playerState.failureCount;
  session.playerState = {
    failureCount: 0,
    hintsUsed: 0,
    totalTimeSpent: 0,
    lastAttemptAnswer: null,
  };
  session.updatedAt = new Date().toISOString();
  session.timeline.push(createTimelineEvent('session_reset', {
    beforeFailure,
    afterFailure: 0,
  }));
  return session;
}

function getTimelineEvent(sessionId, eventId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  return session.timeline.find(e => e.id === eventId) || null;
}

function listSessions() {
  return Array.from(sessions.values()).map(s => ({
    sessionId: s.sessionId,
    chapterId: s.chapterId,
    puzzleCount: s.puzzles.length,
    failureCount: s.playerState.failureCount,
    timelineEventCount: s.timeline.length,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }));
}

module.exports = {
  createSession,
  getSession,
  getSessionTimeline,
  getTimelineEvent,
  updatePlayerState,
  recordAttempt,
  addPuzzleToSession,
  recordReplay,
  recordFailureReport,
  resetSession,
  listSessions,
};
