const BROADCAST_TEMPLATES = {
  frequency: [
    {
      id: 'freq_dead_air',
      label: '死空气扫描',
      generate: (answer, ctx) => {
        const freq = answer.value.toFixed(1);
        const segments = [
          `……滋……兹……这里是……未注册频段……滋……`,
          `我们一直在……${freq}……兆赫……等待有人调到这个位置……`,
          `信号很弱……如果你听到了……说明你离得很近了……`,
          `……滋……记住这个频率……${freq}……这是我们最后的坐标……滋……`,
        ];
        if (ctx.mapHint) segments.splice(2, 0, `从${ctx.currentMap}的方向……传来了回声……`);
        return segments.join('\n');
      },
    },
    {
      id: 'freq_numbers_station',
      label: '数字台广播',
      generate: (answer, ctx) => {
        const freq = answer.value.toFixed(1);
        const intPart = Math.floor(answer.value);
        const decPart = Math.round((answer.value - intPart) * 10);
        return [
          `注意……注意……数字广播……将于今日午夜播出……`,
          `第一组……${intPart}……第二组……${decPart}……`,
          `重复……${intPart}……点……${decPart}……`,
          `请调至指定位置接收完整信息……滋……`,
          `……频率${freq}……这是唯一的出路……滋滋……`,
        ].join('\n');
      },
    },
    {
      id: 'freq_emergency_alert',
      label: '紧急警报',
      generate: (answer, ctx) => {
        const freq = answer.value.toFixed(1);
        return [
          `⚠ 紧急广播 ⚠ 此信息将在所有频段循环播出……`,
          `受影响区域人员请立即调至……${freq}兆赫……`,
          `这是唯一的安全频道……其余频率已被……占据……`,
          `不要尝试其他频段……重复……只保留${freq}……滋……`,
          `……他们正在监听……快走……`,
        ].join('\n');
      },
    },
  ],

  date: [
    {
      id: 'date_obituary',
      label: '讣告广播',
      generate: (answer, ctx) => {
        const y = answer.value.year;
        const m = answer.value.month;
        const d = answer.value.day;
        const era = answer.value.era || '';
        return [
          `……滋……以下播报一则讣告……滋……`,
          `${era}${y}年${m}月${d}日……那位……已经不在了……`,
          `我们在那一天……失去了所有联系……`,
          `如果你在日历上找到了那个日期……${m}月${d}日……`,
          `请……回到那一天……回到一切开始的地方……滋……`,
        ].join('\n');
      },
    },
    {
      id: 'date_anniversary',
      label: '纪念日广播',
      generate: (answer, ctx) => {
        const y = answer.value.year;
        const m = answer.value.month;
        const d = answer.value.day;
        return [
          `每年的这一天……我们都会收到同样的信号……`,
          `${y}年……${m}月${d}日……从来没有人忘记……`,
          `但没有人记得为什么……滋……`,
          `日历上被圈起来的那一天……${m}月${d}日……`,
          `……那天发生了什么？……滋滋……请找到答案……`,
        ].join('\n');
      },
    },
    {
      id: 'date_weather_log',
      label: '气象记录广播',
      generate: (answer, ctx) => {
        const y = answer.value.year;
        const m = answer.value.month;
        const d = answer.value.day;
        return [
          `……存档气象播报……日期……${y}年${m}月${d}日……`,
          `当日天气……异常……能见度……零……`,
          `所有外出记录……于${m}月${d}日当天……全部中断……`,
          `这不是天气……这是……滋……不要在那一天外出……`,
          `……记住这个日期……它是……唯一的线索……滋……`,
        ].join('\n');
      },
    },
  ],

  name: [
    {
      id: 'name_roll_call',
      label: '点名广播',
      generate: (answer, ctx) => {
        const name = answer.value;
        const surname = name.charAt(0);
        return [
          `……滋……现在进行点名……滋……`,
          `张……李……王……赵……`,
          `……${surname}……有人在找${surname}姓的人……`,
          `……${name}……你还在吗？……我们一直在叫你的名字……`,
          `如果你听到了……请回应……${name}……这是最后一次点名……滋……`,
        ].join('\n');
      },
    },
    {
      id: 'name_letter',
      label: '信件广播',
      generate: (answer, ctx) => {
        const name = answer.value;
        return [
          `这里有一封未投递的信件……收件人……${name}……`,
          `信中只有一句话……"回来"……`,
          `${name}……有人一直在等你……滋……`,
          `我们不知道${name}是谁……但这个名字不断出现在记录中……`,
          `……找到${name}……也许就能找到出口……滋滋……`,
        ].join('\n');
      },
    },
    {
      id: 'name_patient_file',
      label: '病案广播',
      generate: (answer, ctx) => {
        const name = answer.value;
        return [
          `……滋……以下播报失踪人员档案……滋……`,
          `患者编号……无法辨认……姓名……${name}……`,
          `最后已知位置……${ctx.currentMap || '不明'}……`,
          `${name}……如果你能听到这段广播……说明你还在里面……`,
          `……说出这个名字……也许他们就会放你走……滋……`,
        ].join('\n');
      },
    },
  ],

  direction: [
    {
      id: 'dir_compass',
      label: '罗盘广播',
      generate: (answer, ctx) => {
        const dir = answer.value;
        return [
          `……滋……罗盘校准广播……滋……`,
          `北……不是……东……不是……`,
          `……正确的方向是……${dir}……`,
          `不要相信你的直觉……只有${dir}……是安全的……`,
          `其他方向……它们在等着你走错……滋滋……`,
        ].join('\n');
      },
    },
    {
      id: 'dir_path_warning',
      label: '路径警告广播',
      generate: (answer, ctx) => {
        const dir = answer.value;
        return [
          `……滋……路径广播……前方道路状况……滋……`,
          `左侧……塌方……右侧……迷失……`,
          `唯一可通行方向……${dir}……`,
          `从${ctx.currentMap || '当前位置'}出发……朝${dir}走……`,
          `……不要回头……不要偏离${dir}方向……滋……`,
        ].join('\n');
      },
    },
    {
      id: 'dir_wind',
      label: '风声广播',
      generate: (answer, ctx) => {
        const dir = answer.value;
        return [
          `……风从${dir}吹来……带来了……不该被听到的声音……`,
          `你感觉到没有？……${dir}方向……气压在降低……`,
          `跟着风走……${dir}……那是唯一的通风口……`,
          `……滋……风在说……${dir}……${dir}……一直重复……`,
          `如果风停了……你就走错了……滋滋……`,
        ].join('\n');
      },
    },
  ],

  code: [
    {
      id: 'code_sequence',
      label: '序列广播',
      generate: (answer, ctx) => {
        const code = answer.value;
        const digits = code.split('');
        const spaced = digits.join('……');
        return [
          `……滋……验证码广播……滋……`,
          `请输入以下序列以继续……`,
          `${spaced}……`,
          `重复……${spaced}……`,
          `……这是最后一条信息……输入正确序列才能终止广播……滋……`,
        ].join('\n');
      },
    },
    {
      id: 'code_coordinates',
      label: '坐标广播',
      generate: (answer, ctx) => {
        const code = answer.value;
        return [
          `……滋……坐标锁定广播……滋……`,
          `目标位置……编号${code}……`,
          `在${ctx.currentMap || '当前区域'}……找到${code}号标记……`,
          `这不是一串数字……这是一把钥匙……${code}……`,
          `……对准它……就能打开……滋滋……`,
        ].join('\n');
      },
    },
  ],
};

module.exports = { BROADCAST_TEMPLATES };
