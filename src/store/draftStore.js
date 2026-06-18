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

function createDraft(puzzleData, meta = {}) {
  const drafts = readDrafts();
  const draft = {
    draftId: uuidv4(),
    chapterId: puzzleData.chapterId || meta.chapterId || '',
    currentMap: meta.currentMap || '',
    answerType: puzzleData.answer?.type || meta.answerType || '',
    difficulty: meta.difficulty || {},
    platform: meta.platform || 'pc',
    broadcast: puzzleData.broadcast || {},
    clues: puzzleData.clues || [],
    wrongFeedback: puzzleData.wrongFeedback || [],
    successHook: puzzleData.successHook || {},
    answer: puzzleData.answer || null,
    adaptation: meta.adaptation || {},
    status: 'draft',
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    notes: meta.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    forbiddenInfo: Array.isArray(meta.forbiddenInfo) ? meta.forbiddenInfo : [],
    filteredSpoliers: Array.isArray(meta.filteredSpoliers) ? meta.filteredSpoliers : [],
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
    drafts = drafts.filter(d =>
      d.currentMap.toLowerCase().includes(filters.currentMap.toLowerCase())
    );
  }
  if (filters.answerType) {
    drafts = drafts.filter(d => d.answerType === filters.answerType);
  }
  if (filters.status) {
    drafts = drafts.filter(d => d.status === filters.status);
  }
  if (filters.platform) {
    drafts = drafts.filter(d => d.platform === filters.platform);
  }
  if (filters.tag) {
    drafts = drafts.filter(d => d.tags.includes(filters.tag));
  }

  drafts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

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

  drafts[idx] = {
    ...drafts[idx],
    ...updates,
    draftId,
    updatedAt: new Date().toISOString(),
  };
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

function updateDraftStatus(draftId, status) {
  return updateDraft(draftId, { status });
}

function addTag(draftId, tag) {
  const draft = getDraft(draftId);
  if (!draft) return null;
  const tags = [...new Set([...draft.tags, tag])];
  return updateDraft(draftId, { tags });
}

function removeTag(draftId, tag) {
  const draft = getDraft(draftId);
  if (!draft) return null;
  const tags = draft.tags.filter(t => t !== tag);
  return updateDraft(draftId, { tags });
}

function getDraftStats() {
  const drafts = readDrafts();
  const stats = {
    total: drafts.length,
    byStatus: {},
    byAnswerType: {},
    byChapter: {},
  };
  drafts.forEach(d => {
    stats.byStatus[d.status] = (stats.byStatus[d.status] || 0) + 1;
    stats.byAnswerType[d.answerType] = (stats.byAnswerType[d.answerType] || 0) + 1;
    stats.byChapter[d.chapterId] = (stats.byChapter[d.chapterId] || 0) + 1;
  });
  return stats;
}

module.exports = {
  createDraft,
  listDrafts,
  getDraft,
  updateDraft,
  deleteDraft,
  updateDraftStatus,
  addTag,
  removeTag,
  getDraftStats,
};
