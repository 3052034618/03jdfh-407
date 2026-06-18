const express = require('express');
const router = express.Router();
const { createPuzzleRequest, createDifficultyConstraint, createPlayerState } = require('../../models/schemas');
const { generatePuzzle, applyPlatformLimits } = require('./generator');
const { getSession, addPuzzleToSession, updatePlayerState } = require('../../store/sessionStore');

router.post('/request', (req, res) => {
  const puzzleReq = createPuzzleRequest(req.body);
  if (!puzzleReq.valid) {
    return res.status(400).json({
      error: 'INVALID_REQUEST',
      messages: puzzleReq.errors,
    });
  }

  const difficultyInput = req.body.difficulty || {};
  const platform = difficultyInput.platform || puzzleReq.platform || 'pc';

  const baseDifficulty = createDifficultyConstraint({
    ...difficultyInput,
    platform,
  });

  const { constraints: adjustedDifficulty, adjustments } = applyPlatformLimits(baseDifficulty, platform);
  adjustedDifficulty._adjustments = adjustments;
  adjustedDifficulty.platform = platform;

  const sessionId = req.body.sessionId;
  let playerState = createPlayerState(req.body.playerState || {});
  let session = null;

  if (sessionId) {
    session = getSession(sessionId);
    if (session) {
      playerState = {
        ...playerState,
        ...session.playerState,
        ...(req.body.playerState || {}),
      };
    }
  }

  const requestForGenerator = {
    ...puzzleReq,
    forbiddenInfo: puzzleReq.forbiddenInfo || [],
  };

  const puzzle = generatePuzzle(requestForGenerator, adjustedDifficulty, playerState);

  if (sessionId && session) {
    addPuzzleToSession(sessionId, puzzle.puzzleId, puzzle);
    updatePlayerState(sessionId, { failureCount: playerState.failureCount });
  }

  const platformWarnings = adjustments.map(a => a.reason);

  const response = {
    puzzleId: puzzle.puzzleId,
    chapterId: puzzle.chapterId,
    createdAt: puzzle.createdAt,
    broadcast: puzzle.broadcast,
    clues: puzzle.clues,
    wrongFeedback: puzzle.wrongFeedback,
    successHook: puzzle.successHook,
    difficulty: puzzle.difficulty,
    adaptation: puzzle.adaptation,
    answer: puzzle.answer,
    platform: puzzle.platform,
    platformAdjustments: adjustments,
    platformWarnings: platformWarnings.length > 0 ? platformWarnings : undefined,
    spoilerFilter: puzzle.spoilerFilter,
    forbiddenInfoFiltered: puzzle.forbiddenInfoFiltered,
    sessionId: sessionId || undefined,
  };

  res.json(response);
});

router.post('/verify', (req, res) => {
  const { sessionId, puzzleId, answer } = req.body;
  if (!puzzleId || answer === undefined) {
    return res.status(400).json({
      error: 'INVALID_REQUEST',
      messages: ['puzzleId and answer are required'],
    });
  }

  let isCorrect = false;
  const correctAnswer = req.body._correctAnswer;

  if (correctAnswer !== undefined && correctAnswer !== null) {
    if (typeof correctAnswer === 'object' && correctAnswer.value !== undefined) {
      isCorrect = JSON.stringify(answer) === JSON.stringify(correctAnswer.value);
    } else {
      isCorrect = String(answer).trim() === String(correctAnswer).trim();
    }
  } else {
    isCorrect = true;
  }

  let failureCount = 0;
  let session = null;

  if (sessionId) {
    session = getSession(sessionId);
    if (session) {
      const sessionStore = require('../../store/sessionStore');
      sessionStore.recordAttempt(sessionId, puzzleId, answer, isCorrect);
      failureCount = session.playerState.failureCount + (isCorrect ? 0 : 1);
    }
  } else {
    failureCount = (req.body.currentFailureCount || 0) + (isCorrect ? 0 : 1);
  }

  const { getAdaptationLevel } = require('./generator');
  const adaptation = getAdaptationLevel(failureCount);

  res.json({
    correct: isCorrect,
    failureCount,
    adaptationLevel: adaptation.level,
    adaptationLabel: adaptation.label,
    message: isCorrect
      ? '谜题已解决。前方的路已打开。'
      : '答案不正确。广播将在稍后重播……',
    nextReplay: isCorrect ? null : {
      level: adaptation.level,
      label: adaptation.label,
      description: adaptation.description,
    },
  });
});

module.exports = router;
