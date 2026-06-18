const { v4: uuidv4 } = require('uuid');
const { BROADCAST_TEMPLATES } = require('../../templates/broadcasts');
const { CLUE_TEMPLATES, formatClue } = require('../../templates/clues');
const { NARRATIVE_HOOKS, formatHook } = require('../../templates/hooks');
const { WRONG_FEEDBACK_TEMPLATES } = require('../../templates/wrongFeedback');
const { REPLAY_ADAPTATIONS, getAdaptationLevel } = require('../../templates/adaptations');
const { FREQUENCY_RANGES, DATE_CONTEXTS, DIRECTION_VALUES } = require('../../models/schemas');

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateAnswer(answerType, constraints) {
  switch (answerType) {
    case 'frequency': {
      const range = randomPick(FREQUENCY_RANGES);
      const value = Math.round((range.min + Math.random() * (range.max - range.min)) * 10) / 10;
      return { type: 'frequency', value, display: `${value.toFixed(1)}兆赫` };
    }
    case 'date': {
      const ctx = randomPick(DATE_CONTEXTS);
      const year = ctx.yearRange[0] + Math.floor(Math.random() * (ctx.yearRange[1] - ctx.yearRange[0] + 1));
      const month = 1 + Math.floor(Math.random() * 12);
      const maxDay = new Date(year, month, 0).getDate();
      const day = 1 + Math.floor(Math.random() * maxDay);
      return { type: 'date', value: { year, month, day, era: ctx.era }, display: `${ctx.era}${year}年${month}月${day}日` };
    }
    case 'name': {
      const surnames = ['林', '陈', '张', '王', '李', '赵', '周', '吴', '郑', '孙', '钱', '宋'];
      const givenNames = ['素珍', '志远', '雨桐', '承恩', '婉清', '鹤年', '映月', '守正', '秋白', '若兰', '明德', '静宜'];
      const name = randomPick(surnames) + randomPick(givenNames);
      return { type: 'name', value: name, display: name };
    }
    case 'direction': {
      const dir = randomPick(DIRECTION_VALUES);
      return { type: 'direction', value: dir, display: dir };
    }
    case 'code': {
      const length = constraints?.maxSubSteps ?? 4;
      const digits = [];
      for (let i = 0; i < length; i++) {
        digits.push(String(Math.floor(Math.random() * 10)));
      }
      const code = digits.join('');
      return { type: 'code', value: code, display: code };
    }
    default:
      return null;
  }
}

function buildClueParams(answer, currentMap) {
  const params = { currentMap };
  switch (answer.type) {
    case 'frequency':
      params.value = answer.value.toFixed(1);
      params.intPart = String(Math.floor(answer.value));
      params.decPart = String(Math.round((answer.value - Math.floor(answer.value)) * 10));
      break;
    case 'date':
      params.value = answer.display;
      params.year = answer.value.year;
      params.month = answer.value.month;
      params.day = answer.value.day;
      params.era = answer.value.era;
      break;
    case 'name':
      params.value = answer.value;
      params.surname = answer.value.charAt(0);
      break;
    case 'direction':
      params.value = answer.value;
      break;
    case 'code':
      params.value = answer.value;
      params.length = String(answer.value.length);
      break;
  }
  return params;
}

function generateClues(answer, currentMap, difficulty, adaptationLevel) {
  const templates = CLUE_TEMPLATES[answer.type];
  if (!templates) return [];

  const params = buildClueParams(answer, currentMap);
  const minAppear = difficulty.minClueAppearances || 2;
  const extraClues = adaptationLevel.extraClues || 0;
  const totalNeeded = minAppear + extraClues;

  const clueCategories = ['direct', 'indirect', 'environmental'];
  const clues = [];
  const usedIndices = { direct: new Set(), indirect: new Set(), environmental: new Set() };

  const directCount = adaptationLevel.revealDirectClue
    ? Math.min(totalNeeded, templates.direct.length)
    : Math.min(Math.max(1, Math.ceil(totalNeeded * 0.3)), templates.direct.length);

  for (let i = 0; i < directCount && i < templates.direct.length; i++) {
    let idx;
    do { idx = Math.floor(Math.random() * templates.direct.length); } while (usedIndices.direct.has(idx));
    usedIndices.direct.add(idx);
    clues.push({
      id: `clue_${clues.length}`,
      text: formatClue(templates.direct[idx], params),
      type: 'direct',
      order: clues.length,
    });
  }

  const indirectCount = Math.min(
    Math.max(1, Math.ceil(totalNeeded * 0.4)),
    templates.indirect.length
  );
  for (let i = 0; i < indirectCount && i < templates.indirect.length; i++) {
    let idx;
    do { idx = Math.floor(Math.random() * templates.indirect.length); } while (usedIndices.indirect.has(idx));
    usedIndices.indirect.add(idx);
    clues.push({
      id: `clue_${clues.length}`,
      text: formatClue(templates.indirect[idx], params),
      type: 'indirect',
      order: clues.length,
    });
  }

  const envCount = Math.min(
    Math.max(1, totalNeeded - directCount - indirectCount + extraClues),
    templates.environmental.length
  );
  for (let i = 0; i < envCount && i < templates.environmental.length; i++) {
    let idx;
    do { idx = Math.floor(Math.random() * templates.environmental.length); } while (usedIndices.environmental.has(idx));
    usedIndices.environmental.add(idx);
    clues.push({
      id: `clue_${clues.length}`,
      text: formatClue(templates.environmental[idx], params),
      type: 'environmental',
      order: clues.length,
    });
  }

  for (let i = 0; i < clues.length; i++) {
    clues[i].appearances = Math.max(1, minAppear);
    if (clues[i].type === 'direct' && adaptationLevel.revealDirectClue) {
      clues[i].appearances = minAppear + 1;
    }
  }

  return clues;
}

function generateWrongFeedback(answerType, count) {
  const templates = WRONG_FEEDBACK_TEMPLATES[answerType] || [];
  if (templates.length === 0) return ['答案不正确。再试一次。'];

  const feedback = [];
  const used = new Set();
  for (let i = 0; i < Math.min(count || 4, templates.length); i++) {
    let idx;
    do { idx = Math.floor(Math.random() * templates.length); } while (used.has(idx) && used.size < templates.length);
    used.add(idx);
    feedback.push(templates[idx].replace(/\{attempt\}/g, '___'));
  }
  return feedback;
}

function generateBroadcast(answer, currentMap, difficulty, adaptation) {
  const typeTemplates = BROADCAST_TEMPLATES[answer.type];
  if (!typeTemplates || typeTemplates.length === 0) {
    return { text: '……滋……（无法解析的广播信号）……滋……', templateId: 'unknown' };
  }

  const template = randomPick(typeTemplates);
  const ctx = { currentMap, mapHint: !!currentMap };
  let text = template.generate(answer, ctx);

  if (adaptation && adaptation.broadcastSuffix) {
    text += adaptation.broadcastSuffix;
  }

  if (difficulty && !difficulty.allowReversePlayback) {
    text += '\n\n[此广播不可倒放，仅支持单向播放]';
  }

  if (difficulty && difficulty.requiresPenAndPaper) {
    text += '\n\n[提示：此广播内容较长，建议准备好纸笔记录关键信息]';
  }

  if (adaptation && adaptation.level >= 2) {
    const params = buildClueParams(answer, currentMap);
    const directTemplates = CLUE_TEMPLATES[answer.type]?.direct || [];
    if (directTemplates.length > 0) {
      const emphasized = formatClue(directTemplates[0], params);
      text += `\n\n……重点重复……${emphasized}……`;
    }
  }

  return { text, templateId: template.id, templateLabel: template.label };
}

function generateSuccessHook(answer) {
  const hooks = NARRATIVE_HOOKS[answer.type] || [];
  if (hooks.length === 0) return { text: '谜题已解决。前方的路已打开。' };

  const template = randomPick(hooks);
  const params = buildClueParams(answer, '');
  return { text: formatHook(template, params) };
}

function generatePuzzle(request, difficulty, playerState) {
  const answer = generateAnswer(request.answerType, difficulty);
  const adaptation = getAdaptationLevel(playerState.failureCount);
  const broadcast = generateBroadcast(answer, request.currentMap, difficulty, adaptation);
  const clues = generateClues(answer, request.currentMap, difficulty, adaptation);
  const wrongFeedback = generateWrongFeedback(request.answerType, 4);
  const successHook = generateSuccessHook(answer);

  const puzzleId = uuidv4();

  return {
    puzzleId,
    chapterId: request.chapterId,
    createdAt: new Date().toISOString(),
    answer: {
      type: answer.type,
      display: answer.display,
      value: answer.value,
    },
    broadcast,
    clues,
    wrongFeedback,
    successHook,
    difficulty: {
      level: adaptation.level,
      label: adaptation.label,
      description: adaptation.description,
      minClueAppearances: difficulty.minClueAppearances,
      allowReversePlayback: difficulty.allowReversePlayback,
      requiresPenAndPaper: difficulty.requiresPenAndPaper,
    },
    adaptation: {
      failureCount: playerState.failureCount,
      adaptationLevel: adaptation.level,
      adaptationLabel: adaptation.label,
    },
    forbiddenInfoFiltered: request.forbiddenInfo.length > 0,
  };
}

module.exports = {
  generatePuzzle,
  generateAnswer,
  generateBroadcast,
  generateClues,
  generateWrongFeedback,
  generateSuccessHook,
  getAdaptationLevel,
};
