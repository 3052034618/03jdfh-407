const CLUE_TEMPLATES = {
  frequency: {
    direct: [
      '广播中明确提到了频率{value}兆赫',
      '有一个数字台不断重复{value}',
      '紧急频道被锁定在{value}兆赫',
    ],
    indirect: [
      '广播中出现了两组数字{intPart}和{decPart}，可能与频率有关',
      '信号最强的频段似乎在某两个整数之间',
      '旋转调频旋钮时，{value}附近会出现清晰的语音',
    ],
    environmental: [
      '{currentMap}的墙壁上刻着模糊的数字{intPart}',
      '收音机在{value}兆赫附近会发出异响',
      '某张报纸的频率版面被圈出了{decPart}',
    ],
  },
  date: {
    direct: [
      '广播中反复提到了{era}{year}年{month}月{day}日',
      '讣告上的日期是{month}月{day}日',
      '纪念广播指向{year}年{month}月{day}日',
    ],
    indirect: [
      '广播中提到了一个年份{year}和一个月份{month}，但日期被杂音覆盖',
      '某段记录中出现了"那个月的第{day}天"的说法',
      '气象记录标注了{year}年，但具体日期需要推算',
    ],
    environmental: [
      '{currentMap}的日历上{month}月{day}日被圈了出来',
      '墙上的涂鸦写着"{day}"，像是某种倒计时',
      '一本旧日记翻到了{month}月的那一页',
    ],
  },
  name: {
    direct: [
      '广播中点名寻找"{value}"',
      '信件的收件人是"{value}"',
      '病案档案上的名字是"{value}"',
    ],
    indirect: [
      '广播中提到了一个姓"{surname}"的人',
      '有人说"那个人的名字写在墙上"但没说具体位置',
      '点名时跳过了某个名字，只说了"和那位"',
    ],
    environmental: [
      '{currentMap}的门牌上刻着"{value}"',
      '桌上有一封寄给"{value}"的信',
      '照片背面的字迹写着"{value}"',
    ],
  },
  direction: {
    direct: [
      '广播明确指出应朝{value}方向前进',
      '罗盘校准广播将{value}设为唯一安全方向',
      '路径警告中只有{value}方向被标记为可通行',
    ],
    indirect: [
      '广播中说"跟着风走"而风从{value}吹来',
      '罗盘的指针一直在{value}方向颤抖',
      '广播提到"远离危险方向"但需要排除法确定安全方向',
    ],
    environmental: [
      '{currentMap}的指示牌指向{value}',
      '地面上的脚印都朝{value}延伸',
      '墙上箭头涂鸦指向{value}',
    ],
  },
  code: {
    direct: [
      '广播中完整播出了序列"{value}"',
      '验证码广播明确重复了"{value}"',
      '坐标标记编号为"{value}"',
    ],
    indirect: [
      '广播中分段播出了数字序列，需要按顺序拼接',
      '每段广播只播一个数字，共{length}段',
      '序列被拆分为若干组，需要还原',
    ],
    environmental: [
      '{currentMap}的保险柜上标有"{value}"字样',
      '门锁旁贴着写有"{value}"的便条',
      '某本日志中{value}被反复划线标注',
    ],
  },
};

function formatClue(template, params) {
  return template
    .replace(/\{value\}/g, params.value || '')
    .replace(/\{intPart\}/g, params.intPart || '')
    .replace(/\{decPart\}/g, params.decPart || '')
    .replace(/\{surname\}/g, params.surname || '')
    .replace(/\{era\}/g, params.era || '')
    .replace(/\{year\}/g, String(params.year || ''))
    .replace(/\{month\}/g, String(params.month || ''))
    .replace(/\{day\}/g, String(params.day || ''))
    .replace(/\{currentMap\}/g, params.currentMap || '')
    .replace(/\{length\}/g, String(params.length || ''));
}

module.exports = { CLUE_TEMPLATES, formatClue };
