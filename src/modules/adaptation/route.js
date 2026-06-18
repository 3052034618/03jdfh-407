const express = require('express');
const router = express.Router();
const { generatePuzzle } = require('../puzzle/generator');
const { createPuzzleRequest, createDifficultyConstraint } = require('../../models/schemas');
const { REPLAY_ADAPTATIONS, getAdaptationLevel } = require('../../templates/adaptations');
const { getSession, updatePlayerState } = require('../../store/sessionStore');

router.get('/levels', (req, res) => {
  res.json({
    adaptationLevels: REPLAY_ADAPTATIONS.map(a => ({
      level: a.level,
      label: a.label,
      description: a.description,
      clarityMultiplier: a.clarityMultiplier,
      extraClues: a.extraClues,
      revealDirectClue: a.revealDirectClue,
    })),
  });
});

router.post('/replay', (req, res) => {
  const { sessionId, puzzleRequest, difficulty, forceLevel } = req.body;

  let playerState = { failureCount: 0, hintsUsed: 0, totalTimeSpent: 0, lastAttemptAnswer: null };

  if (sessionId) {
    const session = getSession(sessionId);
    if (session) {
      playerState = { ...session.playerState };
    }
  }

  const effectiveFailureCount = forceLevel !== undefined
    ? forceLevel * 2
    : playerState.failureCount;

  playerState.failureCount = effectiveFailureCount;

  const adaptation = getAdaptationLevel(effectiveFailureCount);

  if (!puzzleRequest) {
    return res.json({
      adaptationLevel: adaptation.level,
      adaptationLabel: adaptation.label,
      adaptationDescription: adaptation.description,
      clarityMultiplier: adaptation.clarityMultiplier,
      extraClues: adaptation.extraClues,
      revealDirectClue: adaptation.revealDirectClue,
      failureCount: effectiveFailureCount,
      nextLevelThreshold: adaptation.level < 3
        ? REPLAY_ADAPTATIONS[adaptation.level + 1].level
        : null,
    });
  }

  const puzzleReq = createPuzzleRequest(puzzleRequest);
  if (!puzzleReq.valid) {
    return res.status(400).json({
      error: 'INVALID_REQUEST',
      messages: puzzleReq.errors,
    });
  }

  const difficultyInput = difficulty || {};
  const diff = createDifficultyConstraint(difficultyInput);

  const puzzle = generatePuzzle(puzzleReq, diff, playerState);

  res.json({
    puzzleId: puzzle.puzzleId,
    broadcast: puzzle.broadcast,
    clues: puzzle.clues,
    adaptation: puzzle.adaptation,
    adaptationLevel: adaptation.level,
    adaptationLabel: adaptation.label,
    adaptationDescription: adaptation.description,
    clarityMultiplier: adaptation.clarityMultiplier,
  });
});

router.post('/report-failure', (req, res) => {
  const { sessionId, failureType } = req.body;

  if (!sessionId) {
    return res.status(400).json({
      error: 'INVALID_REQUEST',
      messages: ['sessionId is required'],
    });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      error: 'SESSION_NOT_FOUND',
      messages: ['No session found with the given sessionId'],
    });
  }

  const updatedSession = updatePlayerState(sessionId, {
    failureCount: session.playerState.failureCount + 1,
  });

  const adaptation = getAdaptationLevel(updatedSession.playerState.failureCount);

  res.json({
    sessionId,
    failureCount: updatedSession.playerState.failureCount,
    adaptationLevel: adaptation.level,
    adaptationLabel: adaptation.label,
    adaptationDescription: adaptation.description,
    nextReplayWillBe: adaptation.label,
    hint: adaptation.level >= 2
      ? '下次重播将包含更明确的线索'
      : '保持神秘感，广播将在下次加入微弱引导',
  });
});

module.exports = router;
