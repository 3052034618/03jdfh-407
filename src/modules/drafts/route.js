const express = require('express');
const router = express.Router();
const {
  createDraft,
  listDrafts,
  getDraft,
  updateDraft,
  deleteDraft,
  batchDeleteDraft,
  updateDraftStatus,
  batchUpdateStatus,
  batchAddTags,
  addTag,
  removeTag,
  rateDraft,
  getDraftStats,
  updateReviewQueue,
  batchUpdateReviewQueue,
  addReviewLog,
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
  const answerType = req.query.answerType
    ? (req.query.answerType.includes(',') ? req.query.answerType.split(',') : req.query.answerType)
    : undefined;
  const status = req.query.status
    ? (req.query.status.includes(',') ? req.query.status.split(',') : req.query.status)
    : undefined;
  const platform = req.query.platform
    ? (req.query.platform.includes(',') ? req.query.platform.split(',') : req.query.platform)
    : undefined;
  const difficultyTier = req.query.difficultyTier
    ? (req.query.difficultyTier.includes(',') ? req.query.difficultyTier.split(',') : req.query.difficultyTier)
    : undefined;

  const filters = {
    chapterId: req.query.chapterId,
    currentMap: req.query.currentMap,
    answerType,
    status,
    platform,
    difficultyTier,
    reviewQueue: req.query.reviewQueue,
    tag: req.query.tag,
    section: req.query.section,
    search: req.query.search,
    sortBy: req.query.sortBy,
    sortDir: req.query.sortDir,
  };

  const drafts = listDrafts(filters);
  const stats = getDraftStats();

  const summary = drafts.map(d => {
    const hasSF = d.spoilerFilter?.applied === true || (d.spoilerFilter?.fullReport && d.spoilerFilter.fullReport.totalReplacements > 0);
    const totalRepl = d.spoilerFilter?.totalReplacements || d.spoilerFilter?.fullReport?.totalReplacements || 0;
    const adj = Array.isArray(d.platformAdjustments) ? d.platformAdjustments : [];
    return {
      draftId: d.draftId,
      chapterId: d.chapterId,
      currentMap: d.currentMap,
      answerType: d.answerType,
      answerDisplay: d.answerDisplay,
      answerLength: d.answerLength,
      difficultyTier: d.difficultyTier,
      status: d.status,
      platform: d.platform,
      tags: d.tags,
      notes: d.notes,
      section: d.section,
      difficulty: d.difficulty,
      adaptation: d.adaptation,
      hasSpoilerFilter: !!(hasSF),
      spoilerReplacements: totalRepl,
      platformAdjustmentsCount: adj.length,
      broadcastPreview: d.broadcast?.text
        ? d.broadcast.text.substring(0, 100) + (d.broadcast.text.length > 100 ? '...' : '')
        : '',
      answer: d.answer,
      qualityRating: d.qualityRating,
      reviewQueue: d.reviewQueue || 'none',
      reviewLogCount: (d.reviewLog || []).length,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  });

  res.json({
    total: summary.length,
    stats,
    filters,
    drafts: summary,
  });
});

router.get('/stats', (req, res) => {
  res.json(getDraftStats());
});

router.patch('/batch/review-queue', (req, res) => {
  const { draftIds, queue } = req.body;
  if (!Array.isArray(draftIds) || !queue) {
    return res.status(400).json({
      error: 'INVALID_REQUEST',
      messages: ['draftIds (array) and queue are required'],
    });
  }
  const count = batchUpdateReviewQueue(draftIds, queue);
  res.json({ success: true, updatedCount: count, queue });
});

router.patch('/batch/status', (req, res) => {
  const { draftIds, status } = req.body;
  if (!Array.isArray(draftIds) || !status) {
    return res.status(400).json({
      error: 'INVALID_REQUEST',
      messages: ['draftIds (array) and status are required'],
    });
  }
  const count = batchUpdateStatus(draftIds, status);
  res.json({
    success: true,
    updatedCount: count,
    status,
  });
});

router.patch('/batch/tags', (req, res) => {
  const { draftIds, tags } = req.body;
  if (!Array.isArray(draftIds) || !Array.isArray(tags)) {
    return res.status(400).json({
      error: 'INVALID_REQUEST',
      messages: ['draftIds (array) and tags (array) are required'],
    });
  }
  const count = batchAddTags(draftIds, tags);
  res.json({
    success: true,
    updatedCount: count,
    tagsAdded: tags,
  });
});

router.delete('/batch', (req, res) => {
  const { draftIds } = req.body;
  if (!Array.isArray(draftIds)) {
    return res.status(400).json({
      error: 'INVALID_REQUEST',
      messages: ['draftIds (array) is required'],
    });
  }
  const count = batchDeleteDraft(draftIds);
  res.json({
    success: true,
    deletedCount: count,
  });
});

router.patch('/:draftId/review-queue', (req, res) => {
  const { queue } = req.body;
  if (!queue) {
    return res.status(400).json({
      error: 'INVALID_REQUEST',
      messages: ['queue is required (none/pending_review/passed/needs_rewrite)'],
    });
  }
  const draft = updateReviewQueue(req.params.draftId, queue);
  if (!draft) {
    return res.status(404).json({
      error: 'DRAFT_NOT_FOUND',
      messages: ['No draft found with the given ID'],
    });
  }
  res.json({ success: true, reviewQueue: draft.reviewQueue });
});

router.post('/:draftId/review-log', (req, res) => {
  const { action, decision, comment, reviewer } = req.body;
  if (!action && !decision && !comment) {
    return res.status(400).json({
      error: 'INVALID_REQUEST',
      messages: ['At least one of action, decision, or comment is required'],
    });
  }
  const draft = addReviewLog(req.params.draftId, { action, decision, comment, reviewer });
  if (!draft) {
    return res.status(404).json({
      error: 'DRAFT_NOT_FOUND',
      messages: ['No draft found with the given ID'],
    });
  }
  res.json({ success: true, reviewLog: draft.reviewLog });
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

router.patch('/:draftId/rate', (req, res) => {
  const { rating } = req.body;
  if (rating == null) {
    return res.status(400).json({
      error: 'INVALID_REQUEST',
      messages: ['rating is required (1-5)'],
    });
  }
  const draft = rateDraft(req.params.draftId, rating);
  if (!draft) {
    return res.status(404).json({
      error: 'DRAFT_NOT_FOUND',
      messages: ['No draft found with the given ID'],
    });
  }
  res.json({ success: true, qualityRating: draft.qualityRating });
});

module.exports = router;
