const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");
const distanceEl = document.querySelector("#distance");
const healthEl = document.querySelector("#health");
const weaponEl = document.querySelector("#weapon");
const scoreEl = document.querySelector("#score");
const overlay = document.querySelector("#overlay");
const startButton = document.querySelector("#start");
const characterSelect = document.querySelector("#characterSelect");
const weaponBar = document.querySelector("#weaponBar");
const settingsToggle = document.querySelector("#settingsToggle");
const settingsPanel = document.querySelector("#settingsPanel");
const settingsClose = document.querySelector("#settingsClose");
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
let selectedCharacterId = localStorage.getItem("coco-rescue-selected-character") || characters[0].id;
if (!characters.some((character) => character.id === selectedCharacterId)) {
  selectedCharacterId = characters[0].id;
  localStorage.setItem("coco-rescue-selected-character", selectedCharacterId);
}

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
  sparks: [],
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
  if (!state.running && settingsPanel.classList.contains("hidden")) return;
  const selected = weapons.find((weapon) => weapon.id === weaponId);
  if (!selected) return;
  if (ammoForWeapon(selected) <= 0) return;
  state.activeWeapon = weaponId;
  const weapon = activeWeapon();
  weaponEl.textContent = `${weapon.shortName} ${ammoForWeapon(weapon)}`;
  renderWeaponBar();
}

function openSettings() {
  if (state.running) {
    state.paused = true;
    state.shootHeld = false;
    resetStick();
    pauseStateEl.textContent = "일시 중단";
  } else {
    pauseStateEl.textContent = "준비 중";
  }
  settingsPanel.classList.remove("hidden");
  renderCharacterSelect();
  renderWeaponBar();
}

function closeSettings() {
  settingsPanel.classList.add("hidden");
  if (state.running && !state.won && !state.lost) {
    state.paused = false;
  }
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
  state.bullets = [];
  state.enemies = [];
  state.pickups = [
    { x: 0, y: -620, type: "ammo", bob: 0 },
    { x: -90, y: -1040, type: "heart", bob: Math.PI },
  ];
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
}

function revivePlayer() {
  state.pendingRevive = false;
  state.running = true;
  state.paused = false;
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
}

function worldToScreen(x, y) {
  return {
    x: width / 2 + x,
    y: height * 0.64 + y - state.cameraY,
  };
}

function drawGrid() {
  const stage = stages[state.stageIndex];
  ctx.fillStyle = stage.id === "sea" ? "#4aaed8" : "#6fc7a1";
  ctx.fillRect(0, 0, width, height);

  const grid = 80;
  const startY = Math.floor((state.cameraY - height) / grid) * grid;

  if (stage.id === "sea") {
    drawSea(startY);
    ctx.fillStyle = "#8a6a45";
    ctx.fillRect(width / 2 - 184, 0, 368, height);
    ctx.fillStyle = "#b98550";
    ctx.fillRect(width / 2 - 166, 0, 332, height);
  } else {
    ctx.fillStyle = "#d7b77d";
    ctx.fillRect(width / 2 - 190, 0, 380, height);
    ctx.fillStyle = "#edcf91";
    ctx.fillRect(width / 2 - 170, 0, 340, height);
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
    ctx.fillStyle = stage.id === "sea" ? "rgba(66, 38, 20, 0.18)" : "rgba(255, 255, 255, 0.12)";
    ctx.fillRect(width / 2 - 170, sy, 340, 2);
  }

  for (let y = startY; y < state.cameraY + height; y += 210) {
    if (stage.id === "sea") {
      drawWave(-250, y, 1);
      drawWave(260, y + 110, 1.16);
      drawBuoy(-305, y + 62);
      drawBuoy(310, y + 168);
    } else {
      drawBush(-245, y, 1 + ((Math.floor(y / 210) % 2) * 0.12));
      drawBush(245, y + 90, 1);
      drawFlower(-300, y + 62, "#ffd35a");
      drawFlower(302, y + 154, "#ff8fb1");
    }
  }
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
      const isSpecial = stage.id === "sea" && Math.random() < stage.specialEnemyChance;
      state.enemies.push({
        x: (Math.random() - 0.5) * Math.min(width * 0.72, 520),
        y: enemySpawnY - Math.random() * 220,
        health: isSpecial ? stage.enemyHealth + 2 : stage.enemyHealth,
        speed: stage.enemySpeed + Math.random() * stage.enemySpeedBonus + (isSpecial ? 20 : 0),
        kind: isSpecial ? "diver" : "bandit",
      });
    }
    enemySpawnY -= stage.enemyGap + Math.random() * stage.enemyGapBonus;
  }
}

function spawnPickups() {
  while (pickupSpawnY > state.player.y - 1300 && pickupSpawnY > state.coco.y + 220) {
    const isHeart = Math.random() < 0.38;
    state.pickups.push({
      x: (Math.random() - 0.5) * Math.min(width * 0.42, 260),
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

  for (let i = 0; i < 20; i += 1) {
    addSpark(bullet.x, bullet.y, "#96d36c");
  }
}

function update(dt) {
  if (!state.running) return;
  if (state.paused) return;

  state.time += dt;
  state.cooldown = Math.max(0, state.cooldown - dt);

  const character = selectedCharacter();
  const forward = -105;
  const moveX = state.input.x * 185 * character.speed;
  const moveY = (Math.min(state.input.y * 145, 60) + forward) * character.speed;
  state.player.x += moveX * dt;
  state.player.y += moveY * dt;
  state.player.x = Math.max(-width * 0.38, Math.min(width * 0.38, state.player.x));
  state.distance = Math.max(0, Math.floor(Math.abs(state.player.y) / 10));
  state.cameraY += (state.player.y - state.cameraY) * Math.min(1, dt * 7);

  if (Math.hypot(state.input.x, state.input.y) > 0.18) {
    state.aiming.x = state.input.x;
    state.aiming.y = Math.min(-0.2, state.input.y);
  }

  if (state.shootHeld) shoot();
  spawnEnemies();
  spawnPickups();

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
      addSpark(enemy.x, enemy.y, "#d64747");
    }
  }

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
        addSpark(pickup.x, pickup.y, "#ff8fb1");
      } else {
        refillAmmo();
        state.score += 40;
        renderWeaponBar();
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
      state.score += enemy.kind === "diver" ? 180 : 100;
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

  if (Math.hypot(state.player.x - state.coco.x, state.player.y - state.coco.y) < 52) {
    state.coco.rescued = true;
    state.running = false;
    state.paused = false;
    state.score += 1000 + Math.max(0, Math.ceil(state.player.health * 5));
    if (state.stageIndex < stages.length - 1) {
      showStageClear();
    } else {
      state.won = true;
      saveScore();
      showEnd("코코를 구했어요!", "바다까지 지나 코코를 무사히 구했습니다.");
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
  overlay.classList.remove("title-screen");
  overlay.querySelector("h1").textContent = "1스테이지 클리어";
  overlay.querySelector("p").textContent = "다음은 바다입니다. 더 많은 악당을 물리치고 코코를 다시 찾아가세요.";
  overlay.querySelector(".brand-mark")?.remove();
  startButton.textContent = "2스테이지 시작";
  overlay.classList.remove("hidden");
}

function showRevive() {
  state.pendingRevive = true;
  settingsPanel.classList.add("hidden");
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
  const screen = worldToScreen(state.coco.x, state.coco.y);
  drawShadow(state.coco.x, state.coco.y, 31, 10);

  ctx.save();
  ctx.translate(screen.x, screen.y + 46);
  ctx.strokeStyle = "#f7f3e8";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(14, -2, 20, Math.PI * 0.2, Math.PI * 1.45);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(screen.x, screen.y);

  ctx.fillStyle = "#fff7e6";
  ctx.beginPath();
  ctx.ellipse(0, 25, 24, 29, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f7f3e8";
  ctx.beginPath();
  ctx.arc(0, 0, 25, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f7f3e8";
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

  ctx.fillStyle = "#26312e";
  ctx.beginPath();
  ctx.arc(-8, -3, 3, 0, Math.PI * 2);
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

  ctx.strokeStyle = "#f4b942";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 28, 25, Math.PI * 0.13, Math.PI * 0.87);
  ctx.stroke();
  ctx.restore();
}

function draw() {
  drawGrid();
  drawCoco();

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
settingsToggle.addEventListener("click", openSettings);
settingsClose.addEventListener("click", closeSettings);
window.addEventListener("resize", resize);

renderCharacterSelect();
renderWeaponBar();
resize();
requestAnimationFrame(loop);
