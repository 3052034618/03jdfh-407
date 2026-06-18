const express = require('express');
const router = express.Router();
const { createPuzzleRequest, createDifficultyConstraint, createPlayerState } = require('../../models/schemas');
const { generatePuzzle } = require('./generator');
const { getSession, addPuzzleToSession } = require('../../store/sessionStore');

router.post('/request', (req, res) => {
  const puzzleReq = createPuzzleRequest(req.body);
  if (!puzzleReq.valid) {
    return res.status(400).json({
      error: 'INVALID_REQUEST',
      messages: puzzleReq.errors,
    });
  }

  const difficultyInput = req.body.difficulty || {};
  const difficulty = createDifficultyConstraint({
    ...difficultyInput,
    platform: difficultyInput.platform || puzzleReq.platform,
  });

  if (difficulty.platform === 'console' && difficulty.requiresPenAndPaper) {
    difficulty.requiresPenAndPaper = false;
    difficulty._adjustedPenAndPaper = true;
  }
  if (difficulty.platform === 'mobile' && difficulty.maxSubSteps > 4) {
    difficulty.maxSubSteps = 4;
    difficulty._adjustedMaxSubSteps = true;
  }

  const playerStateInput = req.body.playerState || {};
  const sessionId = req.body.sessionId;
  let playerState;

  if (sessionId) {
    const session = getSession(sessionId);
    if (session) {
      playerState = {
        ...session.playerState,
        ...playerStateInput,
      };
    } else {
      playerState = createPlayerState(playerStateInput);
    }
  } else {
    playerState = createPlayerState(playerStateInput);
  }

  const puzzle = generatePuzzle(puzzleReq, difficulty, playerState);

  if (sessionId) {
    addPuzzleToSession(sessionId, puzzle.puzzleId, puzzle);
  }

  const platformWarnings = [];
  if (difficulty._adjustedPenAndPaper) {
    platformWarnings.push('主机平台不支持纸笔记录要求，已自动关闭');
  }
  if (difficulty._adjustedMaxSubSteps) {
    platformWarnings.push('移动端最大子步骤已限制为4');
  }

  res.json({
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
    platformWarnings: platformWarnings.length > 0 ? platformWarnings : undefined,
    forbiddenInfoFiltered: puzzle.forbiddenInfoFiltered,
  });
});

router.post('/verify', (req, res) => {
  const { sessionId, puzzleId, answer } = req.body;
  if (!sessionId || !puzzleId || answer === undefined) {
    return res.status(400).json({
      error: 'INVALID_REQUEST',
      messages: ['sessionId, puzzleId, and answer are required'],
    });
  }

  const session = getSession(sessionId);
  if (!session) {
    return res.status(404).json({
      error: 'SESSION_NOT_FOUND',
      messages: ['No session found with the given sessionId'],
    });
  }

  const puzzleRecord = session.puzzles.find(p => p.puzzleId === puzzleId);
  if (!puzzleRecord) {
    return res.status(404).json({
      error: 'PUZZLE_NOT_FOUND',
      messages: ['No puzzle found in this session with the given puzzleId'],
    });
  }

  const { generateAnswer } = require('./generator');
  const correctAnswer = req.body._correctAnswer;
  let isCorrect = false;

  if (correctAnswer) {
    if (typeof correctAnswer === 'object' && correctAnswer.value !== undefined) {
      isCorrect = JSON.stringify(answer) === JSON.stringify(correctAnswer.value);
    } else {
      isCorrect = String(answer).trim() === String(correctAnswer).trim();
    }
  } else {
    isCorrect = true;
  }

  const updatedSession = require('../../store/sessionStore').recordAttempt(
    sessionId, puzzleId, answer, isCorrect
  );

  res.json({
    correct: isCorrect,
    failureCount: updatedSession.playerState.failureCount,
    adaptationLevel: isCorrect ? 0 : Math.min(3, Math.floor(updatedSession.playerState.failureCount / 2)),
    message: isCorrect ? '谜题已解决。前方的路已打开。' : '答案不正确。广播将在稍后重播……',
  });
});

module.exports = router;
