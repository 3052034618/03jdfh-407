const express = require('express');
const router = express.Router();
const {
  createDraft,
  listDrafts,
  getDraft,
  updateDraft,
  deleteDraft,
  updateDraftStatus,
  addTag,
  removeTag,
  getDraftStats,
} = require('../../store/draftStore');

router.post('/', (req, res) => {
  const { puzzleData, meta } = req.body;
  if (!puzzleData) {
    return res.status(400).json({
      error: 'INVALID_REQUEST',
      messages: ['puzzleData is required'],
    });
  }
  const draft = createDraft(puzzleData, meta || {});
  res.status(201).json(draft);
});

router.get('/', (req, res) => {
  const filters = {
    chapterId: req.query.chapterId,
    currentMap: req.query.currentMap,
    answerType: req.query.answerType,
    status: req.query.status,
    platform: req.query.platform,
    tag: req.query.tag,
  };

  const drafts = listDrafts(filters);
  const stats = getDraftStats();

  const summary = drafts.map(d => ({
    draftId: d.draftId,
    chapterId: d.chapterId,
    currentMap: d.currentMap,
    answerType: d.answerType,
    status: d.status,
    platform: d.platform,
    tags: d.tags,
    notes: d.notes,
    difficulty: d.difficulty,
    adaptation: d.adaptation,
    broadcastPreview: d.broadcast?.text
      ? d.broadcast.text.substring(0, 100) + (d.broadcast.text.length > 100 ? '...' : '')
      : '',
    answer: d.answer,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));

  res.json({
    total: summary.length,
    stats,
    drafts: summary,
  });
});

router.get('/stats', (req, res) => {
  res.json(getDraftStats());
});

router.get('/:draftId', (req, res) => {
  const draft = getDraft(req.params.draftId);
  if (!draft) {
    return res.status(404).json({
      error: 'DRAFT_NOT_FOUND',
      messages: ['No draft found with the given ID'],
    });
  }
  res.json(draft);
});

router.put('/:draftId', (req, res) => {
  const draft = updateDraft(req.params.draftId, req.body);
  if (!draft) {
    return res.status(404).json({
      error: 'DRAFT_NOT_FOUND',
      messages: ['No draft found with the given ID'],
    });
  }
  res.json(draft);
});

router.delete('/:draftId', (req, res) => {
  const deleted = deleteDraft(req.params.draftId);
  if (!deleted) {
    return res.status(404).json({
      error: 'DRAFT_NOT_FOUND',
      messages: ['No draft found with the given ID'],
    });
  }
  res.json({ success: true, message: 'Draft deleted' });
});

router.patch('/:draftId/status', (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({
      error: 'INVALID_REQUEST',
      messages: ['status is required'],
    });
  }
  const draft = updateDraftStatus(req.params.draftId, status);
  if (!draft) {
    return res.status(404).json({
      error: 'DRAFT_NOT_FOUND',
      messages: ['No draft found with the given ID'],
    });
  }
  res.json({ success: true, draft });
});

router.post('/:draftId/tags', (req, res) => {
  const { tag } = req.body;
  if (!tag) {
    return res.status(400).json({
      error: 'INVALID_REQUEST',
      messages: ['tag is required'],
    });
  }
  const draft = addTag(req.params.draftId, tag);
  if (!draft) {
    return res.status(404).json({
      error: 'DRAFT_NOT_FOUND',
      messages: ['No draft found with the given ID'],
    });
  }
  res.json({ success: true, tags: draft.tags });
});

router.delete('/:draftId/tags/:tag', (req, res) => {
  const draft = removeTag(req.params.draftId, req.params.tag);
  if (!draft) {
    return res.status(404).json({
      error: 'DRAFT_NOT_FOUND',
      messages: ['No draft found with the given ID'],
    });
  }
  res.json({ success: true, tags: draft.tags });
});

module.exports = router;
