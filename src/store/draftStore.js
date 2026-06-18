const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DRAFTS_FILE = path.join(DATA_DIR, 'puzzle_drafts.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readDrafts() {
  ensureDataDir();
  if (!fs.existsSync(DRAFTS_FILE)) {
    return [];
  }
  try {
    const content = fs.readFileSync(DRAFTS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    console.error('Failed to read drafts file:', e.message);
    return [];
  }
}

function writeDrafts(drafts) {
  ensureDataDir();
  fs.writeFileSync(DRAFTS_FILE, JSON.stringify(drafts, null, 2), 'utf-8');
}

function detectDifficultyTier(difficulty = {}) {
  if (difficulty.tier) return difficulty.tier;
  const clues = difficulty.minClueAppearances || difficulty.clueRepetitions || 2;
  const sub = difficulty.maxSubSteps || 3;
  if (clues >= 4 && sub <= 2) return 'easy';
  if (clues >= 3 || sub <= 2) return 'standard';
  if (clues >= 2 && sub <= 4) return 'hard';
  return 'nightmare';
}

function createDraft(puzzleData, meta = {}) {
  const drafts = readDrafts();
  const answerType = puzzleData.answer?.type || meta.answerType || '';
  const answerLength = (puzzleData.answer?.value
    ? String(puzzleData.answer.value).length
    : 0);
  const difficultyTier = meta.difficultyTier || detectDifficultyTier(meta.difficulty || puzzleData.difficulty || {});

  const draft = {
    draftId: uuidv4(),
    chapterId: puzzleData.chapterId || meta.chapterId || '',
    currentMap: puzzleData.currentMap || meta.currentMap || '',
    answerType,
    answerValue: puzzleData.answer?.value || null,
    answerDisplay: puzzleData.answer?.display || null,
    answerLength,
    difficultyTier,
    difficulty: meta.difficulty || puzzleData.difficulty || {},
    platform: meta.platform || puzzleData.platform || 'pc',
    broadcast: puzzleData.broadcast || {},
    clues: puzzleData.clues || [],
    wrongFeedback: puzzleData.wrongFeedback || [],
    successHook: puzzleData.successHook || {},
    answer: puzzleData.answer || null,
    adaptation: meta.adaptation || puzzleData.adaptation || {},
    platformAdjustments: meta.platformAdjustments || puzzleData.platformAdjustments || [],
    spoilerFilter: meta.spoilerFilter || puzzleData.spoilerFilter || { applied: false, filteredItems: [] },
    status: 'draft',
    reviewQueue: 'none',
    reviewLog: [],
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    notes: meta.notes || '',
    section: meta.section || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    forbiddenInfo: Array.isArray(meta.forbiddenInfo) ? meta.forbiddenInfo : [],
    puzzleId: puzzleData.puzzleId || null,
    qualityRating: null,
  };
  drafts.push(draft);
  writeDrafts(drafts);
  return draft;
}

function listDrafts(filters = {}) {
  let drafts = readDrafts();

  if (filters.chapterId) {
    drafts = drafts.filter(d => d.chapterId === filters.chapterId);
  }
  if (filters.currentMap) {
    const map = String(filters.currentMap).toLowerCase();
    drafts = drafts.filter(d =>
      d.currentMap && d.currentMap.toLowerCase().includes(map)
    );
  }
  if (filters.answerType) {
    if (Array.isArray(filters.answerType)) {
      drafts = drafts.filter(d => filters.answerType.includes(d.answerType));
    } else {
      drafts = drafts.filter(d => d.answerType === filters.answerType);
    }
  }
  if (filters.status) {
    if (Array.isArray(filters.status)) {
      drafts = drafts.filter(d => filters.status.includes(d.status));
    } else {
      drafts = drafts.filter(d => d.status === filters.status);
    }
  }
  if (filters.platform) {
    if (Array.isArray(filters.platform)) {
      drafts = drafts.filter(d => filters.platform.includes(d.platform));
    } else {
      drafts = drafts.filter(d => d.platform === filters.platform);
    }
  }
  if (filters.difficultyTier) {
    if (Array.isArray(filters.difficultyTier)) {
      drafts = drafts.filter(d => filters.difficultyTier.includes(d.difficultyTier));
    } else {
      drafts = drafts.filter(d => d.difficultyTier === filters.difficultyTier);
    }
  }
  if (filters.tag) {
    drafts = drafts.filter(d => d.tags.includes(filters.tag));
  }
  if (filters.section) {
    const sec = String(filters.section).toLowerCase();
    drafts = drafts.filter(d =>
      d.section && d.section.toLowerCase().includes(sec)
    );
  }
  if (filters.reviewQueue) {
    if (Array.isArray(filters.reviewQueue)) {
      drafts = drafts.filter(d => filters.reviewQueue.includes(d.reviewQueue || 'none'));
    } else {
      drafts = drafts.filter(d => (d.reviewQueue || 'none') === filters.reviewQueue);
    }
  }
  if (filters.search) {
    const q = String(filters.search).toLowerCase();
    drafts = drafts.filter(d => {
      const hay = [
        d.chapterId, d.currentMap, d.answerType, d.notes, d.section,
        d.broadcast?.text, d.answerDisplay,
        ...(d.tags || []),
        ...(d.clues || []).map(c => c.text),
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  const sortBy = filters.sortBy || 'updatedAt';
  const sortDir = filters.sortDir === 'asc' ? 1 : -1;
  drafts.sort((a, b) => {
    const va = a[sortBy];
    const vb = b[sortBy];
    if (va < vb) return -1 * sortDir;
    if (va > vb) return 1 * sortDir;
    return 0;
  });

  return drafts;
}

function getDraft(draftId) {
  const drafts = readDrafts();
  return drafts.find(d => d.draftId === draftId) || null;
}

function updateDraft(draftId, updates) {
  const drafts = readDrafts();
  const idx = drafts.findIndex(d => d.draftId === draftId);
  if (idx === -1) return null;

  const updated = {
    ...drafts[idx],
    ...updates,
    draftId,
    updatedAt: new Date().toISOString(),
  };
  if (updates.difficulty || updates.difficultyTier) {
    updated.difficultyTier = detectDifficultyTier(updated.difficulty || {});
  }
  drafts[idx] = updated;
  writeDrafts(drafts);
  return drafts[idx];
}

function deleteDraft(draftId) {
  const drafts = readDrafts();
  const filtered = drafts.filter(d => d.draftId !== draftId);
  if (filtered.length === drafts.length) return false;
  writeDrafts(filtered);
  return true;
}

function batchDeleteDraft(draftIds) {
  if (!Array.isArray(draftIds)) return 0;
  const drafts = readDrafts();
  const set = new Set(draftIds);
  const filtered = drafts.filter(d => !set.has(d.draftId));
  const deletedCount = drafts.length - filtered.length;
  if (deletedCount > 0) writeDrafts(filtered);
  return deletedCount;
}

function updateDraftStatus(draftId, status) {
  return updateDraft(draftId, { status });
}

function batchUpdateStatus(draftIds, status) {
  if (!Array.isArray(draftIds)) return 0;
  const drafts = readDrafts();
  const set = new Set(draftIds);
  let count = 0;
  drafts.forEach((d, i) => {
    if (set.has(d.draftId)) {
      drafts[i] = {
        ...d,
        status,
        updatedAt: new Date().toISOString(),
      };
      count += 1;
    }
  });
  if (count > 0) writeDrafts(drafts);
  return count;
}

function batchAddTags(draftIds, tags) {
  if (!Array.isArray(draftIds) || !Array.isArray(tags)) return 0;
  const drafts = readDrafts();
  const set = new Set(draftIds);
  let count = 0;
  drafts.forEach((d, i) => {
    if (set.has(d.draftId)) {
      const merged = [...new Set([...(d.tags || []), ...tags])];
      drafts[i] = {
        ...d,
        tags: merged,
        updatedAt: new Date().toISOString(),
      };
      count += 1;
    }
  });
  if (count > 0) writeDrafts(drafts);
  return count;
}

function addTag(draftId, tag) {
  const draft = getDraft(draftId);
  if (!draft) return null;
  const tags = [...new Set([...(draft.tags || []), tag])];
  return updateDraft(draftId, { tags });
}

function removeTag(draftId, tag) {
  const draft = getDraft(draftId);
  if (!draft) return null;
  const tags = (draft.tags || []).filter(t => t !== tag);
  return updateDraft(draftId, { tags });
}

function rateDraft(draftId, rating) {
  const r = parseInt(rating);
  if (isNaN(r) || r < 1 || r > 5) return null;
  return updateDraft(draftId, { qualityRating: r });
}

function updateReviewQueue(draftId, queue) {
  const valid = ['none', 'pending_review', 'passed', 'needs_rewrite'];
  if (!valid.includes(queue)) return null;
  return updateDraft(draftId, { reviewQueue: queue });
}

function batchUpdateReviewQueue(draftIds, queue) {
  const valid = ['none', 'pending_review', 'passed', 'needs_rewrite'];
  if (!Array.isArray(draftIds) || !valid.includes(queue)) return 0;
  const drafts = readDrafts();
  const set = new Set(draftIds);
  let count = 0;
  drafts.forEach((d, i) => {
    if (set.has(d.draftId)) {
      drafts[i] = { ...d, reviewQueue: queue, updatedAt: new Date().toISOString() };
      count += 1;
    }
  });
  if (count > 0) writeDrafts(drafts);
  return count;
}

function addReviewLog(draftId, entry) {
  const drafts = readDrafts();
  const idx = drafts.findIndex(d => d.draftId === draftId);
  if (idx === -1) return null;
  if (!Array.isArray(drafts[idx].reviewLog)) drafts[idx].reviewLog = [];
  drafts[idx].reviewLog.push({
    action: entry.action || 'review',
    decision: entry.decision || '',
    comment: entry.comment || '',
    reviewer: entry.reviewer || 'anonymous',
    timestamp: new Date().toISOString(),
  });
  drafts[idx].updatedAt = new Date().toISOString();
  writeDrafts(drafts);
  return drafts[idx];
}

function getDraftStats() {
  const drafts = readDrafts();
  const stats = {
    total: drafts.length,
    byStatus: { draft: 0, adopted: 0, archived: 0 },
    byAnswerType: {},
    byChapter: {},
    byDifficultyTier: { easy: 0, standard: 0, hard: 0, nightmare: 0 },
    byPlatform: { pc: 0, console: 0, mobile: 0 },
    byMap: {},
    byReviewQueue: { none: 0, pending_review: 0, passed: 0, needs_rewrite: 0 },
    averageRating: 0,
    ratedCount: 0,
  };
  let totalRating = 0;
  drafts.forEach(d => {
    stats.byStatus[d.status] = (stats.byStatus[d.status] || 0) + 1;
    stats.byAnswerType[d.answerType] = (stats.byAnswerType[d.answerType] || 0) + 1;
    stats.byChapter[d.chapterId] = (stats.byChapter[d.chapterId] || 0) + 1;
    stats.byDifficultyTier[d.difficultyTier] = (stats.byDifficultyTier[d.difficultyTier] || 0) + 1;
    stats.byPlatform[d.platform] = (stats.byPlatform[d.platform] || 0) + 1;
    stats.byMap[d.currentMap] = (stats.byMap[d.currentMap] || 0) + 1;
    const rq = d.reviewQueue || 'none';
    stats.byReviewQueue[rq] = (stats.byReviewQueue[rq] || 0) + 1;
    if (d.qualityRating != null) {
      totalRating += d.qualityRating;
      stats.ratedCount += 1;
    }
  });
  stats.averageRating = stats.ratedCount ? +(totalRating / stats.ratedCount).toFixed(2) : 0;
  return stats;
}

module.exports = {
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
};
