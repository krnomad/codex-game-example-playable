// PROTOTYPE - NOT FOR PRODUCTION (v4 - Mobile QA Fix)
// Question: Is slot-based tower placement + wave defense fun on mobile landscape?
// Date: 2026-03-26

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const IMAGE_PATHS = {
  background: 'assets/backgrounds/sacred-valley.svg',
  heroes: {
    musa: 'assets/heroes/musa.svg',
    gungsu: 'assets/heroes/gungsu.svg',
    dosa: 'assets/heroes/dosa.svg',
    mugnyeo: 'assets/heroes/mugnyeo.svg',
  },
  leaders: {
    taegun: 'assets/leaders/taesan.svg',
    yeonhwa: 'assets/leaders/eunbi.svg',
    haeryeong: 'assets/leaders/wolyeong.svg',
  },
  relics: {
    war_drum: 'assets/relics/war-drum.svg',
    moon_seal: 'assets/relics/moon-seal.svg',
    falcon_fan: 'assets/relics/falcon-fan.svg',
    guild_medal: 'assets/relics/guild-medal.svg',
  },
};

const images = {
  background: null,
  heroes: {},
  leaders: {},
  relics: {},
};

const audioState = {
  enabled: true,
  unlocked: false,
  ctx: null,
  master: null,
  musicGain: null,
  fxGain: null,
  schedulerId: null,
  nextNoteTime: 0,
  musicStep: 0,
  lastAttackTime: 0,
};

// ── Responsive Canvas (accounts for right panel width) ──
const W = 960, H = 540;
const RIGHT_PANEL_W = 94;
let canvasScale = { x: 1, y: 1 };
let canvasOffset = { x: 0, y: 0 };

let currentDpr = 1;
let currentUniformScale = 1;

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  currentDpr = dpr;
  const cw = window.innerWidth - RIGHT_PANEL_W;
  const ch = window.innerHeight;

  // Aspect-ratio-preserving uniform scale with letterbox
  const scaleX = cw / W;
  const scaleY = ch / H;
  const uniformScale = Math.min(scaleX, scaleY);
  currentUniformScale = uniformScale;
  const drawW = W * uniformScale;
  const drawH = H * uniformScale;
  const offsetX = (cw - drawW) / 2;
  const offsetY = (ch - drawH) / 2;

  // Buffer at full game resolution * dpr, CSS scales to display size
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width = drawW + 'px';
  canvas.style.height = drawH + 'px';
  canvas.style.left = offsetX + 'px';
  canvas.style.top = offsetY + 'px';

  canvasScale = { x: W / drawW, y: H / drawH };
  canvasOffset = { x: offsetX, y: offsetY };

  // DPR-only transform (game draws in 960x540 world coords, CSS handles display scaling)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 200));
resizeCanvas();

// ── Input deduplication (prevent both click + touchend firing) ──
let isTouchDevice = false;

// ── Pixel Drawing Helpers ──
const PIX = 3;

function drawPixelRect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
}

function drawPixelSprite(cx, cy, pixels, scale) {
  const s = scale || PIX;
  const halfW = (pixels[0].length * s) / 2;
  const halfH = (pixels.length * s) / 2;
  for (let r = 0; r < pixels.length; r++) {
    for (let c = 0; c < pixels[r].length; c++) {
      if (pixels[r][c]) {
        ctx.fillStyle = pixels[r][c];
        ctx.fillRect(Math.floor(cx - halfW + c * s), Math.floor(cy - halfH + r * s), s, s);
      }
    }
  }
}

// ── Pixel Sprite Data ──
const SPRITES = {
  musa: [
    [0,0,'#c41e3a',0,0],
    [0,'#fdd','#c41e3a','#fdd',0],
    [0,'#fdd','#c41e3a','#fdd',0],
    ['#888','#c41e3a','#c41e3a','#c41e3a','#888'],
    [0,0,'#c41e3a',0,0],
    [0,'#c41e3a',0,'#c41e3a',0],
    [0,'#555',0,'#555',0],
  ],
  gungsu: [
    [0,'#3a5','#3a5','#3a5',0],
    [0,'#fdd','#3a5','#fdd',0],
    [0,'#fdd','#3a5','#fdd',0],
    [0,'#3a5','#3a5','#3a5','#864'],
    [0,0,'#3a5',0,'#864'],
    [0,'#3a5',0,'#3a5',0],
    [0,'#555',0,'#555',0],
  ],
  dosa: [
    [0,'#93f','#93f','#93f',0],
    [0,'#fdd','#93f','#fdd',0],
    ['#93f','#fdd','#93f','#fdd','#93f'],
    [0,'#93f','#93f','#93f',0],
    [0,'#60f','#93f','#60f',0],
    [0,'#93f',0,'#93f',0],
    [0,'#555',0,'#555',0],
  ],
  mugnyeo: [
    ['#f8c','#f8c','#f8c','#f8c','#f8c'],
    [0,'#fdd','#f8c','#fdd',0],
    [0,'#fdd','#f8c','#fdd',0],
    [0,'#f8c','#fff','#f8c',0],
    [0,'#f8c','#fff','#f8c',0],
    [0,'#f8c','#fff','#f8c',0],
    [0,'#555',0,'#555',0],
  ],
  goblin: [
    [0,'#4a4',0,'#4a4',0],
    [0,'#4a4','#4a4','#4a4',0],
    ['#f00','#4a4','#4a4','#4a4','#f00'],
    [0,'#4a4','#4a4','#4a4',0],
    [0,0,'#4a4',0,0],
    [0,'#4a4',0,'#4a4',0],
  ],
  wolf: [
    [0,'#875',0,0,0],
    ['#875','#875','#875','#875',0],
    ['#a97','#875','#fff','#875','#875'],
    [0,'#875','#875','#875',0],
    ['#875',0,'#875',0,'#875'],
  ],
  ghost: [
    [0,'#aad','#aad','#aad',0],
    ['#aad','#226','#aad','#226','#aad'],
    ['#aad','#aad','#aad','#aad','#aad'],
    ['#88b','#aad','#aad','#aad','#88b'],
    ['#88b',0,'#88b',0,'#88b'],
  ],
  ogre: [
    ['#a33','#a33','#a33','#a33','#a33'],
    ['#a33','#ff0','#a33','#ff0','#a33'],
    ['#c44','#a33','#a33','#a33','#c44'],
    ['#a33','#a33','#a33','#a33','#a33'],
    [0,'#a33',0,'#a33',0],
    ['#a33','#666',0,'#666','#a33'],
  ],
  boss: [
    ['#f00','#811','#f00','#811','#f00'],
    ['#811','#ff0','#f00','#ff0','#811'],
    ['#a22','#811','#f00','#811','#a22'],
    ['#f00','#811','#f00','#811','#f00'],
    ['#811','#f00','#f00','#f00','#811'],
    [0,'#811','#f00','#811',0],
    ['#811','#444','#811','#444','#811'],
  ],
  bat: [
    ['#636',0,0,0,'#636'],
    ['#636','#636',0,'#636','#636'],
    [0,'#636','#f00','#636',0],
    [0,0,'#636',0,0],
  ],
  shaman: [
    [0,'#0a8','#0a8','#0a8',0],
    [0,'#f00','#0a8','#f00',0],
    ['#0a8','#0a8','#0a8','#0a8','#0a8'],
    [0,'#0a8','#0a8','#0a8',0],
    [0,'#0a8',0,'#0a8',0],
    [0,'#555',0,'#555',0],
  ],
  tree: [
    [0,0,'#2a5',0,0],
    [0,'#2a5','#3b6','#2a5',0],
    ['#2a5','#3b6','#3b6','#3b6','#2a5'],
    [0,'#2a5','#3b6','#2a5',0],
    [0,0,'#642',0,0],
    [0,0,'#642',0,0],
  ],
  rock: [
    [0,'#666','#777',0],
    ['#555','#777','#888','#666'],
    ['#666','#888','#777','#555'],
  ],
  house: [
    [0,0,'#a33',0,0],
    [0,'#a33','#a33','#a33',0],
    ['#a33','#a33','#a33','#a33','#a33'],
    ['#864','#864','#542','#864','#864'],
    ['#864','#864','#542','#864','#864'],
  ],
};

// ── Game State ──
const state = {
  gold: 150,
  lives: 20,
  wave: 0,
  kills: 0,
  totalWaves: 8,
  phase: 'placement',
  selectedHeroType: null,
  selectedTowerIdx: null,
  enemies: [],
  towers: [],
  projectiles: [],
  particles: [],
  floatingTexts: [],
  screenShake: { x: 0, y: 0, intensity: 0 },
  combo: { count: 0, timer: 0 },
  waveTimer: 0,
  spawnQueue: [],
  skillCooldowns: {},
  gameTime: 0,
  speedMult: 1,
  totalDamageDealt: 0,
  earnedGold: 0,
  environmentObjects: [],
  fog: [],
  leader: {
    key: null,
    xp: 0,
    level: 1,
    unspentPoints: 0,
    unlockedNodes: [],
    levelsGained: 0,
  },
  treasury: {
    treasures: 0,
    upgradesAttempted: 0,
    upgradesSucceeded: 0,
    relics: {
      war_drum: { level: 0, pity: 0 },
      moon_seal: { level: 0, pity: 0 },
      falcon_fan: { level: 0, pity: 0 },
      guild_medal: { level: 0, pity: 0 },
    },
  },
};

// ── Path Definition (adjusted for 960x540) ──
const PATH = [
  { x: -30, y: 260 },
  { x: 100, y: 260 },
  { x: 100, y: 120 },
  { x: 280, y: 120 },
  { x: 280, y: 380 },
  { x: 460, y: 380 },
  { x: 460, y: 170 },
  { x: 640, y: 170 },
  { x: 640, y: 400 },
  { x: 790, y: 400 },
  { x: 790, y: 260 },
  { x: 920, y: 260 },
];

const PATH_CUMULATIVE = [0];
for (let i = 1; i < PATH.length; i++) {
  const dx = PATH[i].x - PATH[i - 1].x;
  const dy = PATH[i].y - PATH[i - 1].y;
  PATH_CUMULATIVE[i] = PATH_CUMULATIVE[i - 1] + Math.sqrt(dx * dx + dy * dy);
}
const PATH_TOTAL_LENGTH = PATH_CUMULATIVE[PATH_CUMULATIVE.length - 1];

// ── Tower Slots (rightmost slots pulled in so they don't go under panel) ──
const SLOT_TOUCH_RADIUS = 36;
const SLOTS = [
  { x: 50,  y: 190, tower: null, terrain: 'normal' },
  { x: 190, y: 70,  tower: null, terrain: 'high' },
  { x: 190, y: 260, tower: null, terrain: 'normal' },
  { x: 370, y: 250, tower: null, terrain: 'normal' },
  { x: 370, y: 440, tower: null, terrain: 'normal' },
  { x: 550, y: 280, tower: null, terrain: 'high' },
  { x: 550, y: 110, tower: null, terrain: 'normal' },
  { x: 700, y: 290, tower: null, terrain: 'normal' },
  { x: 700, y: 460, tower: null, terrain: 'normal' },
  { x: 780, y: 330, tower: null, terrain: 'high' },  // was 850, pulled in
];

// ── Hero Definitions ──
const HEROES = {
  musa: {
    name: '무사',
    icon: '⚔️',
    cost: 40,
    damage: 18,
    range: 85,
    attackSpeed: 0.9,
    color: '#e74c3c',
    type: 'melee',
    desc: '근접 고데미지 전사',
    sprite: 'musa',
    portrait: IMAGE_PATHS.heroes.musa,
    skill: { name: '질풍참', icon: '🌪️', cooldown: 10, effect: 'aoe_burst', desc: '주변 적 전체에 3배 데미지' },
    synergy: 'mugnyeo', synergyBonus: '공격력 +25%',
  },
  gungsu: {
    name: '궁수',
    icon: '🏹',
    cost: 30,
    damage: 12,
    range: 170,
    attackSpeed: 1.4,
    color: '#2ecc71',
    type: 'ranged',
    desc: '원거리 속사 딜러',
    sprite: 'gungsu',
    portrait: IMAGE_PATHS.heroes.gungsu,
    skill: { name: '만궁술', icon: '🎯', cooldown: 8, effect: 'rapid_fire', desc: '4초간 3배 공속' },
    synergy: 'dosa', synergyBonus: '사거리 +20%',
  },
  dosa: {
    name: '도사',
    icon: '🔮',
    cost: 50,
    damage: 10,
    range: 140,
    attackSpeed: 0.5,
    color: '#9b59b6',
    type: 'aoe',
    desc: '범위 마법 공격',
    sprite: 'dosa',
    portrait: IMAGE_PATHS.heroes.dosa,
    skill: { name: '뇌전술', icon: '⚡', cooldown: 14, effect: 'lightning', desc: '5체인 번개 (4배 데미지)' },
    synergy: 'gungsu', synergyBonus: '범위 +30%',
  },
  mugnyeo: {
    name: '무녀',
    icon: '🌸',
    cost: 45,
    damage: 6,
    range: 130,
    attackSpeed: 0.6,
    color: '#f39c12',
    type: 'support',
    desc: '감속 + 인접 아군 버프',
    sprite: 'mugnyeo',
    portrait: IMAGE_PATHS.heroes.mugnyeo,
    skill: { name: '결계', icon: '🛡️', cooldown: 16, effect: 'barrier', desc: '5초간 전체 적 60% 감속' },
    synergy: 'musa', synergyBonus: '감속 효과 +40%',
  },
};

const LEADER_LEVEL_XP = [0, 55, 135, 235];

const LEADERS = {
  taegun: {
    name: '태군',
    title: '선봉 대장군',
    icon: '🛡️',
    portrait: IMAGE_PATHS.leaders.taegun,
    color: '#ffb86b',
    desc: '근접 화력을 앞세워 웨이브를 밀어붙이는 공격형 지도자.',
    trait: '전장 호령: 전체 영웅 피해 +8%',
    traitBonuses: { allDamagePct: 0.08 },
    tree: [
      { id: 'taegun_orders', branch: '전투', levelReq: 2, name: '전장의 명령', desc: '전체 영웅 피해가 추가로 10% 증가합니다.', bonuses: { allDamagePct: 0.10 } },
      { id: 'taegun_vanguard', branch: '선봉', levelReq: 3, name: '선봉 돌격', desc: '무사 계열 피해가 18% 증가합니다.', bonuses: { meleeDamagePct: 0.18 } },
      { id: 'taegun_execution', branch: '결전', levelReq: 4, name: '결전 지휘', desc: '보스에게 주는 피해가 18% 증가합니다.', bonuses: { bossDamagePct: 0.18 } },
    ],
  },
  yeonhwa: {
    name: '연화',
    title: '전략가',
    icon: '🧭',
    portrait: IMAGE_PATHS.leaders.yeonhwa,
    color: '#7fc8ff',
    desc: '고지대와 경제 운영을 살려 장기전을 안정적으로 굴리는 지휘형 지도자.',
    trait: '지세 판독: 웨이브 보너스 +15%, 고지대 사거리 +14',
    traitBonuses: { waveGoldBonusPct: 0.15, highGroundRangeFlat: 14 },
    tree: [
      { id: 'yeonhwa_supply', branch: '경제', levelReq: 2, name: '보급선 정비', desc: '웨이브 보너스가 추가로 20% 증가합니다.', bonuses: { waveGoldBonusPct: 0.20 } },
      { id: 'yeonhwa_eagle', branch: '사격', levelReq: 3, name: '매의 시야', desc: '궁수 공격속도가 14% 증가합니다.', bonuses: { rangedAttackSpeedPct: 0.14 } },
      { id: 'yeonhwa_height', branch: '지형', levelReq: 4, name: '고지 포격', desc: '고지대에 배치된 영웅 사거리가 추가로 18 증가합니다.', bonuses: { highGroundRangeFlat: 18 } },
    ],
  },
  haeryeong: {
    name: '해령',
    title: '영맥 무녀',
    icon: '🌙',
    portrait: IMAGE_PATHS.leaders.haeryeong,
    color: '#c8a2ff',
    desc: '스킬 사이클과 마법 화력을 강화해 폭발적인 순간 화력을 만드는 신비형 지도자.',
    trait: '달의 호흡: 스킬 쿨다운 12% 감소',
    traitBonuses: { skillCooldownPct: 0.12 },
    tree: [
      { id: 'haeryeong_cycle', branch: '순환', levelReq: 2, name: '월맥 순환', desc: '스킬 쿨다운이 추가로 15% 감소합니다.', bonuses: { skillCooldownPct: 0.15 } },
      { id: 'haeryeong_echo', branch: '주술', levelReq: 3, name: '폭풍 메아리', desc: '스킬 피해가 22% 증가합니다.', bonuses: { skillDamagePct: 0.22 } },
      { id: 'haeryeong_sight', branch: '영시', levelReq: 4, name: '영안 개화', desc: '전체 영웅 사거리가 12 증가합니다.', bonuses: { allRangeFlat: 12 } },
    ],
  },
};

const TREASURE_RELICS = {
  war_drum: {
    name: '전쟁 북',
    icon: '🥁',
    art: IMAGE_PATHS.relics.war_drum,
    color: '#f7bc70',
    desc: '전체 공격 대형을 더 거칠게 밀어붙입니다.',
    bonuses: { allDamagePct: 0.045 },
    successRates: [0.92, 0.76, 0.58, 0.4, 0.26],
    maxLevel: 5,
  },
  moon_seal: {
    name: '월인 부적',
    icon: '🪬',
    art: IMAGE_PATHS.relics.moon_seal,
    color: '#8dd5ff',
    desc: '스킬 회전을 앞당겨 순간 폭발력을 높입니다.',
    bonuses: { skillCooldownPct: 0.045, skillDamagePct: 0.04 },
    successRates: [0.9, 0.72, 0.54, 0.36, 0.24],
    maxLevel: 5,
  },
  falcon_fan: {
    name: '매깃 부채',
    icon: '🪶',
    art: IMAGE_PATHS.relics.falcon_fan,
    color: '#d6c27f',
    desc: '사거리와 원거리 운영을 세밀하게 보정합니다.',
    bonuses: { allRangeFlat: 5, rangedAttackSpeedPct: 0.04 },
    successRates: [0.9, 0.74, 0.56, 0.38, 0.24],
    maxLevel: 5,
  },
  guild_medal: {
    name: '상단 훈장',
    icon: '🪙',
    art: IMAGE_PATHS.relics.guild_medal,
    color: '#ffdc8f',
    desc: '웨이브 보상과 강화 비용 효율을 높여 장기 운영을 돕습니다.',
    bonuses: { waveGoldBonusPct: 0.06, upgradeCostPct: 0.04 },
    successRates: [0.94, 0.78, 0.6, 0.42, 0.28],
    maxLevel: 5,
  },
};

function getLeaderDef() {
  return state.leader.key ? LEADERS[state.leader.key] : null;
}

function leaderHasNode(nodeId) {
  return state.leader.unlockedNodes.includes(nodeId);
}

function getLeaderBonus(key) {
  const leader = getLeaderDef();
  if (!leader) return 0;

  let total = leader.traitBonuses[key] || 0;
  leader.tree.forEach((node) => {
    if (!leaderHasNode(node.id)) return;
    total += node.bonuses[key] || 0;
  });
  return total;
}

function getRelicState(key) {
  return state.treasury.relics[key];
}

function getTreasureBonus(key) {
  let total = 0;
  Object.entries(TREASURE_RELICS).forEach(([relicKey, relicDef]) => {
    const relicState = getRelicState(relicKey);
    if (!relicState || relicState.level <= 0) return;
    const bonusPerLevel = relicDef.bonuses[key] || 0;
    total += bonusPerLevel * relicState.level;
  });
  return total;
}

function getProgressionBonus(key) {
  return getLeaderBonus(key) + getTreasureBonus(key);
}

function getThreatTier() {
  if (state.wave >= 8) return 'V';
  if (state.wave >= 6) return 'IV';
  if (state.wave >= 4) return 'III';
  if (state.wave >= 2) return 'II';
  return 'I';
}

function getLeaderLevelCap() {
  return LEADER_LEVEL_XP.length;
}

function getLeaderXpThreshold(level) {
  return LEADER_LEVEL_XP[Math.max(0, Math.min(level - 1, LEADER_LEVEL_XP.length - 1))];
}

function getLeaderProgress() {
  const currentLevel = state.leader.level;
  const currentFloor = getLeaderXpThreshold(currentLevel);
  const nextLevel = Math.min(currentLevel + 1, getLeaderLevelCap());
  const nextThreshold = getLeaderXpThreshold(nextLevel);
  if (currentLevel >= getLeaderLevelCap()) {
    return { current: state.leader.xp, target: state.leader.xp, ratio: 1 };
  }

  const span = Math.max(1, nextThreshold - currentFloor);
  return {
    current: state.leader.xp - currentFloor,
    target: span,
    ratio: Math.max(0, Math.min(1, (state.leader.xp - currentFloor) / span)),
  };
}

function getTowerEffectiveRange(tower, hasSynergy) {
  const hero = HEROES[tower.heroType];
  let range = tower.range;
  if (hasSynergy && hero.type === 'aoe') range *= 1.3;
  range += getProgressionBonus('allRangeFlat');
  if (tower.highGround) range += getProgressionBonus('highGroundRangeFlat');
  return range;
}

function getTowerDamageValue(tower, hasSynergy, options) {
  const hero = HEROES[tower.heroType];
  const opts = options || {};
  let multiplier = 1 + getProgressionBonus('allDamagePct');
  if (hero.type === 'melee') multiplier += getProgressionBonus('meleeDamagePct');
  if (opts.viaSkill) multiplier += getProgressionBonus('skillDamagePct');
  if (opts.againstBoss) multiplier += getProgressionBonus('bossDamagePct');

  let damage = tower.damage * multiplier;
  if (hasSynergy && hero.type === 'melee') damage *= 1.25;
  return Math.max(1, Math.floor(damage));
}

function getTowerAttackSpeedValue(tower, hero, hasSynergy) {
  let atkSpeed = tower.attackSpeed;
  if (tower.skillActive && hero.type === 'ranged') atkSpeed *= 3;
  if (hasSynergy && hero.type === 'melee') atkSpeed *= 1.25;
  if (hero.type === 'ranged') atkSpeed *= 1 + getProgressionBonus('rangedAttackSpeedPct');
  return atkSpeed;
}

// ── Synergy Check ──
function checkSynergy(tower) {
  const hero = HEROES[tower.heroType];
  if (!hero.synergy) return false;
  return state.towers.some(t => {
    if (t === tower) return false;
    if (t.heroType !== hero.synergy) return false;
    const dx = t.x - tower.x, dy = t.y - tower.y;
    return Math.sqrt(dx * dx + dy * dy) < 180;
  });
}

// ── Wave Definitions (8 waves, escalating) ──
const WAVES = [
  {
    name: '도깨비 무리',
    enemies: [{ type: 'goblin', count: 8, interval: 1.0 }],
  },
  {
    name: '산짐승의 습격',
    enemies: [
      { type: 'goblin', count: 5, interval: 0.8 },
      { type: 'wolf', count: 5, interval: 0.7, delay: 4 },
    ],
  },
  {
    name: '원귀의 한',
    enemies: [
      { type: 'ghost', count: 8, interval: 0.9 },
      { type: 'bat', count: 4, interval: 1.2, delay: 3 },
    ],
  },
  {
    name: '혼돈의 물결',
    enemies: [
      { type: 'goblin', count: 10, interval: 0.4 },
      { type: 'wolf', count: 6, interval: 0.6, delay: 2 },
      { type: 'ghost', count: 4, interval: 0.8, delay: 5 },
    ],
  },
  {
    name: '산적 두목 등장',
    enemies: [
      { type: 'wolf', count: 8, interval: 0.5 },
      { type: 'ogre', count: 2, interval: 3, delay: 3 },
      { type: 'bat', count: 6, interval: 0.6, delay: 1 },
    ],
  },
  {
    name: '요술사의 군세',
    enemies: [
      { type: 'shaman', count: 4, interval: 2.0 },
      { type: 'ghost', count: 8, interval: 0.5, delay: 1 },
      { type: 'goblin', count: 12, interval: 0.3, delay: 4 },
    ],
  },
  {
    name: '어둠의 대군',
    enemies: [
      { type: 'ogre', count: 4, interval: 1.5 },
      { type: 'wolf', count: 10, interval: 0.4, delay: 2 },
      { type: 'shaman', count: 3, interval: 2.0, delay: 4 },
      { type: 'bat', count: 8, interval: 0.4, delay: 6 },
    ],
  },
  {
    name: '⚠ 대요괴 강림 ⚠',
    enemies: [
      { type: 'goblin', count: 8, interval: 0.3 },
      { type: 'ogre', count: 3, interval: 2.0, delay: 2 },
      { type: 'shaman', count: 3, interval: 1.5, delay: 4 },
      { type: 'boss', count: 1, interval: 0, delay: 8 },
      { type: 'bat', count: 10, interval: 0.3, delay: 9 },
    ],
  },
];

// ── Enemy Types ──
const ENEMY_TYPES = {
  goblin:  { name: '도깨비', hp: 45,  speed: 1.3, reward: 8,  color: '#55aa55', size: 12, sprite: 'goblin', flying: false },
  wolf:    { name: '산짐승', hp: 65,  speed: 2.0, reward: 12, color: '#aa8866', size: 13, sprite: 'wolf', flying: false },
  ghost:   { name: '원귀',   hp: 55,  speed: 1.1, reward: 15, color: '#aabbdd', size: 12, sprite: 'ghost', flying: false, phase: true },
  bat:     { name: '박쥐',   hp: 30,  speed: 2.5, reward: 10, color: '#996699', size: 10, sprite: 'bat', flying: true },
  ogre:    { name: '오우거', hp: 250, speed: 0.7, reward: 30, color: '#cc4444', size: 16, sprite: 'ogre', flying: false, armor: 3 },
  shaman:  { name: '요술사', hp: 80,  speed: 0.9, reward: 25, color: '#00aa88', size: 13, sprite: 'shaman', flying: false, healer: true },
  boss:    { name: '대요괴', hp: 800, speed: 0.5, reward: 120, color: '#ff2244', size: 22, sprite: 'boss', flying: false, armor: 5 },
};

// ── Skill bar DOM cache ──
let lastSkillBarHash = '';
let lastTreasureForgeHash = '';

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function getAudioContextClass() {
  return window.AudioContext || window.webkitAudioContext || null;
}

function updateAudioButton() {
  const audioBtn = document.getElementById('audio-btn');
  if (!audioBtn) return;
  if (!getAudioContextClass()) {
    audioBtn.textContent = '🔇 N/A';
    audioBtn.disabled = true;
    return;
  }
  audioBtn.disabled = false;
  audioBtn.textContent = audioState.enabled ? '🔊 ON' : '🔈 OFF';
}

function initAudioEngine() {
  if (audioState.ctx) return true;
  const AudioContextClass = getAudioContextClass();
  if (!AudioContextClass) return false;

  const ctx = new AudioContextClass();
  const master = ctx.createGain();
  const musicGain = ctx.createGain();
  const fxGain = ctx.createGain();
  const compressor = ctx.createDynamicsCompressor();

  master.gain.value = 0.85;
  musicGain.gain.value = 0.18;
  fxGain.gain.value = 0.32;
  compressor.threshold.value = -18;
  compressor.knee.value = 18;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.01;
  compressor.release.value = 0.2;

  musicGain.connect(master);
  fxGain.connect(master);
  master.connect(compressor);
  compressor.connect(ctx.destination);

  audioState.ctx = ctx;
  audioState.master = master;
  audioState.musicGain = musicGain;
  audioState.fxGain = fxGain;
  updateAudioButton();
  return true;
}

function ensureAudio() {
  if (!audioState.enabled) return false;
  if (!initAudioEngine()) return false;
  if (audioState.ctx.state === 'suspended') {
    audioState.ctx.resume();
  }
  if (!audioState.unlocked) {
    audioState.unlocked = true;
    startMusicLoop();
  }
  return true;
}

function scheduleTone(freq, time, duration, options) {
  if (!audioState.ctx) return;
  const opts = options || {};
  const osc = audioState.ctx.createOscillator();
  const gain = audioState.ctx.createGain();
  const filter = audioState.ctx.createBiquadFilter();
  const target = opts.target === 'music' ? audioState.musicGain : audioState.fxGain;

  osc.type = opts.type || 'triangle';
  osc.frequency.setValueAtTime(freq, time);
  if (opts.slideTo) {
    osc.frequency.linearRampToValueAtTime(opts.slideTo, time + duration);
  }

  filter.type = opts.filterType || 'lowpass';
  filter.frequency.setValueAtTime(opts.filterFreq || 2400, time);
  if (opts.q) filter.Q.value = opts.q;

  const attack = opts.attack ?? 0.01;
  const release = opts.release ?? 0.08;
  const peak = opts.gain ?? 0.08;
  const endTime = time + duration;

  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(peak, time + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, endTime + release);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(target);
  osc.start(time);
  osc.stop(endTime + release + 0.02);
}

function scheduleNoise(time, duration, options) {
  if (!audioState.ctx) return;
  const opts = options || {};
  const buffer = audioState.ctx.createBuffer(1, Math.max(1, Math.floor(audioState.ctx.sampleRate * duration)), audioState.ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }

  const source = audioState.ctx.createBufferSource();
  const filter = audioState.ctx.createBiquadFilter();
  const gain = audioState.ctx.createGain();
  source.buffer = buffer;
  filter.type = opts.filterType || 'bandpass';
  filter.frequency.value = opts.filterFreq || 1200;
  filter.Q.value = opts.q || 0.8;
  gain.gain.setValueAtTime(opts.gain || 0.04, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(audioState.fxGain);
  source.start(time);
  source.stop(time + duration);
}

function getMusicMode() {
  if (state.phase === 'victory') return 'victory';
  if (state.phase === 'gameover') return 'defeat';
  if (state.phase === 'combat' && state.wave >= state.totalWaves) return 'boss';
  if (state.phase === 'combat') return 'combat';
  if (state.phase === 'between') return 'between';
  return 'placement';
}

function getMusicConfig(mode) {
  switch (mode) {
    case 'combat':
      return { tempo: 104, root: 50, melody: [0, 3, 5, 7, 10, 7, 5, 3], bass: [0, null, 7, null, 5, null, 3, null], gain: 0.05 };
    case 'boss':
      return { tempo: 116, root: 46, melody: [0, 0, 3, 5, 7, 5, 10, 7], bass: [0, null, 0, null, 5, null, 3, null], gain: 0.06 };
    case 'victory':
      return { tempo: 88, root: 55, melody: [0, 4, 7, 9, 12, 9, 7, 4], bass: [0, null, 7, null, 9, null, 4, null], gain: 0.055 };
    case 'defeat':
      return { tempo: 68, root: 43, melody: [0, -2, 0, 3, 0, -2, -5, -2], bass: [0, null, -5, null, -2, null, -7, null], gain: 0.045 };
    case 'between':
      return { tempo: 82, root: 52, melody: [0, 2, 5, 7, 5, 2, 0, 2], bass: [0, null, 5, null, 7, null, 2, null], gain: 0.045 };
    default:
      return { tempo: 76, root: 50, melody: [0, 2, 5, 7, 5, 2, 0, null], bass: [0, null, 7, null, 5, null, 2, null], gain: 0.04 };
  }
}

function scheduleMusicStep() {
  const mode = getMusicMode();
  const config = getMusicConfig(mode);
  const stepIndex = audioState.musicStep % config.melody.length;
  const stepDuration = 60 / config.tempo / 2;
  const time = audioState.nextNoteTime;

  const melodyOffset = config.melody[stepIndex];
  if (melodyOffset !== null && melodyOffset !== undefined) {
    const freq = midiToFreq(config.root + melodyOffset);
    scheduleTone(freq, time, stepDuration * 0.8, {
      target: 'music',
      type: mode === 'boss' ? 'sawtooth' : 'triangle',
      gain: config.gain,
      attack: 0.01,
      release: 0.12,
      filterFreq: mode === 'boss' ? 1600 : 2000,
    });
  }

  const bassOffset = config.bass[stepIndex];
  if (bassOffset !== null && bassOffset !== undefined) {
    const bassFreq = midiToFreq(config.root - 12 + bassOffset);
    scheduleTone(bassFreq, time, stepDuration * 0.95, {
      target: 'music',
      type: 'sine',
      gain: config.gain * 0.75,
      attack: 0.02,
      release: 0.18,
      filterFreq: 600,
    });
  }

  if (stepIndex % 4 === 0) {
    scheduleNoise(time, 0.06, { filterType: 'lowpass', filterFreq: 320, gain: 0.015 });
  }
  if (stepIndex % 8 === 0) {
    scheduleTone(midiToFreq(config.root - 24), time, stepDuration * 6, {
      target: 'music',
      type: mode === 'boss' ? 'sawtooth' : 'sine',
      gain: config.gain * 0.35,
      attack: 0.04,
      release: 0.22,
      filterFreq: mode === 'boss' ? 520 : 440,
    });
  }
  if ((mode === 'placement' || mode === 'between' || mode === 'victory') && stepIndex % 8 === 4) {
    scheduleTone(midiToFreq(config.root + 12), time, stepDuration * 1.2, {
      target: 'music',
      type: 'triangle',
      gain: config.gain * 0.55,
      attack: 0.01,
      release: 0.16,
      filterFreq: 2600,
    });
  }

  audioState.nextNoteTime += stepDuration;
  audioState.musicStep++;
}

function startMusicLoop() {
  if (!audioState.ctx || !audioState.enabled) return;
  if (audioState.schedulerId) return;
  audioState.nextNoteTime = audioState.ctx.currentTime + 0.05;
  audioState.schedulerId = window.setInterval(() => {
    if (!audioState.enabled || !audioState.ctx) return;
    while (audioState.nextNoteTime < audioState.ctx.currentTime + 0.35) {
      scheduleMusicStep();
    }
  }, 120);
}

function stopMusicLoop() {
  if (audioState.schedulerId) {
    clearInterval(audioState.schedulerId);
    audioState.schedulerId = null;
  }
}

function toggleAudio() {
  audioState.enabled = !audioState.enabled;
  updateAudioButton();
  if (!audioState.enabled) {
    stopMusicLoop();
    if (audioState.master && audioState.ctx) {
      audioState.master.gain.setTargetAtTime(0.0001, audioState.ctx.currentTime, 0.03);
    }
    return;
  }
  if (ensureAudio() && audioState.master) {
    audioState.master.gain.setTargetAtTime(0.85, audioState.ctx.currentTime, 0.05);
    playUiSound();
  }
}

function playUiSound() {
  if (!ensureAudio()) return;
  const now = audioState.ctx.currentTime;
  scheduleTone(midiToFreq(79), now, 0.05, { gain: 0.045, type: 'triangle', filterFreq: 2600 });
  scheduleTone(midiToFreq(84), now + 0.03, 0.04, { gain: 0.03, type: 'sine', filterFreq: 2200 });
}

function playPlacementSound(hero) {
  if (!ensureAudio()) return;
  const now = audioState.ctx.currentTime;
  const midi = hero.type === 'melee' ? 64 : hero.type === 'aoe' ? 69 : hero.type === 'support' ? 67 : 71;
  scheduleTone(midiToFreq(midi), now, 0.12, { gain: 0.06, type: 'triangle', filterFreq: 1800 });
  scheduleTone(midiToFreq(midi + 7), now + 0.05, 0.08, { gain: 0.04, type: 'sine', filterFreq: 2200 });
}

function playUpgradeSound(level) {
  if (!ensureAudio()) return;
  const now = audioState.ctx.currentTime;
  scheduleTone(midiToFreq(72), now, 0.07, { gain: 0.045, type: 'square', filterFreq: 2100 });
  scheduleTone(midiToFreq(79), now + 0.04, 0.08, { gain: 0.05, type: 'triangle', filterFreq: 2400 });
  scheduleTone(midiToFreq(84 + Math.min(level, 3)), now + 0.09, 0.12, { gain: 0.055, type: 'triangle', filterFreq: 2600 });
}

function playSellSound() {
  if (!ensureAudio()) return;
  const now = audioState.ctx.currentTime;
  scheduleTone(midiToFreq(67), now, 0.08, { gain: 0.04, type: 'sine', filterFreq: 1200 });
  scheduleNoise(now, 0.04, { filterFreq: 700, gain: 0.02 });
}

function playWaveStartSound(isBossWave) {
  if (!ensureAudio()) return;
  const now = audioState.ctx.currentTime;
  scheduleTone(midiToFreq(isBossWave ? 48 : 55), now, 0.28, { gain: 0.08, type: 'sawtooth', filterFreq: 1400, release: 0.2 });
  scheduleTone(midiToFreq(isBossWave ? 60 : 67), now + 0.08, 0.22, { gain: 0.06, type: 'triangle', filterFreq: 1800, release: 0.16 });
  scheduleNoise(now, 0.08, { filterFreq: 420, gain: 0.03 });
}

function playLifeLossSound(isBoss) {
  if (!ensureAudio()) return;
  const now = audioState.ctx.currentTime;
  scheduleTone(midiToFreq(isBoss ? 36 : 43), now, 0.18, { gain: 0.08, type: 'sawtooth', slideTo: midiToFreq(isBoss ? 30 : 38), filterFreq: 900, release: 0.18 });
  scheduleNoise(now, 0.12, { filterFreq: 500, gain: 0.028 });
}

function playKillSound(isBoss) {
  if (!ensureAudio()) return;
  const now = audioState.ctx.currentTime;
  if (isBoss) {
    scheduleTone(midiToFreq(60), now, 0.16, { gain: 0.07, type: 'square', filterFreq: 1700 });
    scheduleTone(midiToFreq(67), now + 0.06, 0.2, { gain: 0.08, type: 'triangle', filterFreq: 2400 });
    scheduleNoise(now, 0.12, { filterFreq: 1400, gain: 0.03 });
  } else {
    scheduleTone(midiToFreq(74), now, 0.05, { gain: 0.03, type: 'triangle', filterFreq: 2400 });
  }
}

function playAttackSound(heroType) {
  if (!ensureAudio()) return;
  const now = audioState.ctx.currentTime;
  if (now - audioState.lastAttackTime < 0.045) return;
  audioState.lastAttackTime = now;

  if (heroType === 'melee') {
    scheduleNoise(now, 0.035, { filterType: 'bandpass', filterFreq: 1500, q: 1.2, gain: 0.018 });
    scheduleTone(midiToFreq(57), now, 0.045, { gain: 0.025, type: 'square', filterFreq: 1800 });
  } else if (heroType === 'ranged') {
    scheduleTone(midiToFreq(76), now, 0.03, { gain: 0.018, type: 'triangle', filterFreq: 2600 });
  } else if (heroType === 'aoe') {
    scheduleTone(midiToFreq(69), now, 0.06, { gain: 0.024, type: 'sine', filterFreq: 2000 });
  } else if (heroType === 'support') {
    scheduleTone(midiToFreq(72), now, 0.05, { gain: 0.02, type: 'triangle', filterFreq: 1500 });
  }
}

function playSkillSound(effect) {
  if (!ensureAudio()) return;
  const now = audioState.ctx.currentTime;
  if (effect === 'aoe_burst') {
    scheduleTone(midiToFreq(52), now, 0.18, { gain: 0.08, type: 'sawtooth', slideTo: midiToFreq(64), filterFreq: 1500, release: 0.14 });
    scheduleNoise(now + 0.04, 0.09, { filterFreq: 1000, gain: 0.03 });
  } else if (effect === 'rapid_fire') {
    scheduleTone(midiToFreq(76), now, 0.08, { gain: 0.05, type: 'square', filterFreq: 2200 });
    scheduleTone(midiToFreq(83), now + 0.04, 0.08, { gain: 0.04, type: 'triangle', filterFreq: 2500 });
  } else if (effect === 'lightning') {
    scheduleNoise(now, 0.08, { filterType: 'bandpass', filterFreq: 1800, q: 1.4, gain: 0.03 });
    scheduleTone(midiToFreq(86), now, 0.12, { gain: 0.06, type: 'sawtooth', slideTo: midiToFreq(74), filterFreq: 2600 });
  } else if (effect === 'barrier') {
    scheduleTone(midiToFreq(69), now, 0.22, { gain: 0.06, type: 'sine', filterFreq: 1200, release: 0.2 });
    scheduleTone(midiToFreq(74), now + 0.06, 0.22, { gain: 0.04, type: 'triangle', filterFreq: 1700, release: 0.2 });
  }
}

function playVictorySound() {
  if (!ensureAudio()) return;
  const now = audioState.ctx.currentTime;
  [72, 76, 79, 84].forEach((midi, index) => {
    scheduleTone(midiToFreq(midi), now + index * 0.08, 0.22, { gain: 0.065, type: 'triangle', filterFreq: 2400, release: 0.2 });
  });
}

function playDefeatSound() {
  if (!ensureAudio()) return;
  const now = audioState.ctx.currentTime;
  scheduleTone(midiToFreq(48), now, 0.2, { gain: 0.08, type: 'sawtooth', slideTo: midiToFreq(41), filterFreq: 1000, release: 0.2 });
  scheduleTone(midiToFreq(43), now + 0.12, 0.26, { gain: 0.05, type: 'triangle', slideTo: midiToFreq(36), filterFreq: 900, release: 0.2 });
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

async function preloadArt() {
  images.background = await loadImage(IMAGE_PATHS.background);
  await Promise.all(Object.entries(IMAGE_PATHS.heroes).map(async ([key, path]) => {
    images.heroes[key] = await loadImage(path);
  }));
  await Promise.all(Object.entries(IMAGE_PATHS.leaders).map(async ([key, path]) => {
    images.leaders[key] = await loadImage(path);
  }));
  await Promise.all(Object.entries(IMAGE_PATHS.relics).map(async ([key, path]) => {
    images.relics[key] = await loadImage(path);
  }));
}

// ── Initialize ──
function init() {
  generateEnvironment();
  generateFog();
  buildHeroPanel();
  renderLeaderSelection();
  renderLeaderHud();
  renderLeaderTree();
  renderTreasureForge();
  updateAudioButton();

  // Wire up button event listeners (v4: no more inline onclick)
  // Both click (desktop) and touchend (mobile) for reliability
  const waveBtn = document.getElementById('wave-btn');
  const sellBtn = document.getElementById('sell-btn');
  const speedBtn = document.getElementById('speed-btn');
  const audioBtn = document.getElementById('audio-btn');
  const treasureBtn = document.getElementById('treasure-btn');
  const leaderTreeCloseBtn = document.getElementById('leader-tree-close');
  const treasureForgeCloseBtn = document.getElementById('treasure-forge-close');

  waveBtn.addEventListener('click', () => { if (!isTouchDevice) startNextWave(); });
  sellBtn.addEventListener('click', () => { if (!isTouchDevice) sellSelectedTower(); });
  speedBtn.addEventListener('click', () => { if (!isTouchDevice) toggleSpeed(); });
  audioBtn.addEventListener('click', () => { if (!isTouchDevice) toggleAudio(); });
  treasureBtn.addEventListener('click', () => { if (!isTouchDevice) openTreasureForge(); });
  leaderTreeCloseBtn.addEventListener('click', () => { if (!isTouchDevice) closeLeaderTree(); });
  treasureForgeCloseBtn.addEventListener('click', () => { if (!isTouchDevice) closeTreasureForge(); });

  waveBtn.addEventListener('touchend', (e) => { e.preventDefault(); isTouchDevice = true; startNextWave(); });
  sellBtn.addEventListener('touchend', (e) => { e.preventDefault(); isTouchDevice = true; sellSelectedTower(); });
  speedBtn.addEventListener('touchend', (e) => { e.preventDefault(); isTouchDevice = true; toggleSpeed(); });
  audioBtn.addEventListener('touchend', (e) => { e.preventDefault(); isTouchDevice = true; toggleAudio(); });
  treasureBtn.addEventListener('touchend', (e) => { e.preventDefault(); isTouchDevice = true; openTreasureForge(); });
  leaderTreeCloseBtn.addEventListener('touchend', (e) => { e.preventDefault(); isTouchDevice = true; closeLeaderTree(); });
  treasureForgeCloseBtn.addEventListener('touchend', (e) => { e.preventDefault(); isTouchDevice = true; closeTreasureForge(); });

  // Touch events (mobile) — set flag to suppress click
  canvas.addEventListener('touchstart', onTouchStart, { passive: false });
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });
  canvas.addEventListener('touchend', onTouchEnd, { passive: false });

  // Mouse events (desktop only — skipped if touch detected)
  canvas.addEventListener('click', onCanvasClick);
  canvas.addEventListener('mousemove', onMouseMove);

  requestAnimationFrame(gameLoop);
}

// ── Touch Handling ──
let touchStartPos = null;
function getGamePos(touch) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (touch.clientX - rect.left) * canvasScale.x,
    y: (touch.clientY - rect.top) * canvasScale.y,
  };
}

function onTouchStart(e) {
  e.preventDefault();
  isTouchDevice = true;
  ensureAudio();
  const touch = e.touches[0];
  const pos = getGamePos(touch);
  mouseX = pos.x;
  mouseY = pos.y;
  touchStartPos = { x: touch.clientX, y: touch.clientY };

  // Touch feedback ring (reuse existing or create)
  const ring = document.createElement('div');
  ring.style.cssText = `position:fixed;width:40px;height:40px;border-radius:50%;border:2px solid rgba(255,215,0,0.5);pointer-events:none;z-index:50;transform:translate(-50%,-50%);animation:touchRingFade 0.4s ease-out forwards;left:${touch.clientX}px;top:${touch.clientY}px`;
  document.body.appendChild(ring);
  setTimeout(() => ring.remove(), 400);
}

function onTouchMove(e) {
  e.preventDefault();
  const touch = e.touches[0];
  const pos = getGamePos(touch);
  mouseX = pos.x;
  mouseY = pos.y;
}

function onTouchEnd(e) {
  e.preventDefault();
  if (!touchStartPos) return;
  const touch = e.changedTouches[0];
  const dx = touch.clientX - touchStartPos.x;
  const dy = touch.clientY - touchStartPos.y;
  if (dx * dx + dy * dy < 20 * 20) {
    const pos = getGamePos(touch);
    handleTap(pos.x, pos.y);
  }
  touchStartPos = null;
}

function handleTap(mx, my) {
  if (state.phase === 'gameover' || state.phase === 'victory') return;

  for (let i = 0; i < SLOTS.length; i++) {
    const slot = SLOTS[i];
    const dx = mx - slot.x, dy = my - slot.y;
    if (dx * dx + dy * dy < SLOT_TOUCH_RADIUS * SLOT_TOUCH_RADIUS) {
      if (slot.tower !== null && !state.selectedHeroType) {
        if (state.selectedTowerIdx === slot.tower) {
          tryUpgradeTower(slot.tower);
        } else {
          state.selectedTowerIdx = slot.tower;
          state.selectedHeroType = null;
          document.querySelectorAll('.hero-card').forEach(c => c.classList.remove('selected'));
          const t = state.towers[slot.tower];
          document.getElementById('sell-btn').style.display = 'block';
          document.getElementById('sell-btn').textContent = `🗑 매각 (+${Math.floor(HEROES[t.heroType].cost * 0.6)}💰)`;
        }
      } else if (slot.tower !== null && state.selectedHeroType) {
        addFloatingText(slot.x, slot.y - 30, '이미 배치됨!', '#ff6b6b');
      } else if (state.selectedHeroType) {
        tryPlaceTower(i);
      }
      updateUI();
      return;
    }
  }
  // Tap on empty space → deselect
  state.selectedTowerIdx = null;
  state.selectedHeroType = null;
  document.querySelectorAll('.hero-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('sell-btn').style.display = 'none';
  updateUI();
}

function generateEnvironment() {
  const env = state.environmentObjects;
  const MAX_RETRIES = 200;
  for (let i = 0; i < 25; i++) {
    let x, y, valid, retries = 0;
    do {
      x = 30 + Math.random() * (W - 60);
      y = 30 + Math.random() * (H - 60);
      valid = true;
      for (let p = 0; p < PATH.length - 1; p++) {
        const px = (PATH[p].x + PATH[p + 1].x) / 2;
        const py = (PATH[p].y + PATH[p + 1].y) / 2;
        if (Math.abs(x - px) < 60 && Math.abs(y - py) < 60) valid = false;
      }
      for (const s of SLOTS) {
        if (Math.abs(x - s.x) < 40 && Math.abs(y - s.y) < 40) valid = false;
      }
      retries++;
    } while (!valid && retries < MAX_RETRIES);
    if (valid) {
      env.push({ type: Math.random() < 0.7 ? 'tree' : 'rock', x, y, scale: 2 + Math.random() * 2 });
    }
  }
  env.push({ type: 'house', x: 920, y: 230, scale: 3 });
  env.push({ type: 'house', x: 910, y: 290, scale: 2.5 });
}

function generateFog() {
  for (let i = 0; i < 15; i++) {
    state.fog.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: 40 + Math.random() * 80,
      speed: 5 + Math.random() * 15,
      alpha: 0.02 + Math.random() * 0.04,
    });
  }
}

function buildHeroPanel() {
  const panel = document.getElementById('hero-panel');
  panel.innerHTML = '';
  Object.entries(HEROES).forEach(([key, hero]) => {
    const card = document.createElement('div');
    card.className = 'hero-card';
    card.dataset.hero = key;
    card.style.setProperty('--hero-color', hero.color);
    card.innerHTML = `
      <img class="portrait" src="${hero.portrait}" alt="${hero.name}">
      <div class="name">${hero.name}</div>
      <div class="cost">💰${hero.cost}</div>
    `;
    card.addEventListener('click', () => { if (!isTouchDevice) selectHero(key); });
    card.addEventListener('touchend', (e) => {
      e.preventDefault();
      isTouchDevice = true;
      selectHero(key);
    });
    panel.appendChild(card);
  });
}

// ── Skill Bar (cached — only rebuild when hash changes) ──
function updateSkillBar() {
  // Build a hash of current state to avoid DOM thrashing
  let hash = '';
  state.towers.forEach((tower, i) => {
    if (tower.removed) return;
    const hero = HEROES[tower.heroType];
    if (!hero.skill) return;
    const cd = state.skillCooldowns[i] || 0;
    hash += `${i}:${tower.heroType}:${Math.ceil(cd)}:${cd <= 0 ? 'r' : 'c'},`;
  });

  if (hash === lastSkillBarHash) return;
  lastSkillBarHash = hash;

  const bar = document.getElementById('skill-bar');
  bar.innerHTML = '';
  state.towers.forEach((tower, i) => {
    if (tower.removed) return;
    const hero = HEROES[tower.heroType];
    if (!hero.skill) return;
    const cd = state.skillCooldowns[i] || 0;
    const btn = document.createElement('div');
    btn.className = 'skill-btn' + (cd <= 0 ? ' ready' : '');
    btn.title = `${hero.name}: ${hero.skill.name}`;
    btn.innerHTML = hero.skill.icon;
    if (cd > 0) {
      btn.innerHTML += `<div class="cd-overlay">${Math.ceil(cd)}</div>`;
    }
    btn.addEventListener('click', () => { if (!isTouchDevice) activateSkill(i); });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); isTouchDevice = true; activateSkill(i); });
    bar.appendChild(btn);
  });
}

function renderLeaderSelection() {
  const grid = document.getElementById('leader-select-grid');
  const screen = document.getElementById('leader-select-screen');
  if (!grid || !screen) return;

  grid.innerHTML = '';
  Object.entries(LEADERS).forEach(([key, leader]) => {
    const card = document.createElement('div');
    card.className = 'leader-card';
    card.style.setProperty('--leader-color', leader.color);
    card.style.borderColor = `${leader.color}44`;
    card.innerHTML = `
      <div class="art">
        <img src="${leader.portrait}" alt="${leader.name}">
        <div class="badge">${leader.icon}</div>
      </div>
      <div class="head">
        <div>
          <div class="role">${leader.title}</div>
          <div class="title">${leader.name}</div>
        </div>
        <div class="icon">${leader.icon}</div>
      </div>
      <div class="desc">${leader.desc}</div>
      <div class="trait-copy"><strong>고유 특성</strong><br>${leader.trait}</div>
      <div class="tree-preview">
        ${leader.tree.map((node) => `<div><strong>Lv.${node.levelReq}</strong> ${node.name}<br>${node.desc}</div>`).join('')}
      </div>
      <button type="button" data-leader-select="${key}">${leader.name} 선택</button>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll('[data-leader-select]').forEach((button) => {
    button.addEventListener('click', () => selectLeader(button.dataset.leaderSelect));
    button.addEventListener('touchend', (e) => {
      e.preventDefault();
      isTouchDevice = true;
      selectLeader(button.dataset.leaderSelect);
    });
  });

  screen.style.display = state.leader.key ? 'none' : 'flex';
}

function renderLeaderHud() {
  const hud = document.getElementById('leader-hud');
  if (!hud) return;

  const leader = getLeaderDef();
  if (!leader) {
    hud.innerHTML = `
      <div class="leader-shell empty">
        <div class="portrait-frame placeholder">🧭</div>
        <div class="leader-copy">
          <div class="eyebrow">Leader</div>
          <div class="name">지도자를 선택하세요</div>
          <div class="trait">지금 선택한 지도자의 특성과 재능이 이번 판 전체 운영 방향을 결정합니다.</div>
        </div>
      </div>
      <button class="tree-btn wide" id="leader-open-select">지도자 선택</button>
    `;
    const openButton = document.getElementById('leader-open-select');
    if (openButton) {
      openButton.addEventListener('click', () => {
        document.getElementById('leader-select-screen').style.display = 'flex';
      });
      openButton.addEventListener('touchend', (e) => {
        e.preventDefault();
        isTouchDevice = true;
        document.getElementById('leader-select-screen').style.display = 'flex';
      });
    }
    return;
  }

  const progress = getLeaderProgress();
  const unlockedNames = leader.tree
    .filter((node) => leaderHasNode(node.id))
    .map((node) => node.name)
    .join(' · ');

  hud.innerHTML = `
    <div class="leader-shell">
      <div class="portrait-frame">
        <img src="${leader.portrait}" alt="${leader.name}">
        <div class="portrait-badge">${leader.icon}</div>
      </div>
      <div class="leader-copy">
        <div class="row">
          <div>
            <div class="eyebrow">${leader.title}</div>
            <div class="name">${leader.name}</div>
          </div>
          <button class="tree-btn ${state.leader.unspentPoints > 0 ? 'has-points' : ''}" id="leader-tree-btn">재능 ${state.leader.unspentPoints > 0 ? `+${state.leader.unspentPoints}` : ''}</button>
        </div>
        <div class="trait">${leader.trait}</div>
      </div>
    </div>
    <div class="leader-level-line">
      <span>Lv.${state.leader.level}</span>
      <span>${state.leader.level >= getLeaderLevelCap() ? '최대 레벨' : `${Math.floor(progress.current)}/${progress.target} XP`}</span>
    </div>
    <div class="leader-meter"><span style="width:${progress.ratio * 100}%"></span></div>
    <div class="leader-nodes">${unlockedNames ? `해금 재능: ${unlockedNames}` : '아직 해금한 재능이 없습니다.'}</div>
  `;

  const treeBtn = document.getElementById('leader-tree-btn');
  if (treeBtn) {
    treeBtn.addEventListener('click', openLeaderTree);
    treeBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      isTouchDevice = true;
      openLeaderTree();
    });
  }
}

function openLeaderTree() {
  if (!state.leader.key) return;
  renderLeaderTree();
  const screen = document.getElementById('leader-tree-screen');
  if (screen) screen.style.display = 'flex';
}

function closeLeaderTree() {
  const screen = document.getElementById('leader-tree-screen');
  if (screen) screen.style.display = 'none';
}

function renderLeaderTree() {
  const leader = getLeaderDef();
  const summary = document.getElementById('leader-tree-summary');
  const grid = document.getElementById('leader-tree-grid');
  if (!leader || !summary || !grid) return;

  summary.textContent = `${leader.icon} ${leader.name} · Lv.${state.leader.level} · 보유 포인트 ${state.leader.unspentPoints}. 레벨 요구치를 만족하면 재능을 하나씩 해금할 수 있습니다.`;
  grid.innerHTML = '';

  leader.tree.forEach((node) => {
    const unlocked = leaderHasNode(node.id);
    const available = !unlocked && state.leader.unspentPoints > 0 && state.leader.level >= node.levelReq;
    const card = document.createElement('div');
    card.className = 'leader-node';
    card.style.borderColor = unlocked ? `${leader.color}55` : 'rgba(255,255,255,0.08)';
    card.innerHTML = `
      <div class="branch">${node.branch}</div>
      <div class="title">${node.name}</div>
      <div class="meta">요구 레벨 Lv.${node.levelReq}</div>
      <div class="desc">${node.desc}</div>
      <button type="button" class="${unlocked ? 'unlocked' : available ? 'available' : 'locked'}" data-leader-node="${node.id}">
        ${unlocked ? '해금 완료' : available ? '포인트 사용' : state.leader.level < node.levelReq ? `Lv.${node.levelReq} 필요` : '포인트 부족'}
      </button>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll('[data-leader-node]').forEach((button) => {
    button.addEventListener('click', () => unlockLeaderNode(button.dataset.leaderNode));
    button.addEventListener('touchend', (e) => {
      e.preventDefault();
      isTouchDevice = true;
      unlockLeaderNode(button.dataset.leaderNode);
    });
  });
}

function unlockLeaderNode(nodeId) {
  const leader = getLeaderDef();
  if (!leader || !nodeId) return;
  const node = leader.tree.find((entry) => entry.id === nodeId);
  if (!node) return;
  if (leaderHasNode(node.id)) return;
  if (state.leader.unspentPoints <= 0 || state.leader.level < node.levelReq) return;

  state.leader.unlockedNodes.push(node.id);
  state.leader.unspentPoints--;
  addFloatingText(W / 2, 72, `${leader.icon} ${node.name} 해금`, leader.color, 16);
  playUiSound();
  renderLeaderHud();
  renderLeaderTree();
  updateUI();
}

function selectLeader(key) {
  const leader = LEADERS[key];
  if (!leader || state.leader.key) return;

  state.leader.key = key;
  document.getElementById('leader-select-screen').style.display = 'none';
  addFloatingText(W / 2, H / 2 - 24, `${leader.icon} ${leader.name} 참전`, leader.color, 20);
  addFloatingText(W / 2, H / 2 + 8, leader.trait, '#dbe9ff', 12);
  playUiSound();
  renderLeaderHud();
  renderLeaderTree();
  updateUI();
}

function grantLeaderXp(amount, anchorX, anchorY) {
  if (!state.leader.key || amount <= 0) return;
  const leader = getLeaderDef();
  state.leader.xp += amount;
  if (anchorX !== undefined && anchorY !== undefined) {
    addFloatingText(anchorX, anchorY, `+${amount} XP`, '#7fc8ff', 11);
  }

  while (state.leader.level < getLeaderLevelCap() && state.leader.xp >= getLeaderXpThreshold(state.leader.level + 1)) {
    state.leader.level++;
    state.leader.unspentPoints++;
    state.leader.levelsGained++;
    addFloatingText(W / 2, 96, `${leader.icon} 지도자 Lv.${state.leader.level}!`, leader.color, 18);
    playUpgradeSound(state.leader.level);
  }

  renderLeaderHud();
  renderLeaderTree();
}

function getRelicSuccessRate(relicKey) {
  const relicDef = TREASURE_RELICS[relicKey];
  const relicState = getRelicState(relicKey);
  if (!relicDef || !relicState) return 0;
  if (relicState.level >= relicDef.maxLevel) return 0;
  const base = relicDef.successRates[Math.min(relicState.level, relicDef.successRates.length - 1)];
  return Math.min(0.98, base + relicState.pity * 0.07);
}

function announceTreasure(text, tone = 'neutral') {
  const banner = document.getElementById('treasure-banner');
  if (!banner) return;
  banner.textContent = text;
  banner.dataset.tone = tone;
  banner.classList.add('show');
  clearTimeout(announceTreasure.timeoutId);
  announceTreasure.timeoutId = setTimeout(() => {
    banner.classList.remove('show');
  }, 1600);
}

function formatTreasureBonusLabel(bonusKey, totalValue) {
  switch (bonusKey) {
    case 'allDamagePct': return `전체 피해 +${Math.round(totalValue * 100)}%`;
    case 'skillCooldownPct': return `스킬 쿨다운 -${Math.round(totalValue * 100)}%`;
    case 'skillDamagePct': return `스킬 피해 +${Math.round(totalValue * 100)}%`;
    case 'allRangeFlat': return `전체 사거리 +${Math.round(totalValue)}`;
    case 'rangedAttackSpeedPct': return `궁수 공속 +${Math.round(totalValue * 100)}%`;
    case 'waveGoldBonusPct': return `웨이브 보상 +${Math.round(totalValue * 100)}%`;
    case 'upgradeCostPct': return `강화 비용 -${Math.round(totalValue * 100)}%`;
    default: return `${bonusKey} ${totalValue}`;
  }
}

function formatRelicBonusSummary(relicKey, level) {
  const relicDef = TREASURE_RELICS[relicKey];
  if (!relicDef || level <= 0) return '없음';
  return Object.entries(relicDef.bonuses)
    .map(([bonusKey, value]) => formatTreasureBonusLabel(bonusKey, value * level))
    .join(' / ');
}

function flashForgeCard(relicKey, success) {
  const card = document.querySelector(`[data-relic-card="${relicKey}"]`);
  if (!card) return;
  card.classList.remove('impact-success', 'impact-fail');
  void card.offsetWidth;
  card.classList.add(success ? 'impact-success' : 'impact-fail');
}

function showForgeImpact(relicKey, success) {
  const overlay = document.getElementById('forge-impact');
  const art = document.getElementById('forge-impact-art');
  const eyebrow = document.getElementById('forge-impact-eyebrow');
  const title = document.getElementById('forge-impact-title');
  const subtitle = document.getElementById('forge-impact-subtitle');
  const relicDef = TREASURE_RELICS[relicKey];
  const relicState = getRelicState(relicKey);
  if (!overlay || !art || !eyebrow || !title || !subtitle || !relicDef || !relicState) return;

  overlay.dataset.result = success ? 'success' : 'fail';
  overlay.style.setProperty('--impact-color', relicDef.color || '#f7d38e');
  art.src = relicDef.art;
  art.alt = relicDef.name;
  eyebrow.textContent = success ? 'FORGE SUCCESS' : 'FORGE INSTABILITY';
  title.textContent = success ? `${relicDef.name} Lv.${relicState.level}` : `${relicDef.name} 반응 불안정`;
  subtitle.textContent = success
    ? `강화 완료 · ${formatRelicBonusSummary(relicKey, relicState.level)}`
    : `실패 누적 ${relicState.pity} · 다음 성공 확률 ${Math.round(getRelicSuccessRate(relicKey) * 100)}%`;

  overlay.classList.remove('show');
  void overlay.offsetWidth;
  overlay.classList.add('show');
  clearTimeout(showForgeImpact.timeoutId);
  showForgeImpact.timeoutId = setTimeout(() => {
    overlay.classList.remove('show');
  }, success ? 1450 : 1250);
}

function grantTreasure(amount, reason) {
  if (amount <= 0) return;
  state.treasury.treasures += amount;
  announceTreasure(`🗝 보물 +${amount} · ${reason}`, 'reward');
  renderTreasureForge();
  updateUI();
}

function renderTreasureForge() {
  const summary = document.getElementById('treasure-forge-summary');
  const chipRow = document.getElementById('forge-summary');
  const grid = document.getElementById('treasure-forge-grid');
  if (!summary || !chipRow || !grid) return;

  const forgeHash = JSON.stringify({
    phase: state.phase,
    treasures: state.treasury.treasures,
    attempts: state.treasury.upgradesAttempted,
    success: state.treasury.upgradesSucceeded,
    relics: state.treasury.relics,
  });
  if (forgeHash === lastTreasureForgeHash) return;
  lastTreasureForgeHash = forgeHash;

  const treasureCount = state.treasury.treasures;
  summary.textContent = `보유 보물 ${treasureCount}개. 전투 사이 획득한 보물로 유물을 확률 강화해 다음 웨이브를 준비하세요.`;
  chipRow.innerHTML = `
    <div class="forge-chip">보유 보물: ${treasureCount}</div>
    <div class="forge-chip">강화 성공: ${state.treasury.upgradesSucceeded}</div>
    <div class="forge-chip">강화 시도: ${state.treasury.upgradesAttempted}</div>
  `;

  grid.innerHTML = '';
  Object.entries(TREASURE_RELICS).forEach(([relicKey, relicDef]) => {
    const relicState = getRelicState(relicKey);
    const rate = getRelicSuccessRate(relicKey);
    const bonusCopy = formatRelicBonusSummary(relicKey, relicState.level);
    const nextBonusCopy = formatRelicBonusSummary(relicKey, Math.min(relicState.level + 1, relicDef.maxLevel));
    const buttonDisabled = state.phase === 'combat' || treasureCount <= 0 || relicState.level >= relicDef.maxLevel;
    const card = document.createElement('div');
    card.className = 'treasure-card';
    card.dataset.relicCard = relicKey;
    card.style.setProperty('--relic-color', relicDef.color || '#f7d38e');
    card.innerHTML = `
      <div class="art-panel">
        <img class="art" src="${relicDef.art}" alt="${relicDef.name}">
        <div class="sigil">${relicDef.icon}</div>
        <div class="tier-chip">Lv.${relicState.level}</div>
      </div>
      <div class="head">
        <div class="name">${relicDef.name}</div>
        <div class="icon">${relicDef.icon}</div>
      </div>
      <div class="meta">현재 Lv.${relicState.level} / 최대 Lv.${relicDef.maxLevel}</div>
      <div class="desc">${relicDef.desc}</div>
      <div class="chance"><strong>이번 성공 확률</strong> ${relicState.level >= relicDef.maxLevel ? '완료' : `${Math.round(rate * 100)}%`} · 실패 누적 ${relicState.pity}</div>
      <div class="meta"><strong>현재 효과</strong> ${bonusCopy || '없음'}</div>
      <div class="meta"><strong>다음 단계</strong> ${relicState.level >= relicDef.maxLevel ? '최대 강화 완료' : nextBonusCopy}</div>
      <div class="upgrade-meter"><span style="width:${(relicState.level / relicDef.maxLevel) * 100}%"></span></div>
      <button type="button" data-relic-upgrade="${relicKey}" ${buttonDisabled ? 'disabled' : ''}>
        ${state.phase === 'combat' ? '전투 중 잠금' : relicState.level >= relicDef.maxLevel ? '최대 강화' : '보물 1개로 강화 시도'}
      </button>
    `;
    grid.appendChild(card);
  });

  grid.querySelectorAll('[data-relic-upgrade]').forEach((button) => {
    button.addEventListener('click', () => attemptTreasureUpgrade(button.dataset.relicUpgrade));
    button.addEventListener('touchend', (e) => {
      e.preventDefault();
      isTouchDevice = true;
      attemptTreasureUpgrade(button.dataset.relicUpgrade);
    });
  });
}

function openTreasureForge() {
  if (state.phase === 'combat') {
    announceTreasure('전투 중에는 공방을 열 수 없습니다', 'warning');
    return;
  }
  renderTreasureForge();
  document.getElementById('treasure-forge-screen').style.display = 'flex';
}

function closeTreasureForge() {
  document.getElementById('treasure-forge-screen').style.display = 'none';
}

function attemptTreasureUpgrade(relicKey) {
  const relicDef = TREASURE_RELICS[relicKey];
  const relicState = getRelicState(relicKey);
  if (!relicDef || !relicState) return;
  if (state.phase === 'combat' || state.treasury.treasures <= 0 || relicState.level >= relicDef.maxLevel) return;

  state.treasury.treasures--;
  state.treasury.upgradesAttempted++;
  const success = Math.random() < getRelicSuccessRate(relicKey);

  if (success) {
    relicState.level++;
    relicState.pity = 0;
    state.treasury.upgradesSucceeded++;
    announceTreasure(`${relicDef.icon} ${relicDef.name} 강화 성공! Lv.${relicState.level}`, 'success');
    addFloatingText(W / 2, H / 2 - 14, `${relicDef.icon} ${relicDef.name} 강화 성공`, '#f7d38e', 18);
    playUpgradeSound(relicState.level + 1);
  } else {
    relicState.pity++;
    announceTreasure(`${relicDef.icon} ${relicDef.name} 강화 실패 · 다음 확률 상승`, 'fail');
    addFloatingText(W / 2, H / 2 - 14, `${relicDef.icon} 강화 실패`, '#f2b0ff', 16);
    playUiSound();
  }

  flashForgeCard(relicKey, success);
  showForgeImpact(relicKey, success);
  renderTreasureForge();
  updateUI();
}

function getPhaseLabel() {
  switch (state.phase) {
    case 'placement': return '배치 단계';
    case 'combat': return `전투 중 · Wave ${state.wave}`;
    case 'between': return `웨이브 ${state.wave} 클리어`;
    case 'victory': return '스테이지 클리어';
    case 'gameover': return '패배';
    default: return '프로토타입 진행 중';
  }
}

function getSelectionSummary() {
  const leader = getLeaderDef();

  if (state.selectedTowerIdx !== null) {
    const tower = state.towers[state.selectedTowerIdx];
    if (tower && !tower.removed) {
      const hero = HEROES[tower.heroType];
      const upgradeCost = tower.level >= 3 ? 'MAX' : `${Math.max(20, Math.floor(25 * tower.level * (1 - getProgressionBonus('upgradeCostPct'))))}💰`;
      const synergyText = checkSynergy(tower) ? `시너지 활성 · ${hero.synergyBonus}` : '시너지 비활성';
      const effectiveRange = Math.floor(getTowerEffectiveRange(tower, checkSynergy(tower)));
      return {
        title: `${hero.icon} ${hero.name} Lv.${tower.level}`,
        subline: `${hero.desc}. 사거리 ${effectiveRange} / 공격 ${tower.damage} / 강화 비용 ${upgradeCost}`,
        meta: `${synergyText} · 스킬 ${hero.skill.name} · 쿨다운 ${(hero.skill.cooldown * (1 - getProgressionBonus('skillCooldownPct'))).toFixed(1)}초`,
        color: hero.color,
      };
    }
  }

  if (state.selectedHeroType) {
    const hero = HEROES[state.selectedHeroType];
    return {
      title: `${hero.icon} ${hero.name} 배치 대기`,
      subline: `${hero.desc}. 비용 ${hero.cost}💰 · 사거리 ${hero.range} · 공격 ${hero.damage}`,
      meta: `스킬 ${hero.skill.name} · ${hero.skill.desc} · 시너지 ${HEROES[hero.synergy].name}와 조합 시 ${hero.synergyBonus}`,
      color: hero.color,
    };
  }

  if (state.phase === 'placement') {
    if (!leader) {
      return {
        title: '지도자를 먼저 선택하세요',
        subline: '각 지도자는 고유 특성과 성장 재능을 가집니다. 전투 시작 전 한 명을 고르면 이번 판 운영 방향이 결정됩니다.',
        meta: '추천 테스트 포인트: 공격형, 경제형, 스킬형 지도자의 체감 차이',
        color: '#8fc7ff',
      };
    }
    return {
      title: `${leader.icon} ${leader.name}의 지휘 아래 첫 배치를 시작하세요`,
      subline: '오른쪽 패널에서 영웅을 고른 뒤 + 슬롯을 탭하면 전장에 배치됩니다.',
      meta: `지도자 특성: ${leader.trait}`,
      color: leader.color,
    };
  }

  if (state.phase === 'combat') {
    return {
      title: '전황을 보며 스킬 타이밍을 확인해 주세요',
      subline: '왼쪽 스킬 바에서 준비된 스킬을 눌러 웨이브 압박을 버틸 수 있는지 확인해 보세요.',
      meta: `남은 적 ${state.enemies.filter(e => e.alive).length} · 지도자 Lv.${state.leader.level} · 배속 x${state.speedMult}`,
      color: leader ? leader.color : '#ffcf6b',
    };
  }

  if (state.phase === 'between') {
    return {
      title: '다음 웨이브 전 정비 시간',
      subline: '타워를 강화하고 보물 공방에서 유물을 도전 강화해 다음 웨이브 난이도 곡선에 대비하세요.',
      meta: `지도자 XP ${Math.floor(state.leader.xp)} · 보유 포인트 ${state.leader.unspentPoints} · 보물 ${state.treasury.treasures}`,
      color: leader ? leader.color : '#8bd0ff',
    };
  }

  if (state.phase === 'victory') {
    return {
      title: '승리한 빌드입니다',
      subline: '어떤 조합과 어떤 스킬 타이밍이 가장 강했는지 메모해 두면 다음 패스 우선순위를 정하기 좋습니다.',
      meta: `최종 기록: 지도자 ${leader ? leader.name : '-'} Lv.${state.leader.level} · 총 데미지 ${state.totalDamageDealt} · 남은 생명 ${state.lives}`,
      color: leader ? leader.color : '#ffd700',
    };
  }

  return {
    title: '압박 구간의 난이도를 확인해 주세요',
    subline: '패배한 웨이브에서 부족했던 것이 배치, 업그레이드, 스킬 타이밍 중 무엇인지 확인해 보세요.',
    meta: `기록: 지도자 ${leader ? leader.name : '-'} · Wave ${state.wave} · 총 데미지 ${state.totalDamageDealt}`,
    color: leader ? leader.color : '#ff8080',
  };
}

function updateBriefingPanel() {
  const chip = document.getElementById('phase-chip');
  const title = document.getElementById('selection-title');
  const subline = document.getElementById('selection-subline');
  const meta = document.getElementById('selection-meta');
  if (!chip || !title || !subline || !meta) return;

  const summary = getSelectionSummary();
  chip.textContent = getPhaseLabel();
  title.textContent = summary.title;
  subline.textContent = summary.subline;
  meta.textContent = summary.meta;
  document.documentElement.style.setProperty('--accent-color', summary.color);
}

function refreshControls() {
  const placedCount = state.towers.filter(t => !t.removed).length;
  const waveBtn = document.getElementById('wave-btn');
  const speedBtn = document.getElementById('speed-btn');
  if (!waveBtn || !speedBtn) return;

  const hasLeader = Boolean(state.leader.key);
  const canStartWave = hasLeader && state.phase !== 'combat' && state.wave < state.totalWaves && placedCount > 0;
  waveBtn.disabled = !canStartWave;
  if (state.wave >= state.totalWaves) {
    waveBtn.textContent = '완료';
  } else if (!hasLeader) {
    waveBtn.textContent = '지도자 선택';
  } else if (state.phase === 'combat') {
    waveBtn.textContent = `Wave ${state.wave} 진행 중`;
  } else if (state.phase === 'between') {
    waveBtn.textContent = canStartWave ? `▶ W${state.wave + 1} 시작` : '정비 중';
  } else if (state.phase === 'placement') {
    waveBtn.textContent = placedCount > 0 ? `▶ W${state.wave + 1} 시작` : '영웅 배치 필요';
  }

  speedBtn.disabled = state.phase !== 'combat';
}

// ── Speed Toggle ──
function toggleSpeed() {
  ensureAudio();
  state.speedMult = state.speedMult === 1 ? 2 : state.speedMult === 2 ? 3 : 1;
  document.getElementById('speed-btn').textContent = `⏩ x${state.speedMult}`;
  playUiSound();
  updateUI();
}

// ── Hero Selection ──
function selectHero(key) {
  ensureAudio();
  state.selectedTowerIdx = null;
  document.getElementById('sell-btn').style.display = 'none';
  if (state.selectedHeroType === key) {
    state.selectedHeroType = null;
  } else {
    state.selectedHeroType = key;
  }
  document.querySelectorAll('.hero-card').forEach(c => {
    c.classList.toggle('selected', c.dataset.hero === state.selectedHeroType);
  });
  playUiSound();
  updateUI();
}

// ── Mouse Move ──
let mouseX = 0, mouseY = 0;
function onMouseMove(e) {
  if (isTouchDevice) return;
  const rect = canvas.getBoundingClientRect();
  mouseX = (e.clientX - rect.left) * canvasScale.x;
  mouseY = (e.clientY - rect.top) * canvasScale.y;
}

// ── Canvas Click (desktop only — skipped on touch devices) ──
function onCanvasClick(e) {
  if (isTouchDevice) return;
  ensureAudio();
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * canvasScale.x;
  const my = (e.clientY - rect.top) * canvasScale.y;
  handleTap(mx, my);
}

function tryPlaceTower(slotIndex) {
  const hero = HEROES[state.selectedHeroType];
  if (state.gold < hero.cost) {
    addFloatingText(SLOTS[slotIndex].x, SLOTS[slotIndex].y - 30, '금화 부족!', '#ff4444');
    shakeScreen(3);
    return;
  }
  state.gold -= hero.cost;
  const rangeBonus = SLOTS[slotIndex].terrain === 'high' ? 20 : 0;
  const tower = {
    heroType: state.selectedHeroType,
    x: SLOTS[slotIndex].x,
    y: SLOTS[slotIndex].y,
    level: 1,
    attackTimer: 0,
    target: null,
    damage: hero.damage,
    range: hero.range + rangeBonus,
    attackSpeed: hero.attackSpeed,
    skillActive: false,
    skillTimer: 0,
    skillUses: 0,
    damageDealt: 0,
    skillDamageDealt: 0,
    kills: 0,
    animTimer: 0,
    highGround: SLOTS[slotIndex].terrain === 'high',
  };
  state.towers.push(tower);
  SLOTS[slotIndex].tower = state.towers.length - 1;
  state.skillCooldowns[state.towers.length - 1] = 0;
  addFloatingText(tower.x, tower.y - 40, `${hero.name} 배치!`, hero.color);
  spawnPlaceEffect(tower.x, tower.y, hero.color);
  playPlacementSound(hero);
  state.selectedHeroType = null;
  document.querySelectorAll('.hero-card').forEach(c => c.classList.remove('selected'));
  updateSkillBar();
  updateUI();
}

function tryUpgradeTower(towerIdx) {
  const tower = state.towers[towerIdx];
  const upgradeCost = Math.max(20, Math.floor(25 * tower.level * (1 - getProgressionBonus('upgradeCostPct'))));
  if (tower.level >= 3) {
    addFloatingText(tower.x, tower.y - 30, '최대 레벨!', '#ffd700');
    return;
  }
  if (state.gold < upgradeCost) {
    addFloatingText(tower.x, tower.y - 30, `금화 부족! (${upgradeCost}💰)`, '#ff4444');
    shakeScreen(3);
    return;
  }
  state.gold -= upgradeCost;
  tower.level++;
  tower.damage = Math.floor(HEROES[tower.heroType].damage * (1 + (tower.level - 1) * 0.6));
  tower.range += 12;
  tower.attackSpeed *= 1.15;
  addFloatingText(tower.x, tower.y - 40, `★ Lv${tower.level} 강화! ★`, '#ffd700');
  spawnPlaceEffect(tower.x, tower.y, '#ffd700');
  shakeScreen(4);
  playUpgradeSound(tower.level);
  updateUI();
}

function sellSelectedTower() {
  if (state.selectedTowerIdx === null) return;
  const tower = state.towers[state.selectedTowerIdx];
  const hero = HEROES[tower.heroType];
  const refund = Math.floor(hero.cost * 0.6);
  state.gold += refund;
  addFloatingText(tower.x, tower.y - 30, `+${refund}💰 매각`, '#ffd700');
  spawnPlaceEffect(tower.x, tower.y, '#ff6b6b');
  for (const s of SLOTS) {
    if (s.tower === state.selectedTowerIdx) { s.tower = null; break; }
  }
  tower.removed = true;
  state.selectedTowerIdx = null;
  document.getElementById('sell-btn').style.display = 'none';
  playSellSound();
  updateSkillBar();
  updateUI();
}

// ── Skill Activation ──
function activateSkill(towerIdx) {
  if (state.skillCooldowns[towerIdx] > 0) return;
  if (state.phase !== 'combat') return;
  const tower = state.towers[towerIdx];
  if (tower.removed) return;
  const hero = HEROES[tower.heroType];
  const skill = hero.skill;
  const hasSynergy = checkSynergy(tower);
  tower.skillUses++;
  playSkillSound(skill.effect);
  grantLeaderXp(2, tower.x, tower.y - 28);

  state.skillCooldowns[towerIdx] = skill.cooldown * (hasSynergy ? 0.8 : 1) * (1 - getProgressionBonus('skillCooldownPct'));

  switch (skill.effect) {
    case 'aoe_burst': {
      const mult = hasSynergy ? 4 : 3;
      state.enemies.forEach(e => {
        if (!e.alive) return;
        const dx = e.x - tower.x, dy = e.y - tower.y;
        if (dx * dx + dy * dy < (getTowerEffectiveRange(tower, hasSynergy) + 50) ** 2) {
          damageEnemy(e, getTowerDamageValue(tower, hasSynergy, { viaSkill: true, againstBoss: e.type === 'boss' }) * mult, { towerIdx, viaSkill: true });
        }
      });
      spawnExplosion(tower.x, tower.y, '#e74c3c', 30);
      addFloatingText(tower.x, tower.y - 50, '🌪️ 질풍참!', '#ff6b6b');
      shakeScreen(8);
      break;
    }
    case 'rapid_fire': {
      tower.skillActive = true;
      tower.skillTimer = 4;
      addFloatingText(tower.x, tower.y - 50, '🎯 만궁술!', '#2ecc71');
      spawnAura(tower.x, tower.y, '#2ecc71');
      break;
    }
    case 'lightning': {
      const mult = hasSynergy ? 5 : 4;
      const maxTargets = hasSynergy ? 7 : 5;
      const chainRadius = 90;
      const primaryTarget = findFurthestEnemyInRange(tower.x, tower.y, getTowerEffectiveRange(tower, hasSynergy) + 80);
      if (!primaryTarget) break;

      const targets = [primaryTarget];
      const visited = new Set([primaryTarget]);
      while (targets.length < maxTargets) {
        const from = targets[targets.length - 1];
        let nextTarget = null;
        let nearestDistSq = Infinity;

        state.enemies.forEach(enemy => {
          if (!enemy.alive || visited.has(enemy)) return;
          const dx = enemy.x - from.x;
          const dy = enemy.y - from.y;
          const distSq = dx * dx + dy * dy;
          if (distSq > chainRadius * chainRadius) return;
          if (distSq < nearestDistSq) {
            nearestDistSq = distSq;
            nextTarget = enemy;
          }
        });

        if (!nextTarget) break;
        targets.push(nextTarget);
        visited.add(nextTarget);
      }

      let prev = { x: tower.x, y: tower.y };
      targets.forEach(enemy => {
        damageEnemy(enemy, getTowerDamageValue(tower, hasSynergy, { viaSkill: true, againstBoss: enemy.type === 'boss' }) * mult, { towerIdx, viaSkill: true });
        spawnLightning(prev.x, prev.y, enemy.x, enemy.y);
        prev = enemy;
      });
      addFloatingText(tower.x, tower.y - 50, '⚡ 뇌전술!', '#bb77ff');
      shakeScreen(6);
      break;
    }
    case 'barrier': {
      const slowAmount = hasSynergy ? 0.25 : 0.4;
      tower.skillActive = true;
      tower.skillTimer = 5;
      state.enemies.forEach(e => { if (e.alive) e.slowTimer = Math.max(e.slowTimer, 5); e.slowAmount = slowAmount; });
      addFloatingText(tower.x, tower.y - 50, '🛡️ 결계!', '#f39c12');
      spawnBarrier(tower.x, tower.y);
      shakeScreen(5);
      break;
    }
  }
}

// ── Wave System ──
function startNextWave() {
  if (state.phase === 'combat') return;
  if (state.wave >= state.totalWaves) return;
  if (!state.leader.key) {
    document.getElementById('leader-select-screen').style.display = 'flex';
    return;
  }
  closeTreasureForge();

  state.wave++;
  state.phase = 'combat';
  document.getElementById('wave-btn').disabled = true;

  const waveDef = WAVES[state.wave - 1];
  state.spawnQueue = [];
  waveDef.enemies.forEach(group => {
    for (let i = 0; i < group.count; i++) {
      state.spawnQueue.push({
        type: group.type,
        time: (group.delay || 0) + i * group.interval,
      });
    }
  });
  state.waveTimer = 0;

  announceWave(waveDef.name);
  playWaveStartSound(state.wave === state.totalWaves);
  updateUI();
}

function announceWave(name) {
  const el = document.getElementById('wave-announce');
  el.textContent = `Wave ${state.wave}: ${name}`;
  el.style.opacity = '1';
  setTimeout(() => { el.style.opacity = '0'; }, 2000);
}

function spawnEnemy(type) {
  const def = ENEMY_TYPES[type];
  const start = PATH[0];
  const waveScale = 1 + (state.wave - 1) * 0.18;
  const speedScale = 1 + Math.max(0, state.wave - 3) * 0.03;
  const enemy = {
    type,
    x: start.x,
    y: start.y,
    hp: Math.floor(def.hp * waveScale),
    maxHp: Math.floor(def.hp * waveScale),
    speed: def.speed * speedScale,
    reward: def.reward,
    color: def.color,
    size: def.size,
    sprite: def.sprite,
    pathIndex: 1,
    alive: true,
    slowTimer: 0,
    slowAmount: 0.4,
    hitFlash: 0,
    flying: def.flying || false,
    phase: def.phase || false,
    armor: def.armor || 0,
    healer: def.healer || false,
    healTimer: 0,
    animOffset: Math.random() * Math.PI * 2,
    trail: [],
    elite: false,
    treasureDrop: 0,
  };

  if (type !== 'boss' && state.wave >= 4) {
    const eliteChance = Math.min(0.15 + state.wave * 0.035, 0.42);
    if (Math.random() < eliteChance) {
      enemy.elite = true;
      enemy.hp = Math.floor(enemy.hp * 1.4);
      enemy.maxHp = enemy.hp;
      enemy.speed *= 1.12;
      enemy.reward = Math.floor(enemy.reward * 1.55);
      enemy.armor += 2;
      enemy.size += 2;
      enemy.treasureDrop = Math.random() < 0.35 ? 1 : 0;
    }
  }

  state.enemies.push(enemy);
}

// ── Combat Logic ──
function updateEnemies(dt) {
  state.enemies.forEach(enemy => {
    if (!enemy.alive) return;

    if (enemy.healer) {
      enemy.healTimer -= dt;
      if (enemy.healTimer <= 0) {
        enemy.healTimer = 2;
        state.enemies.forEach(other => {
          if (!other.alive || other === enemy) return;
          const dx = other.x - enemy.x, dy = other.y - enemy.y;
          if (dx * dx + dy * dy < 100 * 100 && other.hp < other.maxHp) {
            other.hp = Math.min(other.maxHp, other.hp + Math.floor(other.maxHp * 0.1));
            addFloatingText(other.x, other.y - other.size - 10, '+heal', '#00ff88');
            spawnHealEffect(other.x, other.y);
          }
        });
      }
    }

    const speedMult = enemy.slowTimer > 0 ? (enemy.slowAmount || 0.4) : 1;
    enemy.slowTimer = Math.max(0, enemy.slowTimer - dt);
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);

    const target = PATH[enemy.pathIndex];
    if (!target) {
      enemy.alive = false;
      const dmg = enemy.type === 'boss' ? 5 : 1;
      state.lives -= dmg;
      addFloatingText(enemy.x, enemy.y, `-${dmg} ❤️`, '#ff4444');
      shakeScreen(dmg * 4);
      playLifeLossSound(enemy.type === 'boss');
      if (state.lives <= 0) {
        state.lives = 0;
        state.phase = 'gameover';
        renderResultStats('go-stats', false);
        document.getElementById('game-over-screen').style.display = 'flex';
        playDefeatSound();
      }
      updateUI();
      return;
    }

    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 3) {
      enemy.pathIndex++;
    } else {
      const spd = enemy.speed * speedMult * 60 * dt;
      enemy.x += (dx / dist) * spd;
      enemy.y += (dy / dist) * spd;
    }

    enemy.pathProgress = getEnemyPathProgress(enemy);

    if (enemy.phase || enemy.type === 'boss') {
      enemy.trail.push({ x: enemy.x, y: enemy.y, alpha: 0.5 });
      if (enemy.trail.length > 8) enemy.trail.shift();
      enemy.trail.forEach(t => t.alpha *= 0.92);
    }
  });
}

function updateTowers(dt) {
  state.towers.forEach((tower, idx) => {
    if (tower.removed) return;
    const hero = HEROES[tower.heroType];
    const hasSynergy = checkSynergy(tower);

    tower.animTimer += dt;

    if (tower.skillActive) {
      tower.skillTimer -= dt;
      if (tower.skillTimer <= 0) tower.skillActive = false;
    }
    if (state.skillCooldowns[idx] > 0) {
      state.skillCooldowns[idx] = Math.max(0, state.skillCooldowns[idx] - dt);
    }

    tower.attackTimer -= dt;
    if (tower.attackTimer <= 0) {
      const atkSpeed = getTowerAttackSpeedValue(tower, hero, hasSynergy);
      tower.attackTimer = 1 / atkSpeed;

      const range = getTowerEffectiveRange(tower, hasSynergy);
      const closest = findFurthestEnemyInRange(
        tower.x,
        tower.y,
        range,
        { excludePhasingForMelee: hero.type === 'melee' }
      );

      if (closest) {
        tower.target = closest;
        const dmg = getTowerDamageValue(tower, hasSynergy, { viaSkill: false, againstBoss: closest.type === 'boss' });
        playAttackSound(hero.type);

        if (hero.type === 'aoe') {
          const aoeRange = hasSynergy ? 65 : 50;
          state.enemies.forEach(e => {
            if (!e.alive) return;
            const dx = e.x - closest.x, dy = e.y - closest.y;
            if (dx * dx + dy * dy < aoeRange * aoeRange) {
              damageEnemy(e, dmg, { towerIdx: idx, viaSkill: false });
            }
          });
          spawnExplosion(closest.x, closest.y, hero.color, 6);
        } else if (hero.type === 'support') {
          damageEnemy(closest, dmg, { towerIdx: idx, viaSkill: false });
          const slowDur = hasSynergy ? 2.5 : 1.5;
          closest.slowTimer = Math.max(closest.slowTimer, slowDur);
          state.projectiles.push(makeProjectile(tower, closest, hero.color, 'orb'));
        } else {
          damageEnemy(closest, dmg, { towerIdx: idx, viaSkill: false });
          const pType = hero.type === 'ranged' ? 'arrow' : 'slash';
          state.projectiles.push(makeProjectile(tower, closest, hero.color, pType));
        }
      }
    }
  });
}

function makeProjectile(tower, target, color, type) {
  return {
    x: tower.x, y: tower.y,
    tx: target.x, ty: target.y,
    color, type, t: 0,
    trail: [],
  };
}

function getEnemyPathProgress(enemy) {
  if (!enemy.alive) return -1;
  if (!PATH[enemy.pathIndex]) return PATH_TOTAL_LENGTH;

  const previousPoint = PATH[Math.max(0, enemy.pathIndex - 1)];
  const nextPoint = PATH[enemy.pathIndex];
  const segDx = nextPoint.x - previousPoint.x;
  const segDy = nextPoint.y - previousPoint.y;
  const segLength = Math.sqrt(segDx * segDx + segDy * segDy) || 1;
  const distToNext = Math.sqrt((nextPoint.x - enemy.x) ** 2 + (nextPoint.y - enemy.y) ** 2);
  const traveledOnSegment = Math.max(0, Math.min(segLength, segLength - distToNext));
  return PATH_CUMULATIVE[Math.max(0, enemy.pathIndex - 1)] + traveledOnSegment;
}

function findFurthestEnemyInRange(originX, originY, range, options) {
  const opts = options || {};
  let bestEnemy = null;
  let bestProgress = -1;

  state.enemies.forEach(enemy => {
    if (!enemy.alive) return;
    if (opts.excludePhasingForMelee && enemy.phase) return;
    const dx = enemy.x - originX;
    const dy = enemy.y - originY;
    if (dx * dx + dy * dy > range * range) return;

    const progress = getEnemyPathProgress(enemy);
    if (progress > bestProgress) {
      bestProgress = progress;
      bestEnemy = enemy;
    }
  });

  return bestEnemy;
}

function damageEnemy(enemy, rawDamage, source) {
  const dmg = Math.max(1, rawDamage - enemy.armor);
  enemy.hp -= dmg;
  enemy.hitFlash = 0.15;
  state.totalDamageDealt += dmg;
  if (source && source.towerIdx !== undefined) {
    const tower = state.towers[source.towerIdx];
    if (tower && !tower.removed) {
      tower.damageDealt += dmg;
      if (source.viaSkill) {
        tower.skillDamageDealt += dmg;
      }
    }
  }

  const fontSize = dmg >= 30 ? 16 : dmg >= 15 ? 13 : 11;
  addFloatingText(enemy.x + (Math.random() - 0.5) * 10, enemy.y - enemy.size - 8, `-${dmg}`, dmg >= 30 ? '#ff4444' : '#ffcc00', fontSize);

  if (enemy.hp <= 0 && enemy.alive) {
    enemy.alive = false;
    state.gold += enemy.reward;
    state.earnedGold += enemy.reward;
    state.kills++;
    grantLeaderXp(Math.max(1, enemy.type === 'boss' ? 10 : enemy.elite ? 4 : Math.round(enemy.reward / 12)), enemy.x, enemy.y - 12);
    if (enemy.type === 'boss') {
      grantTreasure(2, '보스 격파');
    } else if (enemy.treasureDrop) {
      grantTreasure(enemy.treasureDrop, '엘리트 처치');
    }
    playKillSound(enemy.type === 'boss');
    if (source && source.towerIdx !== undefined) {
      const tower = state.towers[source.towerIdx];
      if (tower) tower.kills++;
    }

    state.combo.count++;
    state.combo.timer = 2;
    if (state.combo.count >= 3) {
      const bonus = Math.floor(state.combo.count * 1.5);
      state.gold += bonus;
      state.earnedGold += bonus;
      const comboEl = document.getElementById('combo-display');
      comboEl.textContent = `${state.combo.count}x COMBO! +${bonus}💰`;
      comboEl.style.opacity = '1';
      comboEl.style.fontSize = Math.min(36, 20 + state.combo.count * 2) + 'px';
    }

    addFloatingText(enemy.x, enemy.y - 25, `+${enemy.reward}💰`, '#ffd700', 14);
    spawnDeathEffect(enemy.x, enemy.y, enemy.color, enemy.size);

    if (enemy.type === 'boss') {
      shakeScreen(15);
      spawnExplosion(enemy.x, enemy.y, '#ff4444', 40);
      spawnExplosion(enemy.x, enemy.y, '#ffd700', 30);
    } else {
      shakeScreen(2);
    }
    updateUI();
  }
}

// ── Visual Effects ──
function spawnPlaceEffect(x, y, color) {
  for (let i = 0; i < 15; i++) {
    const angle = (i / 15) * Math.PI * 2;
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * 60,
      vy: Math.sin(angle) * 60 - 30,
      color,
      life: 0.5,
      maxLife: 0.5,
      size: 3,
      type: 'spark',
    });
  }
}

function spawnExplosion(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 120;
    state.particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      color,
      life: 0.3 + Math.random() * 0.5,
      maxLife: 0.3 + Math.random() * 0.5,
      size: 2 + Math.random() * 4,
      type: 'fire',
    });
  }
  state.particles.push({
    x, y,
    vx: 0, vy: 0,
    color,
    life: 0.4,
    maxLife: 0.4,
    size: 5,
    type: 'ring',
    radius: 10,
  });
}

function spawnDeathEffect(x, y, color, size) {
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 30 + Math.random() * 80;
    state.particles.push({
      x: x + (Math.random() - 0.5) * size,
      y: y + (Math.random() - 0.5) * size,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 50,
      color,
      life: 0.4 + Math.random() * 0.3,
      maxLife: 0.4 + Math.random() * 0.3,
      size: 2 + Math.random() * 3,
      type: 'pixel',
    });
  }
}

function spawnLightning(x1, y1, x2, y2) {
  const segments = 6;
  for (let i = 0; i < segments; i++) {
    const t = i / segments;
    const nx = x1 + (x2 - x1) * t + (Math.random() - 0.5) * 20;
    const ny = y1 + (y2 - y1) * t + (Math.random() - 0.5) * 20;
    state.particles.push({
      x: nx, y: ny,
      vx: (Math.random() - 0.5) * 30,
      vy: (Math.random() - 0.5) * 30,
      color: '#bb77ff',
      life: 0.3,
      maxLife: 0.3,
      size: 3 + Math.random() * 2,
      type: 'spark',
    });
  }
}

function spawnAura(x, y, color) {
  for (let i = 0; i < 20; i++) {
    const angle = (i / 20) * Math.PI * 2;
    state.particles.push({
      x: x + Math.cos(angle) * 30,
      y: y + Math.sin(angle) * 30,
      vx: Math.cos(angle) * 20,
      vy: Math.sin(angle) * 20 - 40,
      color,
      life: 0.6,
      maxLife: 0.6,
      size: 2,
      type: 'spark',
    });
  }
}

function spawnBarrier(x, y) {
  for (let i = 0; i < 30; i++) {
    const angle = (i / 30) * Math.PI * 2;
    state.particles.push({
      x: x + Math.cos(angle) * 50,
      y: y + Math.sin(angle) * 50,
      vx: Math.cos(angle) * 100,
      vy: Math.sin(angle) * 100,
      color: '#f39c12',
      life: 0.8,
      maxLife: 0.8,
      size: 3,
      type: 'spark',
    });
  }
}

function spawnHealEffect(x, y) {
  for (let i = 0; i < 5; i++) {
    state.particles.push({
      x: x + (Math.random() - 0.5) * 15,
      y,
      vx: (Math.random() - 0.5) * 10,
      vy: -40 - Math.random() * 30,
      color: '#00ff88',
      life: 0.5,
      maxLife: 0.5,
      size: 2,
      type: 'spark',
    });
  }
}

function shakeScreen(intensity) {
  state.screenShake.intensity = Math.max(state.screenShake.intensity, intensity);
}

function addFloatingText(x, y, text, color, fontSize) {
  state.floatingTexts.push({ x, y, text, color, life: 1.2, fontSize: fontSize || 12 });
}

// ── Update helpers ──
function updateParticles(dt) {
  state.particles = state.particles.filter(p => {
    p.life -= dt;
    if (p.type === 'ring') {
      p.radius += 200 * dt;
      return p.life > 0;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.type !== 'spark') p.vy += 150 * dt;
    return p.life > 0;
  });
}

function updateProjectiles(dt) {
  state.projectiles = state.projectiles.filter(p => {
    p.t += dt * 6;
    const lx = p.x, ly = p.y;
    p.x += (p.tx - p.x) * Math.min(1, p.t * 0.5);
    p.y += (p.ty - p.y) * Math.min(1, p.t * 0.5);
    p.trail.push({ x: lx, y: ly, alpha: 0.6 });
    if (p.trail.length > 5) p.trail.shift();
    p.trail.forEach(t => t.alpha *= 0.7);
    return p.t < 1;
  });
}

function updateFloatingTexts(dt) {
  state.floatingTexts = state.floatingTexts.filter(t => {
    t.y -= 50 * dt;
    t.life -= dt;
    return t.life > 0;
  });
}

function updateCombo(dt) {
  if (state.combo.timer > 0) {
    state.combo.timer -= dt;
    if (state.combo.timer <= 0) {
      state.combo.count = 0;
      document.getElementById('combo-display').style.opacity = '0';
    }
  }
}

function updateScreenShake(dt) {
  if (state.screenShake.intensity > 0) {
    state.screenShake.x = (Math.random() - 0.5) * state.screenShake.intensity * 2;
    state.screenShake.y = (Math.random() - 0.5) * state.screenShake.intensity * 2;
    state.screenShake.intensity *= 0.85;
    if (state.screenShake.intensity < 0.3) {
      state.screenShake.intensity = 0;
      state.screenShake.x = 0;
      state.screenShake.y = 0;
    }
  }
}

// ── Fog update (use real dt, not hardcoded) ──
function updateFog(dt) {
  state.fog.forEach(f => {
    f.x += f.speed * dt;
    if (f.x > W + f.r) f.x = -f.r;
  });
}

// ── Rendering ──
function draw() {
  // Reset DPR transform each frame (game draws in 960x540, CSS handles display scaling)
  ctx.setTransform(currentDpr, 0, 0, currentDpr, 0, 0);

  ctx.save();
  ctx.translate(state.screenShake.x, state.screenShake.y);

  drawBackground();
  drawEnvironment();
  drawPath();
  drawSlots();
  drawEnemyTrails();
  drawEnemies();
  drawTowers();
  drawProjectiles();
  drawParticles();
  drawFloatingTexts();
  drawFog();
  drawTowerRanges();

  ctx.restore();
}

function drawBackground() {
  if (images.background) {
    ctx.drawImage(images.background, 0, 0, W, H);
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#0c1a0c');
    grad.addColorStop(0.3, '#142814');
    grad.addColorStop(1, '#1a2e1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  const t = state.gameTime * 0.3;
  for (let x = 0; x < W; x += 48) {
    for (let y = 0; y < H; y += 48) {
      const noise = Math.sin(x * 0.04 + t) * Math.cos(y * 0.06 + t * 0.4) * 0.5 + 0.5;
      const alpha = 0.025 + noise * 0.025;
      ctx.fillStyle = `rgba(224, 243, 205, ${alpha})`;
      ctx.fillRect(x, y, 48, 48);
    }
  }

  const vignette = ctx.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 620);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, 'rgba(3,8,13,0.28)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  const moonSweep = 0.5 + Math.sin(state.gameTime * 0.35) * 0.5;
  const beam = ctx.createLinearGradient(0, 0, W, H);
  beam.addColorStop(Math.max(0, moonSweep - 0.25), 'rgba(160, 205, 255, 0)');
  beam.addColorStop(moonSweep, state.phase === 'combat' ? 'rgba(132, 185, 255, 0.08)' : 'rgba(196, 223, 255, 0.06)');
  beam.addColorStop(Math.min(1, moonSweep + 0.22), 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = beam;
  ctx.fillRect(0, 0, W, H);

  if (state.phase === 'combat') {
    ctx.fillStyle = 'rgba(255, 90, 56, 0.04)';
    ctx.fillRect(0, 0, W, H);
  }
}

function drawEnvironment() {
  state.environmentObjects.forEach(obj => {
    const sprite = SPRITES[obj.type];
    if (sprite) {
      drawPixelSprite(obj.x, obj.y, sprite, obj.scale);
    }
  });
}

function drawFog() {
  // Fog position is now updated in updateFog(), just draw here
  state.fog.forEach(f => {
    ctx.beginPath();
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(180,200,180,${f.alpha})`;
    ctx.fill();
  });
}

function drawPath() {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const combatPulse = state.phase === 'combat' ? (0.18 + Math.sin(state.gameTime * 4.5) * 0.06) : 0.08;

  ctx.strokeStyle = '#3a2a1a';
  ctx.lineWidth = 42;
  ctx.beginPath();
  ctx.moveTo(PATH[0].x, PATH[0].y);
  for (let i = 1; i < PATH.length; i++) ctx.lineTo(PATH[i].x, PATH[i].y);
  ctx.stroke();

  ctx.strokeStyle = '#5a4a3a';
  ctx.lineWidth = 36;
  ctx.beginPath();
  ctx.moveTo(PATH[0].x, PATH[0].y);
  for (let i = 1; i < PATH.length; i++) ctx.lineTo(PATH[i].x, PATH[i].y);
  ctx.stroke();

  ctx.strokeStyle = '#6b5a4a';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 12]);
  ctx.beginPath();
  ctx.moveTo(PATH[0].x, PATH[0].y);
  for (let i = 1; i < PATH.length; i++) ctx.lineTo(PATH[i].x, PATH[i].y);
  ctx.stroke();
  ctx.setLineDash([]);

  if (state.phase === 'combat') {
    ctx.strokeStyle = `rgba(255, 201, 111, ${combatPulse})`;
    ctx.lineWidth = 10;
    ctx.setLineDash([18, 30]);
    ctx.lineDashOffset = -state.gameTime * 120;
    ctx.beginPath();
    ctx.moveTo(PATH[0].x, PATH[0].y);
    for (let i = 1; i < PATH.length; i++) ctx.lineTo(PATH[i].x, PATH[i].y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  for (let i = 0; i < PATH.length - 1; i++) {
    const ax = (PATH[i].x + PATH[i + 1].x) / 2;
    const ay = (PATH[i].y + PATH[i + 1].y) / 2;
    const angle = Math.atan2(PATH[i + 1].y - PATH[i].y, PATH[i + 1].x - PATH[i].x);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(200,169,110,0.12)';
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-8, -7);
    ctx.lineTo(-8, 7);
    ctx.fill();
    ctx.restore();
  }
}

function drawSlots() {
  SLOTS.forEach((slot, i) => {
    if (slot.tower !== null) return;
    const hover = state.selectedHeroType !== null;
    const dx = mouseX - slot.x, dy = mouseY - slot.y;
    const isHover = dx * dx + dy * dy < SLOT_TOUCH_RADIUS * SLOT_TOUCH_RADIUS;
    const pulse = 0.55 + Math.sin(state.gameTime * 3.5 + i * 0.7) * 0.2;

    ctx.beginPath();
    ctx.arc(slot.x, slot.y, 24, 0, Math.PI * 2);
    ctx.fillStyle = isHover && hover ? `rgba(231,196,123,${0.28 + pulse * 0.12})` : `rgba(32,36,46,${0.38 + pulse * 0.08})`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(slot.x, slot.y, 29 + pulse * 2, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(157, 192, 255, ${0.08 + pulse * 0.08})`;
    ctx.lineWidth = 1;
    ctx.stroke();

    if (slot.terrain === 'high') {
      ctx.strokeStyle = '#8b7355';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(200,169,110,0.08)';
      ctx.fill();
    }

    ctx.strokeStyle = isHover && hover ? '#ffd700' : (hover ? '#c8a96e' : '#4a3a2a');
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(slot.x, slot.y, 24, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = isHover && hover ? '#ffd700' : '#6b5344';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', slot.x, slot.y);

    if (slot.terrain === 'high') {
      ctx.fillStyle = '#8b7355';
      ctx.font = '8px sans-serif';
      ctx.fillText('▲고지', slot.x, slot.y + 32);
    }
  });
}

function drawTowers() {
  state.towers.forEach((tower, idx) => {
    if (tower.removed) return;
    const hero = HEROES[tower.heroType];
    const isSelected = state.selectedTowerIdx === idx;
    const pulse = 0.5 + Math.sin(state.gameTime * 4 + idx) * 0.5;

    ctx.beginPath();
    ctx.ellipse(tower.x, tower.y + 18, 22, 9, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(tower.x, tower.y, 24, 0, Math.PI * 2);
    ctx.fillStyle = tower.skillActive ? '#2a2a10' : '#1a1530';
    ctx.fill();
    ctx.strokeStyle = isSelected ? '#ffd700' : hero.color;
    ctx.lineWidth = isSelected ? 3 : 2;
    ctx.stroke();

    if (checkSynergy(tower)) {
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, 28, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,200,255,${0.26 + pulse * 0.18})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    if (tower.skillActive) {
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, 30 + pulse * 2, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,215,0,${0.42 + pulse * 0.34})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const bounce = Math.sin(state.gameTime * 3 + idx) * 2;
    const heroImage = images.heroes[tower.heroType];
    if (heroImage) {
      const size = isSelected ? 66 : 60;
      ctx.save();
      ctx.shadowColor = hero.color;
      ctx.shadowBlur = tower.skillActive ? 18 : 10;
      ctx.drawImage(heroImage, tower.x - size / 2, tower.y - 40 + bounce, size, size);
      ctx.restore();
    } else {
      drawPixelSprite(tower.x, tower.y - 2 + bounce, SPRITES[hero.sprite], 3.5);
    }

    if (tower.level > 1) {
      ctx.fillStyle = '#ffd700';
      ctx.font = '10px serif';
      ctx.textAlign = 'center';
      ctx.fillText('★'.repeat(tower.level - 1), tower.x, tower.y + 32);
    }

    if (isSelected && tower.level < 3) {
      const cost = Math.max(20, Math.floor(25 * tower.level * (1 - getProgressionBonus('upgradeCostPct'))));
      ctx.fillStyle = state.gold >= cost ? '#ffd700' : '#ff6b6b';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`탭: 강화 (${cost}💰)`, tower.x, tower.y - 35);
    }
  });
}

function drawTowerRanges() {
  if (state.selectedHeroType) {
    const hero = HEROES[state.selectedHeroType];
    SLOTS.forEach(slot => {
      if (slot.tower !== null) return;
      const dx = mouseX - slot.x, dy = mouseY - slot.y;
      if (dx * dx + dy * dy < SLOT_TOUCH_RADIUS * SLOT_TOUCH_RADIUS) {
        const rangeBonus = slot.terrain === 'high' ? 20 + getProgressionBonus('highGroundRangeFlat') : 0;
        ctx.beginPath();
        ctx.arc(slot.x, slot.y, hero.range + getProgressionBonus('allRangeFlat') + rangeBonus, 0, Math.PI * 2);
        ctx.fillStyle = `${hero.color}11`;
        ctx.fill();
        ctx.strokeStyle = `${hero.color}44`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  }
  if (state.selectedTowerIdx !== null) {
    const tower = state.towers[state.selectedTowerIdx];
	    if (tower && !tower.removed) {
	      const range = getTowerEffectiveRange(tower, checkSynergy(tower));
	      ctx.beginPath();
	      ctx.arc(tower.x, tower.y, range, 0, Math.PI * 2);
	      ctx.fillStyle = `${HEROES[tower.heroType].color}11`;
	      ctx.fill();
	      ctx.strokeStyle = `${HEROES[tower.heroType].color}44`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

function drawEnemyTrails() {
  state.enemies.forEach(enemy => {
    if (!enemy.alive) return;
    enemy.trail.forEach(t => {
      ctx.globalAlpha = t.alpha * 0.3;
      drawPixelSprite(t.x, t.y, SPRITES[enemy.sprite], PIX * 0.8);
    });
  });
  ctx.globalAlpha = 1;
}

function drawEnemies() {
  state.enemies.forEach(enemy => {
    if (!enemy.alive) return;

    const bob = Math.sin(state.gameTime * 5 + enemy.animOffset);

    if (!enemy.flying) {
      ctx.beginPath();
      ctx.ellipse(enemy.x, enemy.y + enemy.size + 2, enemy.size * 0.6, enemy.size * 0.25, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();
    }

    const flyY = enemy.flying ? -15 + bob * 4 : bob;

    // Hit flash — use save/restore to prevent shadow leak
    if (enemy.hitFlash > 0) {
      ctx.save();
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 15;
    }

    if (enemy.slowTimer > 0) {
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y + flyY, enemy.size + 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(100,150,255,0.15)';
      ctx.fill();
    }

    if (enemy.elite) {
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y + flyY, enemy.size + 7, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 125, 188, ${0.32 + Math.sin(state.gameTime * 7 + enemy.animOffset) * 0.14})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const spriteData = SPRITES[enemy.sprite];
    if (spriteData) {
      const scale = enemy.type === 'boss' ? 4.5 : PIX;
      drawPixelSprite(enemy.x, enemy.y + flyY, spriteData, scale);
    }

    if (enemy.hitFlash > 0) {
      ctx.restore();
    }

    // HP bar
    const barW = Math.max(enemy.size * 2.5, 20);
    const barH = 3;
    const barX = enemy.x - barW / 2;
    const barY = enemy.y + flyY - enemy.size - 10;
    ctx.fillStyle = '#111';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    const hpRatio = enemy.hp / enemy.maxHp;
    const hpColor = hpRatio > 0.6 ? '#2ecc71' : hpRatio > 0.3 ? '#f39c12' : '#e74c3c';
    ctx.fillStyle = hpColor;
    ctx.fillRect(barX, barY, barW * hpRatio, barH);

    if (enemy.armor > 0) {
      ctx.fillStyle = '#aaa';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🛡' + enemy.armor, enemy.x, barY - 3);
    }

    if (enemy.elite) {
      ctx.fillStyle = '#ffb6ee';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ELITE', enemy.x, barY - 11);
    }

    if (enemy.healer) {
      ctx.fillStyle = '#00ff88';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('+', enemy.x + enemy.size + 5, enemy.y + flyY);
    }
  });
}

function drawProjectiles() {
  state.projectiles.forEach(p => {
    p.trail.forEach(t => {
      ctx.globalAlpha = t.alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(t.x - 1, t.y - 1, 2, 2);
    });
    ctx.globalAlpha = 1;

    if (p.type === 'arrow') {
      ctx.strokeStyle = `${p.color}66`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x - 6, p.y);
      ctx.lineTo(p.x + 4, p.y);
      ctx.stroke();
    }

    if (p.type === 'arrow') {
      const angle = Math.atan2(p.ty - p.y, p.tx - p.x);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(angle);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(-3, -2);
      ctx.lineTo(-3, 2);
      ctx.fill();
      ctx.restore();
    } else if (p.type === 'slash') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 0.8);
      ctx.stroke();
    } else {
      // Orb — use save/restore to prevent shadow leak
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.restore();
    }
  });
}

function drawParticles() {
  state.particles.forEach(p => {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;

    if (p.type === 'ring') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 3 * alpha;
      ctx.stroke();
    } else if (p.type === 'fire') {
      const s = p.size * (0.5 + alpha * 0.5);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = alpha * 0.3;
      ctx.fillRect(p.x - s / 4, p.y - s / 4, s / 2, s / 2);
    } else {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size * alpha, p.size * alpha);
    }
  });
  ctx.globalAlpha = 1;
}

function drawFloatingTexts() {
  state.floatingTexts.forEach(t => {
    const scale = t.life > 0.8 ? 1 + (1 - (t.life - 0.8) / 0.4) * 0.3 : 1;
    ctx.globalAlpha = Math.min(1, t.life * 1.5);
    ctx.fillStyle = t.color;
    ctx.font = `bold ${Math.floor((t.fontSize || 12) * scale)}px 'Noto Sans KR', sans-serif`;
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillText(t.text, t.x, t.y);
  });
  ctx.globalAlpha = 1;
}

// ── UI Update ──
function updateUI() {
  document.getElementById('gold').textContent = state.gold;
  document.getElementById('lives').textContent = state.lives;
  document.getElementById('wave-num').textContent = state.wave;
  document.getElementById('kills').textContent = state.kills;
  document.getElementById('treasure-count').textContent = state.treasury.treasures;
  document.getElementById('threat-tier').textContent = getThreatTier();
  refreshControls();
  updateBriefingPanel();
  renderLeaderHud();
  renderTreasureForge();
}

function formatNumber(value) {
  return Math.floor(value).toLocaleString('ko-KR');
}

function buildPerformanceSummary() {
  const grouped = {};
  let peakTower = null;

  state.towers.forEach((tower) => {
    const hero = HEROES[tower.heroType];
    if (!grouped[tower.heroType]) {
      grouped[tower.heroType] = {
        heroType: tower.heroType,
        icon: hero.icon,
        name: hero.name,
        damage: 0,
        skillDamage: 0,
        kills: 0,
        skillUses: 0,
        highestLevel: 0,
      };
    }

    grouped[tower.heroType].damage += tower.damageDealt || 0;
    grouped[tower.heroType].skillDamage += tower.skillDamageDealt || 0;
    grouped[tower.heroType].kills += tower.kills || 0;
    grouped[tower.heroType].skillUses += tower.skillUses || 0;
    grouped[tower.heroType].highestLevel = Math.max(grouped[tower.heroType].highestLevel, tower.level || 1);

    if (!peakTower || (tower.damageDealt || 0) > peakTower.damageDealt) {
      peakTower = tower;
    }
  });

  const profiles = Object.values(grouped);
  const sortBy = (key) => [...profiles].sort((a, b) => b[key] - a[key])[0] || null;
  const topDamage = sortBy('damage');
  const topKills = sortBy('kills');
  const topSkill = sortBy('skillUses');
  const highestLevelProfile = [...profiles].sort((a, b) => b.highestLevel - a.highestLevel)[0] || null;

  const score = Math.round(
    state.wave * 620 +
    state.lives * 140 +
    state.kills * 26 +
    state.totalDamageDealt * 0.8 +
    state.earnedGold * 2.4 +
    state.treasury.upgradesSucceeded * 95 +
    state.treasury.treasures * 30
  );

  return {
    score,
    topDamage,
    topKills,
    topSkill,
    highestLevelProfile,
    peakTower,
  };
}

function renderResultStats(targetId, isVictory) {
  const el = document.getElementById(targetId);
  if (!el) return;

  const summary = buildPerformanceSummary();
  const leader = getLeaderDef();
  const unlockedLeaderNodes = leader
    ? leader.tree.filter((node) => leaderHasNode(node.id)).map((node) => node.name)
    : [];
  const topDamage = summary.topDamage ? `${summary.topDamage.icon} ${summary.topDamage.name}` : '기록 없음';
  const topKills = summary.topKills ? `${summary.topKills.icon} ${summary.topKills.name}` : '기록 없음';
  const topSkill = summary.topSkill ? `${summary.topSkill.icon} ${summary.topSkill.name}` : '기록 없음';
  const highestLevel = summary.highestLevelProfile ? `${summary.highestLevelProfile.icon} ${summary.highestLevelProfile.name}` : '기록 없음';
  const peakTowerHero = summary.peakTower ? HEROES[summary.peakTower.heroType] : null;
  const topRelicEntry = Object.entries(state.treasury.relics).sort((a, b) => b[1].level - a[1].level)[0];
  const topRelic = topRelicEntry ? TREASURE_RELICS[topRelicEntry[0]] : null;
  const topRelicLevel = topRelicEntry ? topRelicEntry[1].level : 0;

  el.innerHTML = `
    <div class="result-score">
      <div class="label">Battle Score</div>
      <div class="value">${formatNumber(summary.score)}</div>
    </div>
    <div class="result-grid">
      <div class="result-card">
        <div class="label">최고 화력 직업</div>
        <div class="value">${topDamage}</div>
        <div class="meta">${summary.topDamage ? `${formatNumber(summary.topDamage.damage)} dmg` : '-'}</div>
      </div>
      <div class="result-card">
        <div class="label">최다 처치 직업</div>
        <div class="value">${topKills}</div>
        <div class="meta">${summary.topKills ? `${formatNumber(summary.topKills.kills)} kills` : '-'}</div>
      </div>
      <div class="result-card">
        <div class="label">스킬 MVP</div>
        <div class="value">${topSkill}</div>
        <div class="meta">${summary.topSkill ? `${formatNumber(summary.topSkill.skillUses)}회 사용 / 스킬 피해 ${formatNumber(summary.topSkill.skillDamage)}` : '-'}</div>
      </div>
      <div class="result-card">
        <div class="label">최고 강화 단계</div>
        <div class="value">${highestLevel}</div>
        <div class="meta">${summary.highestLevelProfile ? `Lv.${summary.highestLevelProfile.highestLevel}` : '-'}</div>
      </div>
      <div class="result-card">
        <div class="label">${isVictory ? '생존 리포트' : '전투 종료 시점'}</div>
        <div class="value">Wave ${state.wave} / 생명 ${state.lives}</div>
        <div class="meta">총 처치 ${formatNumber(state.kills)} / 총 데미지 ${formatNumber(state.totalDamageDealt)}</div>
      </div>
      <div class="result-card">
        <div class="label">경제 리포트</div>
        <div class="value">${formatNumber(state.earnedGold)} 금화 획득</div>
        <div class="meta">현재 보유 ${formatNumber(state.gold)} / 최고 딜 타워 ${peakTowerHero ? `${peakTowerHero.icon} ${peakTowerHero.name}` : '-'}</div>
      </div>
      <div class="result-card">
        <div class="label">지도자 리포트</div>
        <div class="value">${leader ? `${leader.icon} ${leader.name} Lv.${state.leader.level}` : '선택 없음'}</div>
        <div class="meta">${leader ? `${leader.trait} / 해금 ${unlockedLeaderNodes.length ? unlockedLeaderNodes.join(', ') : '없음'}` : '-'}</div>
      </div>
      <div class="result-card">
        <div class="label">보물 공방 리포트</div>
        <div class="value">${topRelic ? `${topRelic.icon} ${topRelic.name} Lv.${topRelicLevel}` : '유물 없음'}</div>
        <div class="meta">보물 ${state.treasury.treasures}개 보유 / 강화 성공 ${state.treasury.upgradesSucceeded}회</div>
      </div>
    </div>
  `;
}

// ── Game Loop (fix: use first frame timestamp for lastTime) ──
let lastTime = -1;
function gameLoop(timestamp) {
  if (lastTime < 0) {
    lastTime = timestamp;
    requestAnimationFrame(gameLoop);
    return;
  }

  const rawDt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;
  const dt = rawDt * state.speedMult;
  state.gameTime += rawDt;

  if (state.phase === 'combat') {
    state.waveTimer += dt;
    state.spawnQueue = state.spawnQueue.filter(s => {
      if (state.waveTimer >= s.time) {
        spawnEnemy(s.type);
        return false;
      }
      return true;
    });

    updateEnemies(dt);
    updateTowers(dt);

    const allSpawned = state.spawnQueue.length === 0;
    const allDead = state.enemies.every(e => !e.alive);
	    if (allSpawned && allDead && state.phase === 'combat') {
	      if (state.wave >= state.totalWaves) {
	        state.phase = 'victory';
	        renderResultStats('v-stats', true);
	        document.getElementById('victory-screen').style.display = 'flex';
	        playVictorySound();
	      } else {
	        state.phase = 'between';
	        const waveBonus = Math.floor((15 + state.wave * 5) * (1 + getProgressionBonus('waveGoldBonusPct')));
	        state.gold += waveBonus;
	        state.earnedGold += waveBonus;
	        grantTreasure(1 + (state.wave >= 5 ? 1 : 0), `웨이브 ${state.wave} 보상`);
	        grantLeaderXp(8 + state.wave * 3, W / 2, H / 2 + 34);
	        addFloatingText(W / 2, H / 2 - 20, `웨이브 ${state.wave} 클리어!`, '#ffd700', 20);
	        addFloatingText(W / 2, H / 2 + 10, `+${waveBonus}💰 보너스`, '#ffaa00', 14);
        document.getElementById('wave-btn').disabled = false;
        if (state.wave < state.totalWaves) {
          document.getElementById('wave-btn').textContent = `▶ W${state.wave + 1}`;
        }
        updateUI();
      }
    }
  }

  updateProjectiles(dt);
  updateParticles(dt);
  updateFloatingTexts(dt);
  updateCombo(dt);
  updateScreenShake(rawDt);
  updateFog(rawDt); // fog uses real dt, moved out of draw
  updateSkillBar(); // cached — only rebuilds DOM when state changes

  draw();
  requestAnimationFrame(gameLoop);
}

// ── CSS for touch ring animation ──
const style = document.createElement('style');
style.textContent = `@keyframes touchRingFade{0%{opacity:1;width:20px;height:20px}100%{opacity:0;width:60px;height:60px}}`;
document.head.appendChild(style);

// ── Start ──
preloadArt().finally(() => {
  init();
  updateUI();
});
