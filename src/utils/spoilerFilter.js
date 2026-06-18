const SPOILER_REPLACEMENTS = {
  person: ['那个人', '某位访客', '不该被提起的人', '消失的人'],
  place: ['那个地方', '深处的房间', '不能去的地方', '坐标不明'],
  event: ['那件事', '发生过的事', '不可描述的夜晚', '被遗忘的事件'],
  thing: ['那个东西', '不该出现的物品', '它', '不祥之物'],
  generic: ['……', '[已过滤]', '你知道的', '不能说的名字'],
};

function detectSpoilerCategory(term) {
  if (term.includes('医生') || term.includes('护士') || term.includes('师') || term.endsWith('姐') || term.endsWith('哥')) {
    return 'person';
  }
  if (term.includes('室') || term.includes('间') || term.includes('楼') || term.includes('层') || term.includes('房间')) {
    return 'place';
  }
  if (term.includes('事件') || term.includes('那天') || term.includes('年') || term.includes('事故')) {
    return 'event';
  }
  if (term.includes('钥匙') || term.includes('物品') || term.includes('刀') || term.includes('本')) {
    return 'thing';
  }
  return 'generic';
}

function filterSpoilers(text, forbiddenInfo) {
  if (!forbiddenInfo || forbiddenInfo.length === 0) {
    return { filteredText: text, filteredItems: [] };
  }

  let filteredText = text;
  const filteredItems = [];
  const seenReplacements = new Set();

  forbiddenInfo.forEach(term => {
    if (!term || term.trim() === '') return;
    const trimmedTerm = term.trim();

    if (filteredText.includes(trimmedTerm)) {
      const category = detectSpoilerCategory(trimmedTerm);
      const replacementOptions = SPOILER_REPLACEMENTS[category] || SPOILER_REPLACEMENTS.generic;

      let replacement;
      const key = `${category}-${trimmedTerm}`;
      if (seenReplacements.has(key)) {
        const used = [...seenReplacements].find(k => k.startsWith(category + '-'));
        replacement = used ? used.substring(used.indexOf('|') + 1) : null;
      }
      if (!replacement) {
        replacement = replacementOptions[Math.floor(Math.random() * replacementOptions.length)];
        seenReplacements.add(`${category}-${trimmedTerm}|${replacement}`);
      }

      const regex = new RegExp(trimmedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      filteredText = filteredText.replace(regex, replacement);

      filteredItems.push({
        original: trimmedTerm,
        replacement,
        category,
        occurrences: (text.match(new RegExp(trimmedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length,
      });
    }
  });

  return { filteredText, filteredItems };
}

function filterSpoilersInPuzzle(puzzleData, forbiddenInfo) {
  if (!forbiddenInfo || forbiddenInfo.length === 0) {
    return { ...puzzleData, spoilerFilter: { applied: false, filteredItems: [] } };
  }

  const allFiltered = [];

  let broadcastText = puzzleData.broadcast?.text || '';
  const br = filterSpoilers(broadcastText, forbiddenInfo);
  broadcastText = br.filteredText;
  allFiltered.push(...br.filteredItems.map(f => ({ ...f, source: 'broadcast' })));

  const clues = (puzzleData.clues || []).map(clue => {
    const cr = filterSpoilers(clue.text, forbiddenInfo);
    if (cr.filteredItems.length > 0) {
      allFiltered.push(...cr.filteredItems.map(f => ({ ...f, source: `clue:${clue.id || clue.type}` })));
      return { ...clue, text: cr.filteredText };
    }
    return clue;
  });

  let successHookText = puzzleData.successHook?.text || '';
  const shr = filterSpoilers(successHookText, forbiddenInfo);
  successHookText = shr.filteredText;
  allFiltered.push(...shr.filteredItems.map(f => ({ ...f, source: 'successHook' })));

  const wrongFeedback = (puzzleData.wrongFeedback || []).map(fb => {
    const fr = filterSpoilers(fb, forbiddenInfo);
    if (fr.filteredItems.length > 0) {
      allFiltered.push(...fr.filteredItems.map(f => ({ ...f, source: 'wrongFeedback' })));
      return fr.filteredText;
    }
    return fb;
  });

  const uniqueFiltered = [];
  const seen = new Set();
  allFiltered.forEach(item => {
    const key = `${item.original}-${item.replacement}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueFiltered.push(item);
    } else {
      const existing = uniqueFiltered.find(f => `${f.original}-${f.replacement}` === key);
      if (existing) existing.occurrences += item.occurrences;
    }
  });

  return {
    ...puzzleData,
    broadcast: { ...puzzleData.broadcast, text: broadcastText },
    clues,
    wrongFeedback,
    successHook: { ...puzzleData.successHook, text: successHookText },
    spoilerFilter: {
      applied: true,
      filteredItems: uniqueFiltered,
      totalReplacements: uniqueFiltered.reduce((sum, i) => sum + i.occurrences, 0),
    },
  };
}

module.exports = {
  filterSpoilers,
  filterSpoilersInPuzzle,
  SPOILER_REPLACEMENTS,
  detectSpoilerCategory,
};
