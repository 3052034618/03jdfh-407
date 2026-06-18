const BASE = 'http://localhost:3077/api';

async function request(method, path, body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}
const post = (p, b) => request('POST', p, b);
const get = (p) => request('GET', p);
const patch = (p, b) => request('PATCH', p, b);
const del = (p, b) => request('DELETE', p, b);

const passed = []; const failed = [];
function check(name, cond) {
  if (cond) { passed.push(name); console.log(`  ✅ ${name}`); }
  else { failed.push(name); console.log(`  ❌ ${name}`); }
}
function section(title) { console.log(`\n=== ${title} ===`); }

(async () => {
  // 测试1: 同义短语剧透过滤 + 谜底区过滤
  section('测试1: 同义短语剧透过滤 + 谜底区过滤');
  const puzzle = await post('/puzzle/request', {
    chapterId: 'ch02', currentMap: '医院西楼三层',
    collectedItems: ['钥匙'],
    answerType: 'code',
    forbiddenInfo: ['张医生的真实身份', '太平间深处的房间', '2005年火灾', '最终BOSS'],
    difficulty: { platform: 'pc', tier: 'standard', minClueAppearances: 2, requiresPenAndPaper: false, allowReversePlayback: false, allowAudioOnly: true, maxSubSteps: 3 },
    playerState: { failureCount: 0 },
  });
  check('请求成功', puzzle.ok);
  const sf = puzzle.data.spoilerFilter;
  check('过滤已应用', sf?.applied);
  const report = sf?.fullReport;
  check('有fullReport', !!report);
  check('禁用词统计', report?.totalForbidden === 4);
  check('totalHit统计正确', report?.totalHit >= 0);
  check('totalMissed统计正确', report?.totalMissed >= 0);
  check('总数=hit+missed', report?.totalForbidden === report?.totalHit + report?.totalMissed);
  check('按位置分布有数据', report?.bySource && Object.keys(report.bySource).length > 0);
  if (report?.hit && report.hit.length) {
    const hit = report.hit[0];
    check('命中有matchedSynonyms', Array.isArray(hit.matchedSynonyms));
    check('命中有sources', Array.isArray(hit.sources));
  }
  const textForCheck = [puzzle.data.broadcast?.text || '', ...(puzzle.data.clues || []).map(c => c.text || ''), puzzle.data.successHook?.text || '', puzzle.data.answer?.display || ''].join(' ');
  const hasForbidden = ['张医生', '太平间深处', '2005年火灾', '最终BOSS'].some(t => textForCheck.includes(t));
  check('广播线索钩子谜底无禁用词', !hasForbidden);

  // 测试2: 移动端约束 - 谜底长度收紧
  section('测试2: 移动端平台约束收紧');
  const mobileP = await post('/puzzle/request', {
    chapterId: 'ch02', currentMap: '医院', collectedItems: [], answerType: 'code',
    forbiddenInfo: [],
    difficulty: { platform: 'mobile', tier: 'hard', minClueAppearances: 1, requiresPenAndPaper: true, allowReversePlayback: true, allowAudioOnly: true, maxSubSteps: 5 },
    playerState: { failureCount: 0 },
  });
  const adj = mobileP.data.platformAdjustments || [];
  check('移动端有平台调整', adj.length >= 5);
  const codeLen = String(mobileP.data.answer?.value || '').length;
  check('代码谜底 ≤ 2 位', codeLen <= 2);
  const noPen = adj.find(a => a.field === 'requiresPenAndPaper');
  check('纸笔被强制关闭', noPen && noPen.to === false);
  const noRev = adj.find(a => a.field === 'allowReversePlayback');
  check('倒放被强制关闭', noRev && noRev.to === false);
  const maxSub = adj.find(a => a.field === 'maxSubSteps');
  check('子步骤 ≤ 2', maxSub ? maxSub.to <= 2 : true);
  const minClues = adj.find(a => a.field === 'minClueAppearances');
  check('线索最少≥3', minClues ? minClues.to >= 3 : mobileP.data.difficulty?.minClueAppearances >= 3);

  // 测试3: 主机约束
  section('测试3: 主机平台约束');
  const consoleP = await post('/puzzle/request', {
    chapterId: 'ch03', currentMap: '宿舍', collectedItems: [], answerType: 'code',
    forbiddenInfo: [],
    difficulty: { platform: 'console', tier: 'nightmare', minClueAppearances: 1, requiresPenAndPaper: true, allowReversePlayback: true, allowAudioOnly: true, maxSubSteps: 6 },
    playerState: { failureCount: 0 },
  });
  const cAdj = consoleP.data.platformAdjustments || [];
  check('主机调整≥4项', cAdj.length >= 4);
  const cLen = String(consoleP.data.answer?.value || '').length;
  check('主机代码≤3位', cLen <= 3);
  const cSub = cAdj.find(a => a.field === 'maxSubSteps');
  check('主机子步骤≤3', cSub ? cSub.to <= 3 : true);
  const cPen = cAdj.find(a => a.field === 'requiresPenAndPaper');
  check('主机纸笔关闭', cPen ? cPen.to === false : !consoleP.data.difficulty?.requiresPenAndPaper);
  const cAudio = cAdj.find(a => a.field === 'allowAudioOnly');
  check('主机纯音频关闭', cAudio ? cAudio.to === false : !consoleP.data.difficulty?.allowAudioOnly);

  // 测试4: 直接失败次数无需会话
  section('测试4: 无会话也报告失败');
  const report1 = await post('/adaptation/report-failure', { currentFailureCount: 1 });
  check('失败次数递增', report1.data.failureCount === 2);
  check('返回下次重播等级', report1.data.nextReplayLevel !== undefined);
  const report2 = await post('/adaptation/report-failure', { currentFailureCount: report1.data.failureCount });
  check('再失败一次=3', report2.data.failureCount === 3);

  const replay = await post('/adaptation/replay', { failureCount: 5,
    puzzleRequest: { chapterId: 'c1', currentMap: 'm1', answerType: 'frequency', forbiddenInfo: [] },
    difficulty: { platform: 'pc', tier: 'standard' },
  });
  check('无会话直接失败5→Lv2', replay.data.adaptationLevel === 2);
  check('来源标注direct', replay.data.failureSource === 'direct');

  // 测试5: 会话时间线
  section('测试5: 会话时间线');
  const s1 = await post('/session', { chapterId: 'ch02' });
  const sid = s1.data.sessionId;
  check('会话创建成功', sid);

  const p1 = await post('/puzzle/request', {
    chapterId: 'ch02', currentMap: '医院', collectedItems: [], answerType: 'code', forbiddenInfo: [],
    difficulty: { platform: 'pc', tier: 'standard', minClueAppearances: 2, maxSubSteps: 3, requiresPenAndPaper: false },
    playerState: { failureCount: 0 }, sessionId: sid,
  });
  check('谜题生成返回sessionId', p1.data.sessionId === sid);
  const pid = p1.data.puzzleId;

  await post('/adaptation/report-failure', { sessionId: sid });
  await post('/puzzle/verify', { sessionId: sid, puzzleId: pid, answer: 'wronganswer', _correctAnswer: p1.data.answer });
  await post('/adaptation/replay', { sessionId: sid,
    puzzleRequest: { chapterId: 'ch02', currentMap: '医院', answerType: 'code', forbiddenInfo: [] },
    difficulty: { platform: 'pc', tier: 'standard' },
  });

  const tl = await get('/session/' + sid + '/timeline');
  check('时间线端点有效', tl.ok);
  const events = tl.data.timeline;
  check('至少5条事件', events.length >= 5);

  const types = events.map(e => e.type);
  check('含session_created', types.includes('session_created'));
  check('含puzzle_generated', types.includes('puzzle_generated'));
  check('含failure_reported', types.includes('failure_reported'));
  check('含attempt_recorded', types.includes('attempt_recorded'));
  check('含replay_requested', types.includes('replay_requested'));

  const gen = events.find(e => e.type === 'puzzle_generated');
  check('puzzle事件存broadcastSnapshot', !!gen.broadcastSnapshot?.text);
  check('puzzle事件存adaptationLevel', gen.adaptationLevel !== undefined);
  check('puzzle事件存failureCountAtGen', gen.failureCountAtGen !== undefined);

  const attempt = events.find(e => e.type === 'attempt_recorded');
  check('attempt有beforeFailure/afterFailure', attempt.beforeFailure !== undefined && attempt.afterFailure !== undefined);
  check('attempt有deltaFailure', attempt.deltaFailure !== undefined);

  const listRes = await get('/sessions');
  check('会话列表含本会话', listRes.ok && listRes.data.sessions.some(s => s.sessionId === sid));
  const meta = listRes.data.sessions.find(s => s.sessionId === sid);
  check('列表返回timelineEventCount', meta.timelineEventCount >= 5);

  // 单条事件详情
  const evt = events[0];
  const evDetail = await get('/session/' + sid + '/timeline/' + evt.id);
  check('单条事件端点有效', evDetail.ok && evDetail.data.id === evt.id);

  // 测试6: 草稿库组合筛选 + 批量 + 持久化
  section('测试6: 草稿库组合筛选 + 批量操作');

  // 造几个测试草稿（不同组合）
  const specDraft = async (overrides = {}, meta = {}) => {
    const body = {
      puzzleData: { chapterId: 'ch02', currentMap: meta.currentMap || '医院西楼',
        answer: { type: meta.answerType || 'code', value: '12', display: '12' },
        answerType: meta.answerType || 'code',
        platform: meta.platform || 'pc',
        broadcast: { text: '测试广播' + Math.random() },
        clues: [], wrongFeedback: [], successHook: {},
        difficulty: {}, adaptation: {},
      },
      meta: { ...meta },
    };
    Object.assign(body.puzzleData, overrides);
    return post('/drafts', body);
  };

  const d1 = await specDraft({}, { currentMap: '医院西楼三层', answerType: 'frequency', platform: 'pc', difficultyTier: 'easy' });
  const d2 = await specDraft({}, { currentMap: '太平间', answerType: 'code', platform: 'mobile', difficultyTier: 'hard', platformAdjustments: [{},{},{},{},{}], spoilerFilter: { applied: true, totalReplacements: 3, fullReport: {} } });
  const d3 = await specDraft({}, { currentMap: '地下车库', answerType: 'name', platform: 'console', difficultyTier: 'nightmare' });
  const d4 = await specDraft({}, { currentMap: '医院西楼', answerType: 'date', platform: 'pc', difficultyTier: 'standard' });
  const d5 = await specDraft({}, { currentMap: '门诊大厅', answerType: 'direction', platform: 'pc', difficultyTier: 'hard' });

  check('创建5张草稿', [d1,d2,d3,d4,d5].every(r => r.ok));

  const allList = await get('/drafts');
  check('列表总数≥5', allList.data.total >= 5);

  // 组合筛选: 平台mobile + 难度hard
  const filter1 = await get('/drafts?platform=mobile&difficultyTier=hard');
  check('平台+难度筛选', filter1.data.drafts.some(d => d.platform === 'mobile' && d.difficultyTier === 'hard'));

  // 类型+平台组合筛选
  const filter2 = await get('/drafts?answerType=code,date,frequency&platform=pc,mobile');
  check('多选筛选', filter2.data.drafts.every(d =>
    ['code','date','frequency'].includes(d.answerType) && ['pc','mobile'].includes(d.platform)));

  // 全文搜索
  const filter3 = await get('/drafts?search=太平间');
  check('全文搜索命中', filter3.data.drafts.length >= 1);

  // 批量操作
  const threeIds = [d1.data.draftId, d2.data.draftId, d3.data.draftId];
  const b1 = await patch('/drafts/batch/status', { draftIds: threeIds, status: 'adopted' });
  check('批量采用', b1.data.updatedCount === 3);
  const listAdopted = await get('/drafts?status=adopted');
  check('采用数量正确', listAdopted.data.total >= 3);

  const b2 = await patch('/drafts/batch/tags', { draftIds: threeIds, tags: ['chapter2', 'critical'] });
  check('批量打标签', b2.data.updatedCount === 3);

  const b3 = await del('/drafts/batch', { draftIds: [d4.data.draftId, d5.data.draftId] });
  check('批量删除', b3.data.deletedCount === 2);
  const listAfterDel = await get('/drafts');
  check('删除后剩余正确', listAfterDel.data.total === allList.data.total - 2);

  // 评分
  const rateRes = await patch('/drafts/' + d1.data.draftId + '/rate', { rating: 4 });
  check('评分端点有效', rateRes.ok && rateRes.data.qualityRating === 4);
  const stats = await get('/drafts/stats');
  check('统计含难度分布', stats.data.byDifficultyTier);
  check('统计含平台分布', stats.data.byPlatform);
  check('统计含平均评分', stats.data.averageRating >= 4);

  // 测试7: 草稿详情复核 - 含调整和过滤报告
  section('测试7: 草稿详情复核数据完整');
  const d2Detail = await get('/drafts/' + d2.data.draftId);
  const dd = d2Detail.data;
  check('草稿含platformAdjustments', Array.isArray(dd.platformAdjustments));
  check('草稿含spoilerFilter', !!dd.spoilerFilter);
  check('草稿含difficultyTier', dd.difficultyTier === 'hard');
  check('草稿列表含预览标记', listAdopted.data.drafts[0]?.hasSpoilerFilter !== undefined);
  check('列表含调整数量', listAdopted.data.drafts[0]?.platformAdjustmentsCount !== undefined);

  // 测试8: 会话失败次数一致性
  section('测试8: 会话内各端点失败次数一致');
  const s2 = await post('/session', { chapterId: 'ch03' });
  const s2id = s2.data.sessionId;

  const g0 = await post('/puzzle/request', {
    chapterId: 'ch03', currentMap: 'm1', collectedItems: [], answerType: 'code', forbiddenInfo: [],
    difficulty: { platform: 'pc' }, playerState: { failureCount: 0 }, sessionId: s2id,
  });
  check('首次生成失败次数=0', g0.data.failureCount === 0);

  await post('/adaptation/report-failure', { sessionId: s2id });
  const s2info = await get('/session/' + s2id);
  check('报告一次失败后=1', s2info.data.playerState.failureCount === 1);

  const rep1 = await post('/adaptation/replay', {
    sessionId: s2id,
    puzzleRequest: { chapterId: 'ch03', currentMap: 'm1', answerType: 'code', forbiddenInfo: [] },
    difficulty: { platform: 'pc' },
  });
  check('重播读到=1', rep1.data.failureCount === 1 && rep1.data.failureSource === 'session');

  await post('/puzzle/verify', { sessionId: s2id, puzzleId: g0.data.puzzleId, answer: 'X', _correctAnswer: g0.data.answer });
  const g2 = await post('/puzzle/request', {
    chapterId: 'ch03', currentMap: 'm1', collectedItems: [], answerType: 'code', forbiddenInfo: [],
    difficulty: { platform: 'pc' }, sessionId: s2id,
  });
  check('生成新题读到最新失败次数', g2.data.failureCount === 2);

  // 测试9: 谜底区过滤
  section('测试9: 谜底显示含人名过滤');
  const namePuzzle = await post('/puzzle/request', {
    chapterId: 'c3', currentMap: 'x', collectedItems: [], answerType: 'name',
    forbiddenInfo: ['王院长的秘密'],
    difficulty: { platform: 'pc', tier: 'standard' }, playerState: { failureCount: 0 },
  });
  const nRep = namePuzzle.data.spoilerFilter?.fullReport;
  const hasNameLeak = [namePuzzle.data.broadcast?.text || '', namePuzzle.data.answer?.display || '',
    ...(namePuzzle.data.clues || []).map(c => c.text || '')].join(' ').includes('王院长');
  check('姓名谜底未泄露王院长', !hasNameLeak);
  if (nRep?.totalMissed) console.log('    (未出现在生成中)');
  check('过滤报告完整', nRep?.totalForbidden === 1);

  // 测试10: 筛选条件通过localStorage和返回filters字段工作
  section('测试10: 列表返回filters字段');
  const list10 = await get('/drafts?status=adopted&platform=pc');
  check('返回filters对象', !!list10.data.filters);
  check('filters正确回显', list10.data.filters.status === 'adopted' && list10.data.filters.platform === 'pc');

  console.log(`\n====== 结果: ${passed.length} 通过, ${failed.length} 失败 ======`);
  if (failed.length) {
    console.log('  ❌ 失败项:');
    failed.forEach(n => console.log('    - ' + n));
    process.exit(1);
  }
})();
