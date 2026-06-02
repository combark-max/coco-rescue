const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const distanceEl = document.querySelector("#distance");
const healthEl = document.querySelector("#health");
const weaponEl = document.querySelector("#weapon");
const scoreEl = document.querySelector("#score");
const overlay = document.querySelector("#overlay");
const startButton = document.querySelector("#start");
const characterSelect = document.querySelector("#characterSelect");
const weaponToggle = document.querySelector("#weaponToggle");
const weaponBar = document.querySelector("#weaponBar");
const settingsToggle = document.querySelector("#settingsToggle");
const settingsPanel = document.querySelector("#settingsPanel");
const settingsClose = document.querySelector("#settingsClose");
const soundToggle = document.querySelector("#soundToggle");
const pauseStateEl = document.querySelector("#pauseState");
const stick = document.querySelector("#stick");
const thumb = document.querySelector("#thumb");
const shootButton = document.querySelector("#shoot");

const weapons = [
  { id: "rifle", name: "일반총", shortName: "일반", icon: "R", maxAmmo: 80, cooldown: 0.18 },
  { id: "shotgun", name: "산탄총", shortName: "산탄", icon: "S", maxAmmo: 24, cooldown: 0.4 },
  { id: "machinegun", name: "기관총", shortName: "기관", icon: "M", maxAmmo: 140, cooldown: 0.07 },
  { id: "pistol", name: "권총", shortName: "권총", icon: "P", maxAmmo: 50, cooldown: 0.24 },
  { id: "grenade", name: "수류탄", shortName: "수류", icon: "G", maxAmmo: 8, cooldown: 0.72 },
];

const stages = [
  {
    id: "road",
    name: "1스테이지",
    goalY: -3800,
    enemyLookAhead: 1100,
    enemyGroupChance: 0.68,
    enemyMaxCount: 2,
    enemyHealth: 2,
    enemySpeed: 58,
    enemySpeedBonus: 34,
    enemyGap: 430,
    enemyGapBonus: 180,
    pickupStartY: -1460,
  },
  {
    id: "sea",
    name: "2스테이지",
    goalY: -12800,
    enemyLookAhead: 1450,
    enemyGroupChance: 0.42,
    enemyMaxCount: 3,
    enemyHealth: 3,
    enemySpeed: 72,
    enemySpeedBonus: 48,
    enemyGap: 300,
    enemyGapBonus: 120,
    pickupStartY: -1220,
    specialEnemyChance: 0.28,
  },
  {
    id: "space",
    name: "3스테이지",
    goalY: -15000,
    enemyLookAhead: 1550,
    enemyGroupChance: 0.34,
    enemyMaxCount: 4,
    enemyHealth: 4,
    enemySpeed: 82,
    enemySpeedBonus: 58,
    enemyGap: 280,
    enemyGapBonus: 110,
    pickupStartY: -1180,
    specialEnemyChance: 0.34,
    cocoCrossings: [-2600, -5200, -7800, -10400, -12600],
  },
];

const characters = [
  {
    id: "junyoung",
    name: "준영",
    suit: "#2c7b64",
    hat: "#4fae8f",
    skin: "#ffd8b1",
    speed: 1,
    health: 100,
  },
  {
    id: "junsung",
    name: "준성",
    suit: "#3c78a8",
    hat: "#74b7e6",
    skin: "#f3c39c",
    speed: 1.14,
    health: 90,
  },
  {
    id: "dad",
    name: "아빠",
    suit: "#9b5c88",
    hat: "#f09ac6",
    skin: "#ffd1b8",
    speed: 0.92,
    health: 120,
  },
  {
    id: "mom",
    name: "엄마",
    suit: "#c46c52",
    hat: "#f4b942",
    skin: "#ffd6b8",
    speed: 1.04,
    health: 105,
  },
];

const scoreKey = "coco-rescue-character-scores";
const soundKey = "coco-rescue-sound-enabled";
let selectedCharacterId = localStorage.getItem("coco-rescue-selected-character") || characters[0].id;
if (!characters.some((character) => character.id === selectedCharacterId)) {
  selectedCharacterId = characters[0].id;
  localStorage.setItem("coco-rescue-selected-character", selectedCharacterId);
}
let soundEnabled = localStorage.getItem(soundKey) !== "off";

const state = {
  running: false,
  paused: false,
  won: false,
  lost: false,
  stageIndex: 0,
  pendingStageIndex: null,
  pendingRevive: false,
  revives: 5,
  time: 0,
  distance: 0,
  score: 0,
  cameraY: 0,
  input: { x: 0, y: 0 },
  aiming: { x: 0, y: -1 },
  shootHeld: false,
  cooldown: 0,
  bullets: [],
  enemies: [],
  pickups: [],
  crossingCocos: [],
  sparks: [],
  boss: null,
  activeWeapon: "rifle",
  ammo: {},
  player: { x: 0, y: 0, health: 100, maxHealth: 100 },
  coco: { x: 0, y: -3800, rescued: false },
};

let width = 0;
let height = 0;
let dpr = 1;
let lastTime = performance.now();
let enemySpawnY = -420;
let pickupSpawnY = -1460;
let weaponPickerOpen = false;
let audioCtx = null;
let musicNodes = null;

function ensureAudio() {
  if (!soundEnabled) return null;
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  if (!AudioEngine) return null;
  if (!audioCtx) audioCtx = new AudioEngine();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function setSoundEnabled(enabled) {
  soundEnabled = enabled;
  localStorage.setItem(soundKey, enabled ? "on" : "off");
  renderSoundToggle();
  if (enabled) {
    ensureAudio();
    startStageMusic();
  } else {
    stopStageMusic();
  }
}

function renderSoundToggle() {
  soundToggle.textContent = soundEnabled ? "ON" : "OFF";
  soundToggle.setAttribute("aria-pressed", String(soundEnabled));
}

function playTone({ frequency = 440, duration = 0.12, type = "sine", volume = 0.2, slideTo = null }) {
  const audio = ensureAudio();
  if (!audio) return;
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function playNoise(duration = 0.16, volume = 0.22, filterFrequency = 900) {
  const audio = ensureAudio();
  if (!audio) return;
  const buffer = audio.createBuffer(1, audio.sampleRate * duration, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  filter.type = "bandpass";
  filter.frequency.value = filterFrequency;
  gain.gain.setValueAtTime(volume, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(audio.destination);
  source.start();
  source.stop(audio.currentTime + duration);
}

function playWeaponSound(weaponId) {
  if (weaponId === "shotgun") {
    playNoise(0.2, 0.28, 650);
    playTone({ frequency: 130, duration: 0.16, type: "sawtooth", volume: 0.14, slideTo: 70 });
  } else if (weaponId === "machinegun") {
    playTone({ frequency: 520, duration: 0.055, type: "square", volume: 0.12, slideTo: 260 });
    playNoise(0.05, 0.08, 1600);
  } else if (weaponId === "pistol") {
    playTone({ frequency: 640, duration: 0.09, type: "square", volume: 0.16, slideTo: 180 });
  } else if (weaponId === "grenade") {
    playTone({ frequency: 180, duration: 0.18, type: "triangle", volume: 0.16, slideTo: 90 });
    playNoise(0.14, 0.12, 420);
  } else {
    playTone({ frequency: 480, duration: 0.08, type: "square", volume: 0.13, slideTo: 240 });
  }
}

function playEventSound(type) {
  if (type === "pickup") {
    playTone({ frequency: 660, duration: 0.08, type: "sine", volume: 0.12 });
    setTimeout(() => playTone({ frequency: 920, duration: 0.1, type: "sine", volume: 0.12 }), 55);
  } else if (type === "hurt") {
    playTone({ frequency: 150, duration: 0.22, type: "sawtooth", volume: 0.18, slideTo: 70 });
  } else if (type === "bossDown") {
    playNoise(0.42, 0.3, 360);
    playTone({ frequency: 110, duration: 0.44, type: "sawtooth", volume: 0.2, slideTo: 45 });
    setTimeout(() => playTone({ frequency: 740, duration: 0.22, type: "triangle", volume: 0.16 }), 180);
  } else if (type === "finalBossDown") {
    playNoise(0.58, 0.34, 300);
    playTone({ frequency: 90, duration: 0.52, type: "sawtooth", volume: 0.24, slideTo: 35 });
    setTimeout(() => playTone({ frequency: 880, duration: 0.18, type: "triangle", volume: 0.18 }), 190);
    setTimeout(() => playTone({ frequency: 1175, duration: 0.24, type: "triangle", volume: 0.16 }), 340);
  } else if (type === "rescue") {
    [523, 659, 784, 1046].forEach((freq, index) => {
      setTimeout(() => playTone({ frequency: freq, duration: 0.18, type: "triangle", volume: 0.14 }), index * 90);
    });
  } else if (type === "fail") {
    playTone({ frequency: 220, duration: 0.28, type: "sine", volume: 0.16, slideTo: 110 });
    setTimeout(() => playTone({ frequency: 140, duration: 0.34, type: "sine", volume: 0.14, slideTo: 80 }), 180);
  }
}

function stopStageMusic() {
  if (!musicNodes) return;
  for (const node of musicNodes) {
    try {
      if (node.gain) node.gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.18);
      if (node.osc) node.osc.stop(audioCtx.currentTime + 0.22);
    } catch (error) {
      // Already stopped.
    }
  }
  musicNodes = null;
}

function startStageMusic() {
  const audio = ensureAudio();
  if (!audio || !state.running) return;
  stopStageMusic();
  const stage = stages[state.stageIndex];
  const settings = stage.id === "space"
    ? { base: 98, harmony: 147, type: "sine", volume: 0.035 }
    : stage.id === "sea"
      ? { base: 165, harmony: 220, type: "triangle", volume: 0.028 }
      : { base: 130, harmony: 196, type: "sine", volume: 0.026 };
  musicNodes = [settings.base, settings.harmony].map((freq, index) => {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = settings.type;
    osc.frequency.value = freq;
    gain.gain.value = settings.volume * (index === 0 ? 1 : 0.7);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    return { osc, gain };
  });
}

function selectedCharacter() {
  return characters.find((character) => character.id === selectedCharacterId) || characters[0];
}

function loadScores() {
  try {
    return JSON.parse(localStorage.getItem(scoreKey) || "{}");
  } catch (error) {
    return {};
  }
}

function saveSelectedCharacter() {
  localStorage.setItem("coco-rescue-selected-character", selectedCharacterId);
}

function saveScore() {
  const scores = loadScores();
  const best = Math.max(scores[selectedCharacterId] || 0, state.score);
  scores[selectedCharacterId] = best;
  localStorage.setItem(scoreKey, JSON.stringify(scores));
  renderCharacterSelect();
  return best;
}

function activeWeapon() {
  return weapons.find((weapon) => weapon.id === state.activeWeapon) || weapons[0];
}

function ammoForWeapon(weapon) {
  return state.ammo[weapon.id] ?? weapon.maxAmmo;
}

function refillAmmo() {
  state.ammo = Object.fromEntries(weapons.map((weapon) => [weapon.id, weapon.maxAmmo]));
}

function chooseWeapon(weaponId) {
  if (!state.running) return;
  const selected = weapons.find((weapon) => weapon.id === weaponId);
  if (!selected) return;
  if (ammoForWeapon(selected) <= 0) return;
  state.activeWeapon = weaponId;
  const weapon = activeWeapon();
  weaponEl.textContent = `${weapon.shortName} ${ammoForWeapon(weapon)}`;
  renderWeaponBar();
  playTone({ frequency: 720, duration: 0.08, type: "triangle", volume: 0.1 });
  closeWeaponPicker();
}

function updatePlayUiVisibility() {
  const showPlayUi = state.running && !state.lost && !state.won;
  settingsToggle.classList.toggle("hidden", !showPlayUi);
  weaponToggle.classList.toggle("hidden", !showPlayUi);
  weaponToggle.textContent = activeWeapon().icon;
  weaponToggle.setAttribute("aria-pressed", String(weaponPickerOpen));
  weaponBar.classList.toggle("hidden", !showPlayUi || !weaponPickerOpen);
}

function openWeaponPicker() {
  if (!state.running || state.won || state.lost) return;
  weaponPickerOpen = true;
  state.paused = true;
  state.shootHeld = false;
  resetStick();
  renderWeaponBar();
  updatePlayUiVisibility();
}

function closeWeaponPicker() {
  weaponPickerOpen = false;
  if (state.running && !state.won && !state.lost && settingsPanel.classList.contains("hidden")) {
    state.paused = false;
  }
  updatePlayUiVisibility();
}

function toggleWeaponPicker() {
  if (weaponPickerOpen) {
    closeWeaponPicker();
  } else {
    openWeaponPicker();
  }
}

function openSettings() {
  if (state.running) {
    closeWeaponPicker();
    state.paused = true;
    state.shootHeld = false;
    resetStick();
    pauseStateEl.textContent = "일시 중단";
  } else {
    pauseStateEl.textContent = "준비 중";
  }
  settingsPanel.classList.remove("hidden");
  renderCharacterSelect();
  updatePlayUiVisibility();
}

function closeSettings() {
  settingsPanel.classList.add("hidden");
  if (state.running && !state.won && !state.lost) {
      state.paused = false;
  }
  updatePlayUiVisibility();
}

function renderWeaponBar() {
  weaponBar.innerHTML = "";

  for (const weapon of weapons) {
    const ammo = ammoForWeapon(weapon);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "weapon-slot";
    button.dataset.weapon = weapon.id;
    button.disabled = state.running && ammo <= 0;
    button.setAttribute("aria-pressed", String(weapon.id === state.activeWeapon));
    button.innerHTML = `
      <span class="weapon-icon">${weapon.icon}</span>
      <span class="weapon-name">${weapon.shortName}</span>
      <span class="weapon-ammo">${ammo}</span>
    `;
    button.addEventListener("click", () => chooseWeapon(weapon.id));
    weaponBar.append(button);
  }
}

function renderCharacterSelect() {
  const scores = loadScores();
  characterSelect.innerHTML = "";

  for (const character of characters) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "character-card";
    button.dataset.character = character.id;
    button.setAttribute("aria-pressed", String(character.id === selectedCharacterId));
    button.innerHTML = `
      <span class="character-face" style="background: ${character.suit}"></span>
      <span class="character-name">${character.name}</span>
      <span class="character-score">최고 ${scores[character.id] || 0}</span>
    `;
    button.addEventListener("click", () => {
      selectedCharacterId = character.id;
      saveSelectedCharacter();
      renderCharacterSelect();
    });
    characterSelect.append(button);
  }
}

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resetGame() {
  ensureAudio();
  state.won = false;
  state.lost = false;
  state.pendingStageIndex = null;
  state.pendingRevive = false;
  state.revives = 5;
  state.time = 0;
  state.score = 0;
  refillAmmo();
  const character = selectedCharacter();
  state.player = { x: 0, y: 0, health: character.health, maxHealth: character.health };
  startStage(0);
}

function startStage(stageIndex) {
  const stage = stages[stageIndex];
  state.running = true;
  state.paused = false;
  state.stageIndex = stageIndex;
  state.pendingStageIndex = null;
  state.distance = 0;
  state.cameraY = 0;
  state.input.x = 0;
  state.input.y = 0;
  state.aiming.x = 0;
  state.aiming.y = -1;
  state.cooldown = 0;
  weaponPickerOpen = false;
  state.bullets = [];
  state.enemies = [];
  state.boss = null;
  if (stage.id === "sea") {
    state.boss = { type: "sea", x: 0, y: stage.goalY + 230, health: 45, maxHealth: 45, speed: 78, active: false };
  } else if (stage.id === "space") {
    state.boss = { type: "space", x: 0, y: stage.goalY + 300, health: 85, maxHealth: 85, speed: 96, active: false };
  }
  state.pickups = [
    { x: 0, y: -620, type: "ammo", bob: 0 },
    { x: -90, y: -1040, type: "heart", bob: Math.PI },
  ];
  state.crossingCocos = (stage.cocoCrossings || []).map((y, index) => ({
    x: index % 2 === 0 ? -width * 0.28 : width * 0.28,
    y,
    startX: index % 2 === 0 ? -width * 0.28 : width * 0.28,
    direction: index % 2 === 0 ? 1 : -1,
    speed: 84 + index * 8,
    hit: false,
    warned: false,
  }));
  state.sparks = [];
  state.player.x = 0;
  state.player.y = 0;
  state.coco = { x: 0, y: stage.goalY, rescued: false };
  enemySpawnY = -420;
  pickupSpawnY = stage.pickupStartY;
  overlay.classList.add("hidden");
  overlay.classList.remove("title-screen");
  settingsPanel.classList.add("hidden");
  const weapon = activeWeapon();
  weaponEl.textContent = `${weapon.shortName} ${ammoForWeapon(weapon)}`;
  scoreEl.textContent = `${state.score}`;
  renderWeaponBar();
  updatePlayUiVisibility();
  startStageMusic();
}

function revivePlayer() {
  state.pendingRevive = false;
  state.running = true;
  state.paused = false;
  weaponPickerOpen = false;
  state.lost = false;
  state.player.health = state.player.maxHealth;
  state.cooldown = 0;
  state.shootHeld = false;
  state.bullets = [];
  state.sparks = [];
  state.enemies = state.enemies.filter((enemy) => Math.hypot(enemy.x - state.player.x, enemy.y - state.player.y) > 360);
  enemySpawnY = Math.min(enemySpawnY, state.player.y - 260);
  overlay.classList.add("hidden");
  settingsPanel.classList.add("hidden");
  healthEl.textContent = `${Math.ceil(state.player.health)}`;
  updatePlayUiVisibility();
  playEventSound("rescue");
}

function worldToScreen(x, y) {
  return {
    x: width / 2 + x,
    y: height * 0.64 + y - state.cameraY,
  };
}

function drawGrid() {
  const stage = stages[state.stageIndex];
  ctx.fillStyle = stage.id === "space" ? "#14142e" : stage.id === "sea" ? "#4aaed8" : "#6fc7a1";
  ctx.fillRect(0, 0, width, height);

  const grid = 80;
  const startY = Math.floor((state.cameraY - height) / grid) * grid;

  if (stage.id === "space") {
    drawSpace(startY);
    ctx.fillStyle = "#3d3f5b";
    ctx.fillRect(width / 2 - 118, 0, 236, height);
    ctx.fillStyle = "#565a7d";
    ctx.fillRect(width / 2 - 104, 0, 208, height);
  } else if (stage.id === "sea") {
    drawSea(startY);
    drawSeaSideDetails();
    ctx.fillStyle = "#8a6a45";
    ctx.fillRect(width / 2 - 118, 0, 236, height);
    ctx.fillStyle = "#b98550";
    ctx.fillRect(width / 2 - 104, 0, 208, height);
  } else {
    drawRoadSideMountains();
    ctx.fillStyle = "#d7b77d";
    ctx.fillRect(width / 2 - 118, 0, 236, height);
    ctx.fillStyle = "#edcf91";
    ctx.fillRect(width / 2 - 104, 0, 208, height);
  }

  ctx.strokeStyle = "rgba(122, 84, 44, 0.2)";
  ctx.lineWidth = 3;
  ctx.setLineDash([16, 18]);
  ctx.beginPath();
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.stroke();
  ctx.setLineDash([]);

  for (let y = startY; y < state.cameraY + height; y += grid) {
    const sy = worldToScreen(0, y).y;
    ctx.fillStyle = stage.id === "space" ? "rgba(218, 222, 255, 0.14)" : stage.id === "sea" ? "rgba(66, 38, 20, 0.18)" : "rgba(255, 255, 255, 0.12)";
    ctx.fillRect(width / 2 - 104, sy, 208, 2);
  }

  for (let y = startY; y < state.cameraY + height; y += 210) {
    if (stage.id === "space") {
      drawMoonRock(-136, y + 44, 1.2);
      drawMoonRock(138, y + 146, 1.05);
      drawSatellite(-158, y + 124, 0.95);
      drawSatellite(158, y + 28, 0.8);
    } else if (stage.id === "sea") {
      drawWave(-104, y, 1.16);
      drawWave(110, y + 110, 1.28);
      drawBuoy(-152, y + 62);
      drawBuoy(156, y + 168);
    } else {
      drawMountain(-132, y + 12, 1.28);
      drawMountain(132, y + 118, 1.18);
      drawBush(-112, y + 42, 1 + ((Math.floor(y / 210) % 2) * 0.12));
      drawBush(114, y + 146, 1);
      drawFlower(-160, y + 78, "#ffd35a");
      drawFlower(164, y + 170, "#ff8fb1");
    }
  }

  if (stage.id === "space") {
    drawSpaceSideDetails();
  } else if (stage.id === "sea") {
    drawSeaSideDetails();
  } else {
    drawRoadSideMountains();
  }
}

function drawRoadSideMountains() {
  const positions = [
    [58, 126, 1.35],
    [width - 54, 234, 1.18],
    [50, 410, 1.24],
    [width - 58, 586, 1.38],
  ];

  for (const [x, y, scale] of positions) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = "#6b7780";
    ctx.beginPath();
    ctx.moveTo(-52, 42);
    ctx.lineTo(0, -54);
    ctx.lineTo(54, 42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#eef4f7";
    ctx.beginPath();
    ctx.moveTo(0, -54);
    ctx.lineTo(-14, -24);
    ctx.lineTo(13, -24);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

function drawSeaSideDetails() {
  ctx.save();
  ctx.strokeStyle = "rgba(229, 250, 255, 0.82)";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  for (const [x, y] of [[62, 130], [width - 68, 260], [64, 440], [width - 62, 600]]) {
    ctx.beginPath();
    ctx.arc(x - 16, y, 22, Math.PI * 0.12, Math.PI * 0.88);
    ctx.arc(x + 18, y, 22, Math.PI * 0.12, Math.PI * 0.88);
    ctx.stroke();
  }
  ctx.restore();
}

function drawMountain(x, y, scale) {
  const screen = worldToScreen(x, y);
  ctx.save();
  ctx.translate(screen.x, screen.y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#2d6d53";
  ctx.beginPath();
  ctx.moveTo(-46, 34);
  ctx.lineTo(0, -42);
  ctx.lineTo(48, 34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.58)";
  ctx.beginPath();
  ctx.moveTo(0, -42);
  ctx.lineTo(-12, -18);
  ctx.lineTo(11, -18);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSea(startY) {
  ctx.strokeStyle = "rgba(229, 250, 255, 0.38)";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  for (let y = startY; y < state.cameraY + height; y += 92) {
    for (let x = -80; x < width + 80; x += 170) {
      const sy = worldToScreen(0, y).y;
      ctx.beginPath();
      ctx.arc(x, sy, 28, Math.PI * 0.08, Math.PI * 0.92);
      ctx.stroke();
    }
  }
}

function drawSpace(startY) {
  for (let y = startY; y < state.cameraY + height; y += 120) {
    const sy = worldToScreen(0, y).y;
    for (let x = 22; x < width; x += 58) {
      const twinkle = 0.45 + ((Math.sin((x + y) * 0.05 + state.time * 2) + 1) * 0.22);
      ctx.fillStyle = `rgba(244, 241, 196, ${twinkle})`;
      ctx.beginPath();
      ctx.arc(x, sy + ((x * 17 + y) % 88), x % 3 === 0 ? 2.2 : 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawSpaceSideDetails() {
  drawPlanet(54, 116, 34, "#d8756b", "#ffcc78");
  drawPlanet(width - 54, 306, 42, "#4ca6d9", "#b4f0ff");
  drawPlanet(58, 566, 28, "#8f7bd9", "#f2d27c");
}

function drawPlanet(x, y, radius, color, ring) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.36);
  ctx.strokeStyle = ring;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 1.45, radius * 0.52, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  ctx.beginPath();
  ctx.arc(x - radius * 0.24, y - radius * 0.28, radius * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

function drawMoonRock(x, y, scale) {
  const screen = worldToScreen(x, y);
  ctx.save();
  ctx.translate(screen.x, screen.y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#858aa7";
  ctx.beginPath();
  ctx.moveTo(-31, 18);
  ctx.lineTo(-20, -18);
  ctx.lineTo(16, -30);
  ctx.lineTo(36, 5);
  ctx.lineTo(18, 30);
  ctx.lineTo(-22, 28);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(24, 24, 48, 0.28)";
  for (const [cx, cy, r] of [[-12, 2, 7], [12, -10, 5], [16, 13, 6]]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSatellite(x, y, scale) {
  const screen = worldToScreen(x, y);
  ctx.save();
  ctx.translate(screen.x, screen.y);
  ctx.scale(scale, scale);
  ctx.rotate(Math.sin(state.time + y) * 0.15);
  ctx.fillStyle = "#dbe7ff";
  ctx.beginPath();
  ctx.roundRect(-14, -10, 28, 20, 5);
  ctx.fill();
  ctx.fillStyle = "#6aa8ff";
  ctx.fillRect(-42, -9, 24, 18);
  ctx.fillRect(18, -9, 24, 18);
  ctx.strokeStyle = "#f8f5dc";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(0, -28);
  ctx.stroke();
  ctx.restore();
}

function drawWave(x, y, scale) {
  const screen = worldToScreen(x, y);
  ctx.save();
  ctx.translate(screen.x, screen.y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = "rgba(229, 250, 255, 0.72)";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(-16, 0, 20, Math.PI * 0.1, Math.PI * 0.9);
  ctx.arc(18, 0, 20, Math.PI * 0.1, Math.PI * 0.9);
  ctx.stroke();
  ctx.restore();
}

function drawBuoy(x, y) {
  const screen = worldToScreen(x, y);
  ctx.save();
  ctx.translate(screen.x, screen.y);
  ctx.fillStyle = "#f7f3e8";
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#d64747";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBush(x, y, scale) {
  const screen = worldToScreen(x, y);
  ctx.save();
  ctx.translate(screen.x, screen.y);
  ctx.scale(scale, scale);
  ctx.fillStyle = "#2f966c";
  for (const [cx, cy, r] of [[-18, 4, 22], [0, -8, 27], [22, 5, 23]]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
  ctx.beginPath();
  ctx.arc(-8, -15, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFlower(x, y, color) {
  const screen = worldToScreen(x, y);
  ctx.save();
  ctx.translate(screen.x, screen.y);
  ctx.fillStyle = color;
  for (let i = 0; i < 5; i += 1) {
    const angle = (Math.PI * 2 * i) / 5;
    ctx.beginPath();
    ctx.arc(Math.cos(angle) * 8, Math.sin(angle) * 8, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#fff4b8";
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function spawnEnemies() {
  const stage = stages[state.stageIndex];
  while (enemySpawnY > state.player.y - stage.enemyLookAhead) {
    const count = Math.random() > stage.enemyGroupChance ? stage.enemyMaxCount : 1;
    for (let i = 0; i < count; i += 1) {
      const isSpecial = (stage.id === "sea" || stage.id === "space") && Math.random() < stage.specialEnemyChance;
      const kind = stage.id === "space" && isSpecial ? "alien" : isSpecial ? "diver" : "bandit";
      const specialBoost = kind === "alien" ? 3 : kind === "diver" ? 2 : 0;
      state.enemies.push({
        x: (Math.random() - 0.5) * Math.min(width * 0.38, 220),
        y: enemySpawnY - Math.random() * 220,
        health: stage.enemyHealth + specialBoost,
        speed: stage.enemySpeed + Math.random() * stage.enemySpeedBonus + (kind === "alien" ? 30 : kind === "diver" ? 20 : 0),
        kind,
      });
    }
    enemySpawnY -= stage.enemyGap + Math.random() * stage.enemyGapBonus;
  }
}

function spawnPickups() {
  while (pickupSpawnY > state.player.y - 1300 && pickupSpawnY > state.coco.y + 220) {
    const isHeart = Math.random() < 0.38;
    state.pickups.push({
      x: (Math.random() - 0.5) * Math.min(width * 0.3, 180),
      y: pickupSpawnY,
      type: isHeart ? "heart" : "ammo",
      bob: Math.random() * Math.PI * 2,
    });
    pickupSpawnY -= 560 + Math.random() * 260;
  }
}

function shoot() {
  if (state.cooldown > 0) return;
  const weapon = activeWeapon();
  if ((state.ammo[weapon.id] || 0) <= 0) {
    const nextWeapon = weapons.find((candidate) => (state.ammo[candidate.id] || 0) > 0);
    if (nextWeapon) state.activeWeapon = nextWeapon.id;
    renderWeaponBar();
    return;
  }

  const aim = normalize(state.aiming.x, state.aiming.y);
  const right = { x: -aim.y, y: aim.x };
  const muzzle = {
    x: state.player.x + aim.x * 54 + right.x * 20,
    y: state.player.y + aim.y * 54 + right.y * 20,
  };

  state.ammo[weapon.id] -= 1;
  playWeaponSound(weapon.id);

  if (weapon.id === "shotgun") {
    for (let i = -2; i <= 2; i += 1) {
      const spread = i * 0.18;
      const vx = aim.x * Math.cos(spread) - aim.y * Math.sin(spread);
      const vy = aim.x * Math.sin(spread) + aim.y * Math.cos(spread);
      state.bullets.push({
        x: muzzle.x,
        y: muzzle.y,
        vx: vx * 640,
        vy: vy * 640,
        life: 0.48,
        size: 5,
        power: 1,
        color: "#ffef9a",
      });
    }
  } else if (weapon.id === "grenade") {
    state.bullets.push({
      x: muzzle.x,
      y: muzzle.y,
      vx: aim.x * 360,
      vy: aim.y * 360,
      life: 0.9,
      size: 9,
      power: 2,
      color: "#96d36c",
      explosive: true,
      blastRadius: 96,
    });
  } else {
    const speed = weapon.id === "pistol" ? 760 : weapon.id === "machinegun" ? 720 : 680;
    const size = weapon.id === "pistol" ? 4 : 5;
    const power = weapon.id === "pistol" ? 2 : 1;
    state.bullets.push({
      x: muzzle.x,
      y: muzzle.y,
      vx: aim.x * speed,
      vy: aim.y * speed,
      life: weapon.id === "machinegun" ? 0.62 : 0.82,
      size,
      power,
      color: weapon.id === "machinegun" ? "#c9f3ff" : "#ffe27a",
    });
  }

  if (state.ammo[weapon.id] <= 0) {
    const nextWeapon = weapons.find((candidate) => (state.ammo[candidate.id] || 0) > 0);
    if (nextWeapon) state.activeWeapon = nextWeapon.id;
  }
  state.cooldown = weapon.cooldown;
  renderWeaponBar();
}

function normalize(x, y) {
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length };
}

function addSpark(x, y, color) {
  for (let i = 0; i < 8; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 140;
    state.sparks.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.35,
      color,
    });
  }
}

function explodeBullet(bullet) {
  if (bullet.exploded) return;
  bullet.exploded = true;
  const radius = bullet.blastRadius || 80;

  for (const enemy of state.enemies) {
    const distance = Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y);
    if (distance < radius) {
      enemy.health -= 3;
    }
  }

  if (state.boss && state.boss.health > 0) {
    const bossDistance = Math.hypot(state.boss.x - bullet.x, state.boss.y - bullet.y);
    if (bossDistance < radius + 22) {
      state.boss.health -= 5;
      addSpark(state.boss.x, state.boss.y, "#ffef9a");
    }
  }

  explodeNearCrossingCoco(bullet);

  for (let i = 0; i < 20; i += 1) {
    addSpark(bullet.x, bullet.y, "#96d36c");
  }
}

function updateBoss(dt) {
  if (!state.boss || state.boss.health <= 0) return;

  const boss = state.boss;
  if (Math.abs(state.player.y - boss.y) < 760) {
    boss.active = true;
  }

  if (!boss.active) return;

  const dx = state.player.x - boss.x;
  const dy = state.player.y - boss.y;
  const dir = normalize(dx, dy);
  boss.x += dir.x * boss.speed * dt;
  boss.y += dir.y * boss.speed * dt;
  boss.x = Math.max(-width * 0.22, Math.min(width * 0.22, boss.x));
  boss.y = Math.max(state.coco.y + 80, Math.min(state.coco.y + (boss.type === "space" ? 700 : 560), boss.y));

  if (Math.hypot(dx, dy) < (boss.type === "space" ? 58 : 48)) {
    state.player.health -= (boss.type === "space" ? 58 : 42) * dt;
    addSpark(boss.x, boss.y, boss.type === "space" ? "#ff6fbd" : "#4aa3df");
  }
}

function updateCrossingCocos(dt) {
  for (const coco of state.crossingCocos) {
    if (coco.hit) continue;
    const nearPlayer = Math.abs(state.player.y - coco.y) < 720;
    if (!nearPlayer) continue;

    coco.x += coco.direction * coco.speed * dt;
    if (Math.abs(coco.x) > width * 0.34) {
      coco.hit = true;
    }
  }
}

function hurtPlayerForCocoHit(coco, damage) {
  if (coco.hit) return;
  coco.hit = true;
  state.player.health -= damage;
  state.score = Math.max(0, state.score - 150);
  playEventSound("hurt");
  addSpark(coco.x, coco.y, "#ff9ca8");
  addSpark(coco.x, coco.y, "#f7f3e8");
}

function explodeNearCrossingCoco(bullet) {
  const radius = bullet.blastRadius || 80;
  for (const coco of state.crossingCocos) {
    if (coco.hit) continue;
    if (Math.hypot(coco.x - bullet.x, coco.y - bullet.y) < radius + 18) {
      hurtPlayerForCocoHit(coco, 42);
    }
  }
}

function update(dt) {
  if (!state.running) return;
  if (state.paused) return;

  state.time += dt;
  state.cooldown = Math.max(0, state.cooldown - dt);

  const character = selectedCharacter();
  const passedStageCoco = !state.coco.rescued && state.player.y < state.coco.y - 70;
  const moveX = state.input.x * 205 * character.speed;
  const inputY = state.input.y * 205;
  const returnAssist = passedStageCoco ? Math.min(170, Math.max(70, (state.coco.y - state.player.y) * 1.6)) : 0;
  const moveY = (inputY + returnAssist) * character.speed;
  state.player.x += moveX * dt;
  state.player.y += moveY * dt;
  state.player.x = Math.max(-width * 0.2, Math.min(width * 0.2, state.player.x));
  state.player.y = Math.min(220, state.player.y);
  state.distance = Math.max(0, Math.floor(Math.max(0, -state.player.y) / 10));
  state.cameraY += (state.player.y - state.cameraY) * Math.min(1, dt * 7);

  if (Math.hypot(state.input.x, state.input.y) > 0.18) {
    state.aiming.x = state.input.x;
    state.aiming.y = Math.min(-0.2, state.input.y);
  }

  if (state.shootHeld) shoot();
  spawnEnemies();
  spawnPickups();
  updateCrossingCocos(dt);

  for (const bullet of state.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
    if (bullet.explosive && bullet.life <= 0) explodeBullet(bullet);
  }

  for (const enemy of state.enemies) {
    const dx = state.player.x - enemy.x;
    const dy = state.player.y - enemy.y;
    const dir = normalize(dx, dy);
    enemy.x += dir.x * enemy.speed * dt;
    enemy.y += dir.y * enemy.speed * dt;

    if (Math.hypot(dx, dy) < 30) {
      state.player.health -= 22 * dt;
      if (Math.random() < 0.04) playEventSound("hurt");
      addSpark(enemy.x, enemy.y, "#d64747");
    }
  }

  updateBoss(dt);

  for (const bullet of state.bullets) {
    for (const enemy of state.enemies) {
      if (Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < 24) {
        bullet.life = 0;
        if (bullet.explosive) {
          explodeBullet(bullet);
        } else {
          enemy.health -= bullet.power || 1;
          addSpark(enemy.x, enemy.y, "#f4b942");
        }
      }
    }
  }

  if (state.boss && state.boss.health > 0) {
    for (const bullet of state.bullets) {
      if (Math.hypot(bullet.x - state.boss.x, bullet.y - state.boss.y) < 34) {
        bullet.life = 0;
        if (bullet.explosive) {
          explodeBullet(bullet);
        } else {
          state.boss.health -= bullet.power || 1;
          addSpark(state.boss.x, state.boss.y, "#f4b942");
        }
      }
    }

    if (state.boss.health <= 0) {
      state.score += state.boss.type === "space" ? 2200 : 1200;
      playEventSound(state.boss.type === "space" ? "finalBossDown" : "bossDown");
      addSpark(state.boss.x, state.boss.y, "#9fe6ff");
    }
  }

  for (const bullet of state.bullets) {
    for (const coco of state.crossingCocos) {
      if (coco.hit) continue;
      if (Math.hypot(bullet.x - coco.x, bullet.y - coco.y) < 28) {
        bullet.life = 0;
        if (bullet.explosive) {
          explodeBullet(bullet);
        } else {
          hurtPlayerForCocoHit(coco, 34);
        }
      }
    }
  }
  state.bullets = state.bullets.filter((bullet) => bullet.life > 0 && !bullet.exploded);

  for (const pickup of state.pickups) {
    const pickupDistance = Math.hypot(state.player.x - pickup.x, state.player.y - pickup.y);
    if (pickupDistance < 130) {
      const pull = normalize(state.player.x - pickup.x, state.player.y - pickup.y);
      pickup.x += pull.x * 180 * dt;
      pickup.y += pull.y * 180 * dt;
    }

    if (Math.hypot(state.player.x - pickup.x, state.player.y - pickup.y) < 36) {
      pickup.collected = true;
      if (pickup.type === "heart") {
        state.player.health = Math.min(state.player.maxHealth, state.player.health + 34);
        state.score += 25;
        playEventSound("pickup");
        addSpark(pickup.x, pickup.y, "#ff8fb1");
      } else {
        refillAmmo();
        state.score += 40;
        renderWeaponBar();
        playEventSound("pickup");
        addSpark(pickup.x, pickup.y, "#89c7ff");
      }
    }
  }

  state.pickups = state.pickups.filter((pickup) => {
    if (pickup.collected) return false;
    return pickup.y < state.player.y + 520;
  });

  state.enemies = state.enemies.filter((enemy) => {
    if (enemy.health <= 0) {
      state.score += enemy.kind === "alien" ? 240 : enemy.kind === "diver" ? 180 : 100;
      addSpark(enemy.x, enemy.y, "#b9d5cc");
      return false;
    }
    return enemy.y < state.player.y + 440;
  });

  for (const spark of state.sparks) {
    spark.x += spark.vx * dt;
    spark.y += spark.vy * dt;
    spark.life -= dt;
  }
  state.sparks = state.sparks.filter((spark) => spark.life > 0);

  const bossDefeated = !state.boss || state.boss.health <= 0;
  const cocoDistance = Math.hypot(state.player.x - state.coco.x, state.player.y - state.coco.y);
  const passedCocoRescue = Math.abs(state.player.x - state.coco.x) < 86 && Math.abs(state.player.y - state.coco.y) < 180;
  if (bossDefeated && (cocoDistance < 58 || passedCocoRescue)) {
    state.coco.rescued = true;
    state.running = false;
    state.paused = false;
    playEventSound("rescue");
    state.score += 1000 + Math.max(0, Math.ceil(state.player.health * 5));
    if (state.stageIndex < stages.length - 1) {
      showStageClear();
    } else {
      state.won = true;
      saveScore();
      stopStageMusic();
      showEnd("코코를 구했어요!", "축하해요, 난 코코예요, 난 너를 사랑해~");
    }
  }

  if (state.player.health <= 0) {
    state.running = false;
    state.paused = false;
    if (state.revives > 0) {
      state.revives -= 1;
      showRevive();
    } else {
      state.lost = true;
      saveScore();
      stopStageMusic();
      playEventSound("fail");
      showEnd("작전 실패", "부활 기회를 모두 사용했습니다. 다시 정비해서 코코에게 가봅시다.");
    }
  }

  distanceEl.textContent = `${state.distance}m`;
  healthEl.textContent = `${Math.max(0, Math.ceil(state.player.health))}`;
  const weapon = activeWeapon();
  weaponEl.textContent = `${weapon.shortName} ${state.ammo[weapon.id] || 0}`;
  scoreEl.textContent = `${state.score}`;
}

function showEnd(title, message) {
  settingsPanel.classList.add("hidden");
  weaponPickerOpen = false;
  stopStageMusic();
  updatePlayUiVisibility();
  overlay.classList.remove("title-screen");
  overlay.querySelector("h1").textContent = title;
  overlay.querySelector("p").textContent = message;
  overlay.querySelector(".brand-mark")?.remove();
  startButton.textContent = "다시 시작";
  overlay.classList.remove("hidden");
}

function showStageClear() {
  state.pendingStageIndex = state.stageIndex + 1;
  settingsPanel.classList.add("hidden");
  weaponPickerOpen = false;
  stopStageMusic();
  updatePlayUiVisibility();
  overlay.classList.remove("title-screen");
  overlay.querySelector("h1").textContent = `${state.stageIndex + 1}스테이지 클리어`;
  overlay.querySelector("p").textContent = state.stageIndex === 0
    ? "잘했어요,하지만 난 코키이니 코코를 구출해주세요"
    : "대단해요,하지만 난 쿠쿠이니 코코를 구출해주세요";
  overlay.querySelector(".brand-mark")?.remove();
  startButton.textContent = `${state.pendingStageIndex + 1}스테이지 시작`;
  overlay.classList.remove("hidden");
}

function showRevive() {
  state.pendingRevive = true;
  settingsPanel.classList.add("hidden");
  weaponPickerOpen = false;
  stopStageMusic();
  updatePlayUiVisibility();
  overlay.classList.remove("title-screen");
  overlay.querySelector("h1").textContent = "캐릭터 부활";
  overlay.querySelector("p").textContent = `남은 부활 ${state.revives}번. 이어서 코코를 구하러 갑니다.`;
  overlay.querySelector(".brand-mark")?.remove();
  startButton.textContent = "이어서 하기";
  overlay.classList.remove("hidden");
}

function drawShadow(x, y, widthValue, heightValue) {
  const screen = worldToScreen(x, y);
  ctx.fillStyle = "rgba(31, 31, 31, 0.22)";
  ctx.beginPath();
  ctx.ellipse(screen.x, screen.y + 18, widthValue, heightValue, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer() {
  const aim = normalize(state.aiming.x, state.aiming.y);
  const screen = worldToScreen(state.player.x, state.player.y);
  const character = selectedCharacter();
  drawShadow(state.player.x, state.player.y, 27, 10);

  ctx.save();
  ctx.translate(screen.x, screen.y);
  ctx.rotate(Math.atan2(aim.y, aim.x) + Math.PI / 2);

  ctx.fillStyle = character.suit;
  ctx.beginPath();
  ctx.roundRect(-17, -14, 34, 42, 12);
  ctx.fill();

  ctx.fillStyle = character.skin;
  ctx.beginPath();
  ctx.arc(0, -20, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = character.hat;
  ctx.beginPath();
  ctx.arc(0, -25, 18, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = character.skin;
  ctx.lineWidth = 7;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-15, -4);
  ctx.lineTo(8, -10);
  ctx.moveTo(16, -3);
  ctx.lineTo(18, -17);
  ctx.stroke();

  ctx.strokeStyle = "#30343b";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(16, -17);
  ctx.lineTo(19, -43);
  ctx.stroke();

  ctx.strokeStyle = "#f4b942";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(19, -43);
  ctx.lineTo(20, -51);
  ctx.stroke();

  ctx.fillStyle = "#fff2b3";
  ctx.beginPath();
  ctx.arc(20, -54, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawEnemy(enemy) {
  if (enemy.kind === "diver") {
    drawDiverEnemy(enemy);
    return;
  }
  if (enemy.kind === "alien") {
    drawAlienEnemy(enemy);
    return;
  }

  const screen = worldToScreen(enemy.x, enemy.y);
  drawShadow(enemy.x, enemy.y, 24, 9);

  ctx.save();
  ctx.translate(screen.x, screen.y);
  ctx.fillStyle = "#6f3d66";
  ctx.beginPath();
  ctx.roundRect(-20, -18, 40, 40, 13);
  ctx.fill();

  ctx.fillStyle = "#2d2030";
  ctx.beginPath();
  ctx.roundRect(-17, -25, 34, 21, 9);
  ctx.fill();

  ctx.fillStyle = "#ffdd8f";
  ctx.beginPath();
  ctx.arc(-7, -15, 3, 0, Math.PI * 2);
  ctx.arc(7, -15, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#2d2030";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-11, 4);
  ctx.lineTo(11, 4);
  ctx.stroke();

  ctx.fillStyle = "#c84f5f";
  ctx.beginPath();
  ctx.arc(-21, 1, 8, 0, Math.PI * 2);
  ctx.arc(21, 1, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawAlienEnemy(enemy) {
  const screen = worldToScreen(enemy.x, enemy.y);
  drawShadow(enemy.x, enemy.y, 28, 10);

  ctx.save();
  ctx.translate(screen.x, screen.y);
  ctx.fillStyle = "#5de09b";
  ctx.beginPath();
  ctx.ellipse(0, -10, 24, 28, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#25325f";
  ctx.beginPath();
  ctx.arc(-9, -16, 7, 0, Math.PI * 2);
  ctx.arc(9, -16, 7, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#cdf7d5";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-16, 14);
  ctx.lineTo(-30, 28);
  ctx.moveTo(16, 14);
  ctx.lineTo(30, 28);
  ctx.moveTo(-14, -34);
  ctx.lineTo(-24, -48);
  ctx.moveTo(14, -34);
  ctx.lineTo(24, -48);
  ctx.stroke();

  ctx.fillStyle = "#f4f78a";
  ctx.beginPath();
  ctx.arc(-24, -48, 5, 0, Math.PI * 2);
  ctx.arc(24, -48, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDiverEnemy(enemy) {
  const screen = worldToScreen(enemy.x, enemy.y);
  drawShadow(enemy.x, enemy.y, 27, 10);

  ctx.save();
  ctx.translate(screen.x, screen.y);
  ctx.fillStyle = "#1f6387";
  ctx.beginPath();
  ctx.roundRect(-22, -18, 44, 43, 14);
  ctx.fill();

  ctx.fillStyle = "#9fe6ff";
  ctx.beginPath();
  ctx.arc(0, -14, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#17384d";
  ctx.beginPath();
  ctx.roundRect(-14, -21, 28, 13, 7);
  ctx.fill();

  ctx.fillStyle = "#fff08a";
  ctx.beginPath();
  ctx.arc(-6, -15, 3, 0, Math.PI * 2);
  ctx.arc(6, -15, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#17384d";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-24, 4);
  ctx.lineTo(-34, -6);
  ctx.moveTo(24, 4);
  ctx.lineTo(34, -6);
  ctx.stroke();
  ctx.restore();
}

function drawBoss() {
  if (!state.boss || state.boss.health <= 0) return;

  const boss = state.boss;
  const screen = worldToScreen(boss.x, boss.y);
  const isSpaceBoss = boss.type === "space";
  drawShadow(boss.x, boss.y, isSpaceBoss ? 55 : 42, isSpaceBoss ? 20 : 15);

  ctx.save();
  ctx.translate(screen.x, screen.y);
  ctx.fillStyle = isSpaceBoss ? "#3c245c" : "#244a87";
  ctx.beginPath();
  ctx.roundRect(isSpaceBoss ? -46 : -36, isSpaceBoss ? -38 : -30, isSpaceBoss ? 92 : 72, isSpaceBoss ? 82 : 66, 18);
  ctx.fill();

  ctx.fillStyle = isSpaceBoss ? "#ff6fbd" : "#5ed1ff";
  ctx.beginPath();
  ctx.arc(0, isSpaceBoss ? -33 : -25, isSpaceBoss ? 34 : 28, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isSpaceBoss ? "#17152e" : "#152c54";
  ctx.beginPath();
  ctx.roundRect(isSpaceBoss ? -28 : -22, isSpaceBoss ? -44 : -34, isSpaceBoss ? 56 : 44, 17, 8);
  ctx.fill();

  ctx.fillStyle = "#fff08a";
  ctx.beginPath();
  ctx.arc(isSpaceBoss ? -14 : -10, isSpaceBoss ? -35 : -26, isSpaceBoss ? 5 : 4, 0, Math.PI * 2);
  ctx.arc(isSpaceBoss ? 14 : 10, isSpaceBoss ? -35 : -26, isSpaceBoss ? 5 : 4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = isSpaceBoss ? "#17152e" : "#152c54";
  ctx.lineWidth = isSpaceBoss ? 10 : 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(isSpaceBoss ? -43 : -34, isSpaceBoss ? -8 : -4);
  ctx.lineTo(isSpaceBoss ? -68 : -52, isSpaceBoss ? -29 : -18);
  ctx.moveTo(isSpaceBoss ? 43 : 34, isSpaceBoss ? -8 : -4);
  ctx.lineTo(isSpaceBoss ? 68 : 52, isSpaceBoss ? -29 : -18);
  ctx.stroke();

  ctx.fillStyle = isSpaceBoss ? "#8cffd2" : "#d64747";
  ctx.beginPath();
  ctx.arc(isSpaceBoss ? -68 : -52, isSpaceBoss ? -29 : -18, isSpaceBoss ? 12 : 10, 0, Math.PI * 2);
  ctx.arc(isSpaceBoss ? 68 : 52, isSpaceBoss ? -29 : -18, isSpaceBoss ? 12 : 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(16, 18, 20, 0.72)";
  ctx.fillRect(-44, 46, 88, 10);
  ctx.fillStyle = "#ff6f91";
  ctx.fillRect(-44, 46, 88 * Math.max(0, boss.health / boss.maxHealth), 10);
  ctx.strokeStyle = "#f7f3e8";
  ctx.lineWidth = 2;
  ctx.strokeRect(-44, 46, 88, 10);
  ctx.restore();
}

function drawPickup(pickup) {
  const screen = worldToScreen(pickup.x, pickup.y);
  const bob = Math.sin(state.time * 5 + pickup.bob) * 4;
  drawShadow(pickup.x, pickup.y, 22, 7);

  ctx.save();
  ctx.translate(screen.x, screen.y + bob);

  if (pickup.type === "heart") {
    ctx.fillStyle = "#fff4f7";
    ctx.beginPath();
    ctx.arc(0, 0, 23, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ff6f91";
    ctx.beginPath();
    ctx.moveTo(0, 15);
    ctx.bezierCurveTo(-24, 0, -16, -18, 0, -8);
    ctx.bezierCurveTo(16, -18, 24, 0, 0, 15);
    ctx.fill();
  } else {
    ctx.fillStyle = "#e8f7ff";
    ctx.beginPath();
    ctx.roundRect(-24, -20, 48, 40, 8);
    ctx.fill();

    ctx.fillStyle = "#4aa3df";
    ctx.beginPath();
    ctx.roundRect(-18, -14, 36, 28, 6);
    ctx.fill();

    ctx.fillStyle = "#fff08a";
    ctx.beginPath();
    ctx.moveTo(2, -13);
    ctx.lineTo(-9, 3);
    ctx.lineTo(1, 3);
    ctx.lineTo(-4, 15);
    ctx.lineTo(12, -4);
    ctx.lineTo(2, -4);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

function drawActor(x, y, radius, color, accent) {
  const screen = worldToScreen(x, y);
  drawShadow(x, y, radius, Math.max(6, radius * 0.34));
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(screen.x, screen.y - radius * 0.28, radius * 0.42, 0, Math.PI * 2);
  ctx.fill();
}

function drawCoco() {
  const stage = stages[state.stageIndex];
  const variant = stage.id === "road" ? "cokey" : stage.id === "sea" ? "kuku" : "coco";
  const fur = variant === "kuku" ? "#ffe1a8" : "#f7f3e8";
  const body = variant === "kuku" ? "#fff0c6" : "#fff7e6";
  const collar = variant === "cokey" ? "#4fae8f" : variant === "kuku" ? "#4aa3df" : "#f4b942";
  const screen = worldToScreen(state.coco.x, state.coco.y);
  drawShadow(state.coco.x, state.coco.y, 31, 10);

  ctx.save();
  ctx.translate(screen.x, screen.y + 46);
  ctx.strokeStyle = fur;
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(14, -2, 20, Math.PI * 0.2, Math.PI * 1.45);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(screen.x, screen.y);

  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 25, 24, 29, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.arc(0, 0, 25, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = fur;
  ctx.beginPath();
  ctx.moveTo(-16, -16);
  ctx.lineTo(-8, -34);
  ctx.lineTo(0, -16);
  ctx.moveTo(16, -16);
  ctx.lineTo(8, -34);
  ctx.lineTo(0, -16);
  ctx.fill();

  ctx.fillStyle = "#ffc3c7";
  ctx.beginPath();
  ctx.moveTo(-13, -18);
  ctx.lineTo(-8, -29);
  ctx.lineTo(-2, -18);
  ctx.moveTo(13, -18);
  ctx.lineTo(8, -29);
  ctx.lineTo(2, -18);
  ctx.fill();

  if (variant === "cokey") {
    ctx.fillStyle = "#9c6b4a";
    ctx.beginPath();
    ctx.arc(-12, -8, 8, 0, Math.PI * 2);
    ctx.arc(10, 20, 7, 0, Math.PI * 2);
    ctx.fill();
  } else if (variant === "kuku") {
    ctx.fillStyle = "#d98643";
    for (const [x, y, r] of [[12, -7, 7], [-13, 20, 6], [8, 31, 5]]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = "#1f2428";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    for (const [x1, y1, x2, y2] of [
      [-16, -18, -5, -33],
      [1, -23, 12, -36],
      [-20, 15, -4, 32],
      [9, 12, 22, 27],
      [-16, 37, 1, 45],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    ctx.save();
    ctx.rotate(-0.28);
    ctx.fillStyle = "#1f2428";
    ctx.beginPath();
    ctx.ellipse(-9, -5, 11, 17, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(16, -16);
    ctx.lineTo(8, -34);
    ctx.lineTo(0, -16);
    ctx.fill();

    ctx.strokeStyle = "#1f2428";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(17, 44, 17, Math.PI * 0.18, Math.PI * 1.05);
    ctx.stroke();
  }

  ctx.fillStyle = variant === "coco" ? "#f7f3e8" : "#26312e";
  ctx.beginPath();
  ctx.arc(-8, -3, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#26312e";
  ctx.beginPath();
  ctx.arc(8, -3, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ff9ca8";
  ctx.beginPath();
  ctx.arc(0, 4, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#26312e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-4, 9);
  ctx.quadraticCurveTo(0, 13, 4, 9);
  ctx.stroke();

  ctx.strokeStyle = "rgba(38, 49, 46, 0.42)";
  ctx.lineWidth = 1.5;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 9, 6);
    ctx.lineTo(side * 24, 2);
    ctx.moveTo(side * 9, 11);
    ctx.lineTo(side * 24, 12);
    ctx.stroke();
  }

  ctx.strokeStyle = collar;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 28, 25, Math.PI * 0.13, Math.PI * 0.87);
  ctx.stroke();

  if (variant !== "coco") {
    ctx.fillStyle = collar;
    ctx.beginPath();
    ctx.roundRect(-10, 35, 20, 7, 3);
    ctx.fill();
  }
  ctx.restore();
}

function drawCrossingCoco(coco) {
  if (coco.hit) return;
  const screen = worldToScreen(coco.x, coco.y);
  if (screen.y < -70 || screen.y > height + 90) return;

  drawShadow(coco.x, coco.y, 22, 8);
  ctx.save();
  ctx.translate(screen.x, screen.y);
  ctx.rotate(coco.direction > 0 ? Math.PI / 2 : -Math.PI / 2);

  ctx.fillStyle = "#fff7e6";
  ctx.beginPath();
  ctx.ellipse(0, 12, 17, 22, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f7f3e8";
  ctx.beginPath();
  ctx.arc(0, -8, 19, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-12, -20);
  ctx.lineTo(-5, -34);
  ctx.lineTo(1, -19);
  ctx.moveTo(12, -20);
  ctx.lineTo(5, -34);
  ctx.lineTo(-1, -19);
  ctx.fill();

  ctx.strokeStyle = "#f4b942";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 11, 19, Math.PI * 0.12, Math.PI * 0.88);
  ctx.stroke();

  ctx.fillStyle = "#ff7a91";
  ctx.beginPath();
  ctx.arc(0, -5, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function draw() {
  drawGrid();
  drawCoco();
  for (const coco of state.crossingCocos) {
    drawCrossingCoco(coco);
  }
  drawBoss();

  for (const pickup of state.pickups) {
    drawPickup(pickup);
  }

  for (const bullet of state.bullets) {
    const screen = worldToScreen(bullet.x, bullet.y);
    ctx.fillStyle = bullet.color || "#ffe27a";
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, bullet.size || 5, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const enemy of state.enemies) {
    drawEnemy(enemy);
  }

  for (const spark of state.sparks) {
    const screen = worldToScreen(spark.x, spark.y);
    ctx.globalAlpha = Math.max(0, spark.life / 0.35);
    ctx.fillStyle = spark.color;
    ctx.fillRect(screen.x - 2, screen.y - 2, 4, 4);
    ctx.globalAlpha = 1;
  }

  drawPlayer();
}

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function updateStick(clientX, clientY) {
  const rect = stick.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const max = rect.width * 0.34;
  const dx = clientX - cx;
  const dy = clientY - cy;
  const length = Math.min(max, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx);
  const x = Math.cos(angle) * length;
  const y = Math.sin(angle) * length;
  thumb.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  state.input.x = x / max;
  state.input.y = y / max;
}

function resetStick() {
  thumb.style.transform = "translate(-50%, -50%)";
  state.input.x = 0;
  state.input.y = 0;
}

stick.addEventListener("pointerdown", (event) => {
  if (state.paused) return;
  stick.setPointerCapture(event.pointerId);
  updateStick(event.clientX, event.clientY);
});

stick.addEventListener("pointermove", (event) => {
  if (stick.hasPointerCapture(event.pointerId)) updateStick(event.clientX, event.clientY);
});

stick.addEventListener("pointerup", resetStick);
stick.addEventListener("pointercancel", resetStick);

shootButton.addEventListener("pointerdown", () => {
  if (state.paused) return;
  state.shootHeld = true;
  shoot();
});
shootButton.addEventListener("pointerup", () => {
  state.shootHeld = false;
});
shootButton.addEventListener("pointercancel", () => {
  state.shootHeld = false;
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && weaponPickerOpen) {
    closeWeaponPicker();
    return;
  }
  if (event.key === "Escape" && state.paused) {
    closeSettings();
    return;
  }
  if (state.paused) return;
  if (event.key === "ArrowLeft" || event.key === "a") state.input.x = -1;
  if (event.key === "ArrowRight" || event.key === "d") state.input.x = 1;
  if (event.key === "ArrowUp" || event.key === "w") state.input.y = -1;
  if (event.key === "ArrowDown" || event.key === "s") state.input.y = 1;
  if (event.key === " ") state.shootHeld = true;
  if (["1", "2", "3", "4", "5"].includes(event.key)) {
    chooseWeapon(weapons[Number(event.key) - 1].id);
  }
});

window.addEventListener("keyup", (event) => {
  if (["ArrowLeft", "ArrowRight", "a", "d"].includes(event.key)) state.input.x = 0;
  if (["ArrowUp", "ArrowDown", "w", "s"].includes(event.key)) state.input.y = 0;
  if (event.key === " ") state.shootHeld = false;
});

startButton.addEventListener("click", () => {
  if (state.pendingRevive) {
    revivePlayer();
    return;
  }
  if (state.pendingStageIndex !== null) {
    startStage(state.pendingStageIndex);
    return;
  }
  resetGame();
});
weaponToggle.addEventListener("click", toggleWeaponPicker);
settingsToggle.addEventListener("click", openSettings);
settingsClose.addEventListener("click", closeSettings);
soundToggle.addEventListener("click", () => setSoundEnabled(!soundEnabled));
window.addEventListener("resize", resize);

renderCharacterSelect();
renderWeaponBar();
renderSoundToggle();
resize();
updatePlayUiVisibility();
const urlOptions = new URLSearchParams(window.location.search);
const quickStage = Number(urlOptions.get("stage"));
if (quickStage >= 1 && quickStage <= stages.length) {
  resetGame();
  if (quickStage > 1) startStage(quickStage - 1);
  if (urlOptions.get("nearCoco") === "1") {
    state.player.y = state.coco.y + 160;
    state.cameraY = state.player.y;
  }
}
requestAnimationFrame(loop);
