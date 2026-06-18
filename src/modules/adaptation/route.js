const express = require('express');
const router = express.Router();
const { generatePuzzle, applyPlatformLimits } = require('../puzzle/generator');
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
      minFailures: a.level === 0 ? 0 : a.level * 2 - 1,
    })),
  });
});

function resolveFailureCount(req) {
  const { sessionId, failureCount, forceLevel } = req.body;

  if (forceLevel !== undefined && forceLevel !== null && !isNaN(forceLevel)) {
    const level = Math.max(0, Math.min(3, parseInt(forceLevel)));
    return {
      failureCount: level * 2,
      source: 'forceLevel',
      forceLevel: level,
    };
  }

  if (failureCount !== undefined && failureCount !== null && !isNaN(failureCount)) {
    return {
      failureCount: Math.max(0, parseInt(failureCount)),
      source: 'direct',
    };
  }

  if (sessionId) {
    const session = getSession(sessionId);
    if (session) {
      return {
        failureCount: session.playerState.failureCount,
        source: 'session',
        sessionId,
      };
    }
  }

  return { failureCount: 0, source: 'default' };
}

router.post('/replay', (req, res) => {
  const { sessionId, puzzleRequest, difficulty, forceLevel, failureCount } = req.body;

  const fcInfo = resolveFailureCount(req);
  const playerState = {
    failureCount: fcInfo.failureCount,
    hintsUsed: 0,
    totalTimeSpent: 0,
    lastAttemptAnswer: null,
  };

  const adaptation = getAdaptationLevel(playerState.failureCount);

  if (!puzzleRequest) {
    return res.json({
      adaptationLevel: adaptation.level,
      adaptationLabel: adaptation.label,
      adaptationDescription: adaptation.description,
      clarityMultiplier: adaptation.clarityMultiplier,
      extraClues: adaptation.extraClues,
      revealDirectClue: adaptation.revealDirectClue,
      failureCount: fcInfo.failureCount,
      failureSource: fcInfo.source,
      nextLevelThreshold: adaptation.level < 3
        ? (adaptation.level + 1) * 2 - 1
        : null,
      broadcastSuffix: adaptation.broadcastSuffix || '',
    });
  }

  const puzzleReq = createPuzzleRequest(puzzleRequest);
  if (!puzzleReq.valid) {
    return res.status(400).json({
      error: 'INVALID_REQUEST',
      messages: puzzleReq.errors,
    });
  }

  const platform = difficulty?.platform || puzzleRequest.platform || 'pc';
  const baseDifficulty = createDifficultyConstraint({
    ...(difficulty || {}),
    platform,
  });

  const { constraints: adjustedDifficulty, adjustments } = applyPlatformLimits(baseDifficulty, platform);
  adjustedDifficulty._adjustments = adjustments;
  adjustedDifficulty.platform = platform;

  const requestForGenerator = {
    ...puzzleReq,
    forbiddenInfo: puzzleRequest.forbiddenInfo || puzzleReq.forbiddenInfo || [],
  };

  const puzzle = generatePuzzle(requestForGenerator, adjustedDifficulty, playerState);

  if (sessionId && getSession(sessionId)) {
    updatePlayerState(sessionId, { failureCount: playerState.failureCount });
  }

  res.json({
    puzzleId: puzzle.puzzleId,
    broadcast: puzzle.broadcast,
    clues: puzzle.clues,
    successHook: puzzle.successHook,
    answer: puzzle.answer,
    adaptation: puzzle.adaptation,
    adaptationLevel: adaptation.level,
    adaptationLabel: adaptation.label,
    adaptationDescription: adaptation.description,
    clarityMultiplier: adaptation.clarityMultiplier,
    failureCount: fcInfo.failureCount,
    failureSource: fcInfo.source,
    platformAdjustments: adjustments,
    spoilerFilter: puzzle.spoilerFilter,
    sessionId: sessionId || undefined,
  });
});

router.post('/report-failure', (req, res) => {
  const { sessionId, failureType } = req.body;

  let failureCount = 0;
  let session = null;

  if (sessionId) {
    session = getSession(sessionId);
    if (session) {
      failureCount = session.playerState.failureCount + 1;
      updatePlayerState(sessionId, { failureCount });
    }
  } else {
    failureCount = (req.body.currentFailureCount || 0) + 1;
  }

  const adaptation = getAdaptationLevel(failureCount);

  res.json({
    sessionId: sessionId || undefined,
    failureCount,
    adaptationLevel: adaptation.level,
    adaptationLabel: adaptation.label,
    adaptationDescription: adaptation.description,
    nextReplayWillBe: adaptation.label,
    nextReplayLevel: adaptation.level,
    hint: adaptation.level >= 2
      ? '下次重播将包含更明确的线索和重点重复'
      : '保持神秘感，广播将在下次加入微弱引导',
    broadcastSuffix: adaptation.broadcastSuffix || '',
  });
});

router.post('/calculate-level', (req, res) => {
  const { failureCount } = req.body;
  const fc = parseInt(failureCount) || 0;
  const adaptation = getAdaptationLevel(fc);

  res.json({
    failureCount: fc,
    adaptationLevel: adaptation.level,
    adaptationLabel: adaptation.label,
    adaptationDescription: adaptation.description,
    clarityMultiplier: adaptation.clarityMultiplier,
    extraClues: adaptation.extraClues,
    revealDirectClue: adaptation.revealDirectClue,
  });
});

module.exports = router;
