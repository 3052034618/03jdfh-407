const express = require('express');
const router = express.Router();
const { createDifficultyConstraint, VALID_PLATFORMS } = require('../../models/schemas');

const PLATFORM_PROFILES = {
  pc: {
    label: 'PC / 键鼠',
    description: '适合复杂操作、纸笔记录、高频交互',
    defaultConstraints: {
      minClueAppearances: 2,
      allowReversePlayback: true,
      requiresPenAndPaper: false,
      maxSubSteps: 5,
      timeLimitSeconds: null,
      allowAudioOnly: true,
    },
  },
  console: {
    label: '主机 / 手柄',
    description: '简化输入、禁用纸笔要求、限制子步骤',
    defaultConstraints: {
      minClueAppearances: 2,
      allowReversePlayback: true,
      requiresPenAndPaper: false,
      maxSubSteps: 4,
      timeLimitSeconds: null,
      allowAudioOnly: false,
    },
  },
  mobile: {
    label: '移动端 / 触屏',
    description: '极简输入、短广播、更少子步骤',
    defaultConstraints: {
      minClueAppearances: 3,
      allowReversePlayback: false,
      requiresPenAndPaper: false,
      maxSubSteps: 3,
      timeLimitSeconds: 120,
      allowAudioOnly: false,
    },
  },
};

router.get('/platforms', (req, res) => {
  res.json({
    platforms: Object.entries(PLATFORM_PROFILES).map(([key, profile]) => ({
      id: key,
      label: profile.label,
      description: profile.description,
      defaultConstraints: profile.defaultConstraints,
    })),
  });
});

router.post('/apply', (req, res) => {
  const { platform, overrides } = req.body;

  const selectedPlatform = platform || 'pc';
  if (!VALID_PLATFORMS.includes(selectedPlatform)) {
    return res.status(400).json({
      error: 'INVALID_PLATFORM',
      messages: [`platform must be one of: ${VALID_PLATFORMS.join(', ')}`],
    });
  }

  const profile = PLATFORM_PROFILES[selectedPlatform];
  const base = { ...profile.defaultConstraints };

  if (overrides) {
    const overrideConstraint = createDifficultyConstraint(overrides);
    Object.keys(overrideConstraint).forEach(key => {
      if (overrides[key] !== undefined && overrides[key] !== null) {
        base[key] = overrideConstraint[key];
      }
    });
  }

  const warnings = [];
  const adjusted = { ...base };

  if (selectedPlatform === 'console' && adjusted.requiresPenAndPaper) {
    adjusted.requiresPenAndPaper = false;
    warnings.push('主机平台不支持纸笔记录要求，已自动调整为false');
  }

  if (selectedPlatform === 'mobile') {
    if (adjusted.requiresPenAndPaper) {
      adjusted.requiresPenAndPaper = false;
      warnings.push('移动端不支持纸笔记录要求，已自动调整为false');
    }
    if (adjusted.maxSubSteps > 4) {
      adjusted.maxSubSteps = 4;
      warnings.push('移动端最大子步骤已限制为4');
    }
    if (adjusted.allowAudioOnly) {
      adjusted.allowAudioOnly = false;
      warnings.push('移动端不推荐纯音频谜题，已自动调整为false');
    }
  }

  if (adjusted.minClueAppearances < 1) {
    adjusted.minClueAppearances = 1;
    warnings.push('线索出现次数不能小于1，已自动调整为1');
  }

  if (adjusted.maxSubSteps < 1) {
    adjusted.maxSubSteps = 1;
    warnings.push('子步骤数不能小于1，已自动调整为1');
  }

  res.json({
    platform: selectedPlatform,
    platformLabel: profile.label,
    constraints: adjusted,
    warnings: warnings.length > 0 ? warnings : undefined,
  });
});

router.get('/presets', (req, res) => {
  const presets = {
    easy: {
      label: '轻松',
      description: '线索明确、可倒放、无纸笔、低子步骤',
      constraints: {
        minClueAppearances: 3,
        allowReversePlayback: true,
        requiresPenAndPaper: false,
        maxSubSteps: 2,
        timeLimitSeconds: null,
        allowAudioOnly: false,
      },
    },
    normal: {
      label: '标准',
      description: '线索适中、可倒放、可选纸笔',
      constraints: {
        minClueAppearances: 2,
        allowReversePlayback: true,
        requiresPenAndPaper: false,
        maxSubSteps: 3,
        timeLimitSeconds: null,
        allowAudioOnly: true,
      },
    },
    hard: {
      label: '硬核',
      description: '线索隐晦、不可倒放、需要纸笔、高子步骤',
      constraints: {
        minClueAppearances: 1,
        allowReversePlayback: false,
        requiresPenAndPaper: true,
        maxSubSteps: 5,
        timeLimitSeconds: 90,
        allowAudioOnly: true,
      },
    },
    nightmare: {
      label: '噩梦',
      description: '一次性广播、必须纸笔、限时、线索极隐晦',
      constraints: {
        minClueAppearances: 1,
        allowReversePlayback: false,
        requiresPenAndPaper: true,
        maxSubSteps: 6,
        timeLimitSeconds: 60,
        allowAudioOnly: true,
      },
    },
  };

  res.json({ presets });
});

module.exports = router;
