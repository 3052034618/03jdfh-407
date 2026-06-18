const SPOILER_REPLACEMENTS = {
  person: ['那个人', '某位访客', '不该被提起的人', '消失的人', '你知道是谁', '那一位'],
  place: ['那个地方', '深处的房间', '不能去的地方', '坐标不明', '那里', '深处'],
  event: ['那件事', '发生过的事', '不可描述的夜晚', '被遗忘的事件', '那一天'],
  thing: ['那个东西', '不该出现的物品', '它', '不祥之物', '那个物件'],
  generic: ['……', '[已过滤]', '你知道的', '不能说的名字', '那个'],
};

const SYNONYM_RULES = [
  { pattern: /(.+?)的真实身份/, extract: m => [m[1], m[1] + '的真实身份', m[1] + '是谁'] },
  { pattern: /(.+?)的秘密/, extract: m => [m[1], m[1] + '的秘密'] },
  { pattern: /(.+?)的真相/, extract: m => [m[1], m[1] + '的真相'] },
  { pattern: /最终(.+?)/, extract: m => ['最终' + m[1], '真' + m[1], '隐藏的' + m[1]] },
  { pattern: /(.+?)事件/, extract: m => [m[1] + '事件', '那次' + m[1], '那个' + m[1]] },
];

const DEFAULT_SYNONYMS = {
  person_roles: ['医生', '护士', '院长', '老师', '校长', '看守', '管理员', '保安', '管家', '女仆'],
  place_suffix: ['室', '间', '楼', '层', '房间', '大厅', '走廊', '地下室', '地窖', '井', '仓库'],
  event_words: ['事故', '火灾', '地震', '失踪', '惨案', '悲剧', '仪式', '实验', '手术', '审判'],
  thing_words: ['钥匙', '刀', '日记', '笔记', '信', '照片', '录音', '录像', '文件', '档案'],
};

function detectSpoilerCategory(term) {
  const t = term.toLowerCase();
  for (const role of DEFAULT_SYNONYMS.person_roles) {
    if (t.includes(role)) return 'person';
  }
  if (/的真实身份|是谁|真名叫|真名/.test(t)) return 'person';
  for (const suffix of DEFAULT_SYNONYMS.place_suffix) {
    if (t.includes(suffix)) return 'place';
  }
  for (const w of DEFAULT_SYNONYMS.event_words) {
    if (t.includes(w)) return 'event';
  }
  if (/那天|那年|当晚|当时|次日|之后|之前/.test(t)) return 'event';
  for (const w of DEFAULT_SYNONYMS.thing_words) {
    if (t.includes(w)) return 'thing';
  }
  if (term.length <= 3) return 'person';
  return 'generic';
}

function buildSynonyms(term) {
  const synonyms = new Set([term.trim()]);
  const trimmed = term.trim();

  for (const rule of SYNONYM_RULES) {
    const m = trimmed.match(rule.pattern);
    if (m) {
      rule.extract(m).forEach(s => synonyms.add(s));
    }
  }

  if (/的真实身份|的秘密|的真相/.test(trimmed)) {
    const core = trimmed.replace(/的真实身份|的秘密|的真相/, '');
    synonyms.add(core);
    synonyms.add(core + '是谁');
    synonyms.add('真' + core);
  }

  if (trimmed.length >= 2 && /^[\u4e00-\u9fa5]+$/.test(trimmed)) {
    if (trimmed.length === 2) {
      synonyms.add(trimmed.charAt(0) + '先生');
      synonyms.add(trimmed.charAt(0) + '医生');
      synonyms.add(trimmed.charAt(0) + '老师');
      synonyms.add(trimmed + '医生');
      synonyms.add(trimmed + '老师');
    }
    if (trimmed.length === 3) {
      synonyms.add(trimmed.charAt(0) + trimmed.charAt(1));
      synonyms.add(trimmed.charAt(0) + trimmed.charAt(2));
    }
    synonyms.add(trimmed.charAt(0) + '某');
    synonyms.add('那个' + trimmed.charAt(0));
  }

  if (/医院|学校|宿舍|疯人院|监狱|车站|码头|工厂/.test(trimmed)) {
    synonyms.add('那个' + trimmed.replace(/医院|学校|宿舍|疯人院|监狱|车站|码头|工厂/, ''));
  }

  return Array.from(synonyms).filter(s => s.length >= 2);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function filterSpoilers(text, forbiddenInfo, opts = {}) {
  if (!forbiddenInfo || forbiddenInfo.length === 0) {
    return {
      filteredText: text,
      filteredItems: [],
      report: {
        hit: [],
        missed: forbiddenInfo || [],
        totalScanned: 0,
        sources: opts.source ? [opts.source] : [],
      },
    };
  }

  let filteredText = text;
  const termAssignments = new Map();
  const hitTerms = new Map();
  const allSynonyms = new Map();

  forbiddenInfo.forEach(rawTerm => {
    if (!rawTerm || typeof rawTerm !== 'string' || !rawTerm.trim()) return;
    const originalTerm = rawTerm.trim();
    const category = detectSpoilerCategory(originalTerm);
    const synonyms = buildSynonyms(originalTerm);

    synonyms.forEach(syn => {
      if (!allSynonyms.has(syn)) {
        allSynonyms.set(syn, []);
      }
      allSynonyms.get(syn).push({ originalTerm, category });
    });
  });

  const sortedSynonyms = Array.from(allSynonyms.keys()).sort((a, b) => b.length - a.length);
  const scannedText = text;
  const regexMatches = [];

  sortedSynonyms.forEach(syn => {
    const regex = new RegExp(escapeRegex(syn), 'g');
    let m;
    while ((m = regex.exec(scannedText)) !== null) {
      const overlap = regexMatches.some(existing =>
        m.index < existing.end && m.index + syn.length > existing.start
      );
      if (!overlap) {
        regexMatches.push({
          start: m.index,
          end: m.index + syn.length,
          synonym: syn,
          matchedInfo: allSynonyms.get(syn),
        });
      }
    }
  });

  regexMatches.sort((a, b) => a.start - b.start);

  let offset = 0;
  const matchedOriginals = new Map();

  regexMatches.forEach(match => {
    const originalEntry = match.matchedInfo[0];
    const originalTerm = originalEntry.originalTerm;
    const category = originalEntry.category;

    if (!termAssignments.has(originalTerm)) {
      const replacementOptions = SPOILER_REPLACEMENTS[category] || SPOILER_REPLACEMENTS.generic;
      const chosen = replacementOptions[Math.floor(Math.random() * replacementOptions.length)];
      termAssignments.set(originalTerm, chosen);
    }

    const replacement = termAssignments.get(originalTerm);
    filteredText = filteredText.substring(0, match.start + offset)
      + replacement
      + filteredText.substring(match.end + offset);
    offset += replacement.length - (match.end - match.start);

    const key = `${originalTerm}|${replacement}`;
    if (!matchedOriginals.has(key)) {
      matchedOriginals.set(key, {
        original: originalTerm,
        replacement,
        category,
        occurrences: 0,
        matchedSynonyms: new Set(),
        source: opts.source || 'unknown',
      });
    }
    const entry = matchedOriginals.get(key);
    entry.occurrences += 1;
    entry.matchedSynonyms.add(match.synonym);
  });

  const filteredItems = Array.from(matchedOriginals.values()).map(e => ({
    ...e,
    matchedSynonyms: Array.from(e.matchedSynonyms),
  }));

  const hitOriginals = new Set(filteredItems.map(f => f.original));
  const missedTerms = forbiddenInfo.filter(t => t && t.trim() && !hitOriginals.has(t.trim()));

  return {
    filteredText,
    filteredItems,
    report: {
      hit: filteredItems.map(f => ({
        original: f.original,
        replacement: f.replacement,
        category: f.category,
        occurrences: f.occurrences,
        matchedSynonyms: f.matchedSynonyms,
      })),
      missed: missedTerms,
      totalScanned: regexMatches.length,
      sources: opts.source ? [opts.source] : [],
    },
  };
}

function filterSpoilersInPuzzle(puzzleData, forbiddenInfo) {
  if (!forbiddenInfo || forbiddenInfo.length === 0) {
    return {
      ...puzzleData,
      spoilerFilter: {
        applied: false,
        filteredItems: [],
        fullReport: {
          totalForbidden: 0,
          totalHit: 0,
          totalMissed: 0,
          totalReplacements: 0,
          bySource: {},
          hit: [],
          missed: [],
        },
      },
    };
  }

  const bySource = {};
  let totalReplaced = 0;
  const allHitMap = new Map();

  let broadcastText = puzzleData.broadcast?.text || '';
  const br = filterSpoilers(broadcastText, forbiddenInfo, { source: '广播文本' });
  broadcastText = br.filteredText;
  totalReplaced += br.filteredItems.reduce((s, i) => s + i.occurrences, 0);
  bySource['广播文本'] = br.report;
  br.filteredItems.forEach(fi => {
    const key = fi.original + '|' + fi.replacement;
    if (!allHitMap.has(key)) allHitMap.set(key, { ...fi, matchedSynonyms: [...fi.matchedSynonyms], sources: new Set() });
    const entry = allHitMap.get(key);
    entry.occurrences += 0;
    fi.matchedSynonyms.forEach(s => entry.matchedSynonyms.push(s));
    entry.sources.add('广播文本');
  });

  const clues = (puzzleData.clues || []).map((clue, idx) => {
    const cr = filterSpoilers(clue.text, forbiddenInfo, { source: `线索#${idx + 1}[${clue.type}]` });
    if (cr.filteredItems.length > 0) {
      totalReplaced += cr.filteredItems.reduce((s, i) => s + i.occurrences, 0);
      bySource[`线索#${idx + 1}[${clue.type}]`] = cr.report;
      cr.filteredItems.forEach(fi => {
        const key = fi.original + '|' + fi.replacement;
        if (!allHitMap.has(key)) allHitMap.set(key, { ...fi, matchedSynonyms: [...fi.matchedSynonyms], sources: new Set() });
        const entry = allHitMap.get(key);
        fi.matchedSynonyms.forEach(s => entry.matchedSynonyms.push(s));
        entry.sources.add(`线索#${idx + 1}[${clue.type}]`);
      });
    }
    return { ...clue, text: cr.filteredText };
  });

  let successHookText = puzzleData.successHook?.text || '';
  const shr = filterSpoilers(successHookText, forbiddenInfo, { source: '成功钩子' });
  successHookText = shr.filteredText;
  totalReplaced += shr.filteredItems.reduce((s, i) => s + i.occurrences, 0);
  bySource['成功钩子'] = shr.report;
  shr.filteredItems.forEach(fi => {
    const key = fi.original + '|' + fi.replacement;
    if (!allHitMap.has(key)) allHitMap.set(key, { ...fi, matchedSynonyms: [...fi.matchedSynonyms], sources: new Set() });
    const entry = allHitMap.get(key);
    fi.matchedSynonyms.forEach(s => entry.matchedSynonyms.push(s));
    entry.sources.add('成功钩子');
  });

  const wrongFeedback = (puzzleData.wrongFeedback || []).map((fb, idx) => {
    const fr = filterSpoilers(fb, forbiddenInfo, { source: `错误反馈#${idx + 1}` });
    if (fr.filteredItems.length > 0) {
      totalReplaced += fr.filteredItems.reduce((s, i) => s + i.occurrences, 0);
      bySource[`错误反馈#${idx + 1}`] = fr.report;
      fr.filteredItems.forEach(fi => {
        const key = fi.original + '|' + fi.replacement;
        if (!allHitMap.has(key)) allHitMap.set(key, { ...fi, matchedSynonyms: [...fi.matchedSynonyms], sources: new Set() });
        const entry = allHitMap.get(key);
        fi.matchedSynonyms.forEach(s => entry.matchedSynonyms.push(s));
        entry.sources.add(`错误反馈#${idx + 1}`);
      });
    }
    return fr.filteredText;
  });

  let answerDisplay = puzzleData.answer?.display || '';
  let answerValue = puzzleData.answer?.value;
  const ar = filterSpoilers(typeof answerDisplay === 'string' ? answerDisplay : '', forbiddenInfo, { source: '谜底展示' });
  if (ar.filteredItems.length > 0) {
    answerDisplay = ar.filteredText;
    totalReplaced += ar.filteredItems.reduce((s, i) => s + i.occurrences, 0);
    bySource['谜底展示'] = ar.report;
    ar.filteredItems.forEach(fi => {
      const key = fi.original + '|' + fi.replacement;
      if (!allHitMap.has(key)) allHitMap.set(key, { ...fi, matchedSynonyms: [...fi.matchedSynonyms], sources: new Set() });
      const entry = allHitMap.get(key);
      fi.matchedSynonyms.forEach(s => entry.matchedSynonyms.push(s));
      entry.sources.add('谜底展示');
    });
  }

  const hitOriginals = new Set(Array.from(allHitMap.values()).map(e => e.original));
  const missed = forbiddenInfo.filter(t => t && t.trim() && !hitOriginals.has(t.trim()));

  const allHit = Array.from(allHitMap.values()).map(e => ({
    original: e.original,
    replacement: e.replacement,
    category: e.category,
    occurrences: e.occurrences,
    matchedSynonyms: Array.from(new Set(e.matchedSynonyms)),
    sources: Array.from(e.sources),
  }));

  const answerOut = puzzleData.answer
    ? { ...puzzleData.answer, display: answerDisplay }
    : puzzleData.answer;

  return {
    ...puzzleData,
    answer: answerOut,
    broadcast: { ...puzzleData.broadcast, text: broadcastText },
    clues,
    wrongFeedback,
    successHook: { ...puzzleData.successHook, text: successHookText },
    spoilerFilter: {
      applied: true,
      filteredItems: allHit,
      totalReplacements: totalReplaced,
      fullReport: {
        totalForbidden: forbiddenInfo.length,
        totalHit: allHit.length,
        totalMissed: missed.length,
        totalReplacements: totalReplaced,
        bySource,
        hit: allHit.map(h => ({
          original: h.original,
          replacement: h.replacement,
          category: h.category,
          matchedSynonyms: h.matchedSynonyms,
          occurrences: h.occurrences,
          sources: h.sources,
        })),
        missed,
      },
    },
  };
}

module.exports = {
  filterSpoilers,
  filterSpoilersInPuzzle,
  SPOILER_REPLACEMENTS,
  detectSpoilerCategory,
  buildSynonyms,
};
