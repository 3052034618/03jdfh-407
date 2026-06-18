const REPLAY_ADAPTATIONS = [
  {
    level: 0,
    label: '原始版本',
    description: '完整的阴间电台广播，无额外提示',
    clarityMultiplier: 1.0,
    extraClues: 0,
    revealDirectClue: false,
    broadcastSuffix: '',
  },
  {
    level: 1,
    label: '微光版本',
    description: '广播末尾附一句模糊的引导语',
    clarityMultiplier: 1.2,
    extraClues: 1,
    revealDirectClue: false,
    broadcastSuffix: '\n……滋……再听一遍……也许你能听到刚才错过的东西……',
  },
  {
    level: 2,
    label: '回声版本',
    description: '关键线索在广播中被重复强调，增加一条环境线索',
    clarityMultiplier: 1.5,
    extraClues: 2,
    revealDirectClue: true,
    broadcastSuffix: '\n……滋……如果你还没听清楚……请注意以下重复内容……滋……',
  },
  {
    level: 3,
    label: '余烬版本',
    description: '几乎直接揭示谜底，广播中明确说出答案线索',
    clarityMultiplier: 2.0,
    extraClues: 3,
    revealDirectClue: true,
    broadcastSuffix: '\n……滋……最后一次……答案就在广播里……请仔细听……滋……',
  },
];

function getAdaptationLevel(failureCount) {
  if (failureCount <= 1) return REPLAY_ADAPTATIONS[0];
  if (failureCount <= 3) return REPLAY_ADAPTATIONS[1];
  if (failureCount <= 5) return REPLAY_ADAPTATIONS[2];
  return REPLAY_ADAPTATIONS[3];
}

module.exports = { REPLAY_ADAPTATIONS, getAdaptationLevel };
