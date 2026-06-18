const express = require('express');
const path = require('path');
const puzzleRoute = require('./modules/puzzle/route');
const difficultyRoute = require('./modules/difficulty/route');
const adaptationRoute = require('./modules/adaptation/route');
const { createSession, getSession, resetSession, listSessions } = require('./store/sessionStore');

const app = express();
const PORT = process.env.PORT || 3077;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/puzzle', puzzleRoute);
app.use('/api/difficulty', difficultyRoute);
app.use('/api/adaptation', adaptationRoute);

app.post('/api/session', (req, res) => {
  const { chapterId } = req.body;
  if (!chapterId) {
    return res.status(400).json({
      error: 'INVALID_REQUEST',
      messages: ['chapterId is required'],
    });
  }
  const session = createSession(chapterId);
  res.json({
    sessionId: session.sessionId,
    chapterId: session.chapterId,
    createdAt: session.createdAt,
  });
});

app.get('/api/session/:sessionId', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) {
    return res.status(404).json({
      error: 'SESSION_NOT_FOUND',
      messages: ['No session found with the given sessionId'],
    });
  }
  res.json({
    sessionId: session.sessionId,
    chapterId: session.chapterId,
    playerState: session.playerState,
    puzzles: session.puzzles.map(p => ({
      puzzleId: p.puzzleId,
      answerType: p.answerType,
      attempts: p.attempts.length,
      solved: p.solved,
      createdAt: p.createdAt,
    })),
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  });
});

app.post('/api/session/:sessionId/reset', (req, res) => {
  const session = resetSession(req.params.sessionId);
  if (!session) {
    return res.status(404).json({
      error: 'SESSION_NOT_FOUND',
      messages: ['No session found with the given sessionId'],
    });
  }
  res.json({
    sessionId: session.sessionId,
    message: 'Session reset. Player state cleared.',
    playerState: session.playerState,
  });
});

app.get('/api/sessions', (req, res) => {
  res.json({ sessions: listSessions() });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'underworld-radio-puzzle',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`[Underworld Radio Puzzle Service] Running on http://localhost:${PORT}`);
  console.log(`  API:    http://localhost:${PORT}/api`);
  console.log(`  Debug:  http://localhost:${PORT}/debug.html`);
});
