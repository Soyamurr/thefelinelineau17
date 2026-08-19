const ASSETS = {
  backgroundGif: "https://file.garden/ajLT4NQpd3Qn0jIC/Core2026.png",
  enemyGif: "https://file.garden/ajLT4NQpd3Qn0jIC/Enemy.gif",
  cats: {
    pink: { idle: "https://file.garden/ajLT4NQpd3Qn0jIC/PinkCat.gif", shoot: null },
    blue: { idle: "https://file.garden/ajLT4NQpd3Qn0jIC/BlueCat.gif", shoot: "https://file.garden/ajLT4NQpd3Qn0jIC/BlueCatShoot.gif" },
    teal: { idle: "https://file.garden/ajLT4NQpd3Qn0jIC/TealCat.gif", shoot: null },
    mix_purple: { idle: "https://file.garden/ajLT4NQpd3Qn0jIC/PurpleMixCat.gif", shoot: "https://file.garden/ajLT4NQpd3Qn0jIC/PurpleMixShoot.gif" },
    mix_rose: { idle: "https://file.garden/ajLT4NQpd3Qn0jIC/RoseMixCat.gif", shoot: null },
    mix_azure: { idle: "https://file.garden/ajLT4NQpd3Qn0jIC/AzureMixCat.gif", shoot: "https://file.garden/ajLT4NQpd3Qn0jIC/AzureMixShoot.gif" }
  },
  music: "assets/audio/loop.ogg",
  sfx: {
    click: "assets/audio/button.mp3", place: "assets/audio/pink.mp3", merge: "assets/audio/teal.mp3",
    shoot: "assets/audio/pow.mp3", enemyDeath: "assets/audio/win.mp3",
    catDeath: "assets/audio/gameover.mp3", finishHit: "assets/audio/gameover.mp3"
  }
};

const BREEDS = {
  pink: { id:"pink", name:"Pink", role:"economy", color:"#d6379e", cost:5, incomeAmount:5, incomeInterval:5, radius:20, fn:"+5 pts every 5s." },
  blue: { id:"blue", name:"Blue", role:"shooter", color:"#4d6fe0", cost:10, dmg:10, atkTime:1, bulletSpeed:260, rowTolerance:26, radius:22, fn:"Shoots enemies in its row." },
  teal: { id:"teal", name:"Teal", role:"wall", color:"#2fb6a3", cost:10, livesMax:3, hpPerLife:32, radius:22, fn:"Blocks enemies; 3 lives." }
};

const key = (a, b) => [a, b].sort().join("-");
const MERGE_WHEEL = {
  [key("blue", "pink")]: { id:"mix_purple", name:"Purple Mix", role:"shooter", color:"#8b5fd1", dmg:15, atkTime:.7, bulletSpeed:280, rowTolerance:26, radius:25, incomeBonus:{amount:3,interval:5}, fn:"Shooter + income." },
  [key("pink", "teal")]: { id:"mix_rose", name:"Rose Mix", role:"wall", color:"#c65a7a", livesMax:5, hpPerLife:32, radius:25, incomeBonus:{amount:3,interval:5}, fn:"5 lives + income." },
  [key("blue", "teal")]: { id:"mix_azure", name:"Azure Mix", role:"shooter", color:"#3f8fbf", dmg:15, atkTime:.7, bulletSpeed:280, rowTolerance:26, radius:25, livesMax:5, hpPerLife:32, fn:"Strong shooter + 5 lives." }
};

const WAVES = [
  { count:3, hp:20, speed:34, gap:1.2 }, { count:4, hp:26, speed:36, gap:1.1 }, { count:5, hp:32, speed:38, gap:1 },
  { count:6, hp:40, speed:42, gap:.9 }, { count:7, hp:50, speed:44, gap:.85 }, { count:9, hp:65, speed:48, gap:.75 }
];

const canvas = document.getElementById("field"), ctx = canvas.getContext("2d");
const W = canvas.width, H = canvas.height, FINISH_X = 26, MERGE_RADIUS = 30;

const pointsLabel = document.getElementById("pointsLabel"), livesLabel = document.getElementById("livesLabel"),
      waveLabel = document.getElementById("waveLabel"), waveTotalLabel = document.getElementById("waveTotalLabel"),
      stateLabel = document.getElementById("stateLabel"), waveBarFill = document.getElementById("waveBarFill"),
      waveBarMarker = document.getElementById("waveBarMarker"), shop = document.getElementById("shop"),
      menuScreen = document.getElementById("menuScreen"), gameScreen = document.getElementById("gameScreen"),
      logEl = document.getElementById("log"), playBtn = document.getElementById("playBtn"),
      quitBtn = document.getElementById("quitBtn"), menuBtn = document.getElementById("menuBtn"),
      restartBtn = document.getElementById("restartBtn"), quitMsg = document.getElementById("quitMsg"),
      wrap = document.getElementById("gameWrap");

let points = 10, lives = 3, cats = [], enemies = [], projectiles = [], waveIndex = -1, waveTimer = 1,
    spawned = 0, waveActive = false, gameOver = false, gameWon = false, last = 0, state = "menu";

const imageCache = new Map(), flash = new Map();
const real = u => typeof u === "string" && u.trim() !== "";

// ---------- audio ----------
// No crossOrigin here on purpose: it forces a CORS preflight the file host may not answer,
// which silently kills the load. We never read pixel/sample data back out, so it's not needed.
const audio = { music: null, musicVolume: .45, sfxVolume: .8, enabled: true };

function setupAudio() {
  if (!real(ASSETS.music)) return;
  audio.music = new Audio(ASSETS.music);
  audio.music.loop = true;
  audio.music.volume = audio.musicVolume;
  audio.music.addEventListener("error", () => console.warn("Music failed to load:", ASSETS.music));
}
function musicPlay() { if (audio.enabled && audio.music) audio.music.play().catch(() => {}) }
function musicStop() { if (audio.music) { audio.music.pause(); audio.music.currentTime = 0 } }
function sfx(n) {
  if (!audio.enabled || !real(ASSETS.sfx[n])) return;
  const a = new Audio(ASSETS.sfx[n]);
  a.volume = audio.sfxVolume;
  a.play().catch(() => {});
}
setupAudio();

function img(u) {
  if (!real(u)) return null;
  if (!imageCache.has(u)) {
    const i = new Image();
    i.onerror = () => console.warn("Image failed to load:", u);
    i.src = u;
    imageCache.set(u, i);
  }
  return imageCache.get(u);
}
function preloadAssets() {
  const urls = [ASSETS.backgroundGif, ASSETS.enemyGif];
  Object.values(ASSETS.cats).forEach(c => urls.push(c.idle, c.shoot));
  urls.filter(real).forEach(img);
}
preloadAssets();

document.getElementById("musicVolume").oninput = e => { audio.musicVolume = +e.target.value; if (audio.music) audio.music.volume = audio.musicVolume };
document.getElementById("sfxVolume").oninput = e => audio.sfxVolume = +e.target.value;
document.getElementById("soundToggle").onclick = () => {
  audio.enabled = !audio.enabled;
  document.getElementById("soundToggle").textContent = "Sound: " + (audio.enabled ? "ON" : "OFF");
  audio.enabled ? musicPlay() : musicStop();
};

// ---------- game state ----------
function reset() {
  points = 10; lives = 3; cats = []; enemies = []; projectiles = [];
  waveIndex = -1; waveTimer = 1; spawned = 0; waveActive = false; gameOver = false; gameWon = false;
  flash.clear();
  lastShopPoints = null; lastShopLocked = null;
  log("Drag a cat from the shop and drop it on the field.");
  hud();
  draw();
}
function log(s) { logEl.textContent = s }

let lastShopPoints = null, lastShopLocked = null;
function hud() {
  pointsLabel.textContent = points;
  livesLabel.textContent = lives;
  waveLabel.textContent = Math.max(0, waveIndex + 1);
  waveTotalLabel.textContent = WAVES.length;
  stateLabel.textContent = gameWon ? "You win!" : gameOver ? "Game over" : "Playing";
  waveBarFill.style.width = (gameWon ? 100 : Math.max(0, waveIndex) / WAVES.length * 100) + "%";
  waveBarMarker.style.left = (WAVES.length - 1) / WAVES.length * 100 + "%";

  // only rebuild the shop DOM when affordability could actually have changed —
  // rebuilding it every frame regardless was wasteful and could interrupt an active drag
  const locked = gameOver || gameWon;
  if (points !== lastShopPoints || locked !== lastShopLocked) {
    shopBuild();
    lastShopPoints = points;
    lastShopLocked = locked;
  }
}
function shopBuild() {
  shop.innerHTML = "";
  Object.values(BREEDS).forEach(b => {
    const e = document.createElement("div"), ok = points >= b.cost;
    e.className = "shop-item" + (ok ? "" : " disabled");
    e.draggable = ok && !gameOver && !gameWon;
    const u = ASSETS.cats[b.id]?.idle;
    e.innerHTML = `<div class="shop-box" style="${real(u) ? `background-image:url('${u}')` : `background:${b.color}`}"></div><div><b>${b.name}</b></div><div class="shop-fn">${b.fn}</div><div class="shop-cost">${b.cost} pts</div>`;
    e.ondragstart = x => { x.dataTransfer.setData("text/plain", b.id); e.classList.add("dragging"); sfx("click") };
    e.ondragend = () => e.classList.remove("dragging");
    shop.appendChild(e);
  });
}

canvas.ondragover = e => { e.preventDefault(); canvas.classList.add("drag-over") };
canvas.ondragleave = () => canvas.classList.remove("drag-over");
canvas.ondrop = e => {
  e.preventDefault();
  canvas.classList.remove("drag-over");
  if (gameOver || gameWon) return;
  const id = e.dataTransfer.getData("text/plain"), d = BREEDS[id];
  if (!d) return;
  const r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
  if (x < FINISH_X + 30) { log("Can't place that close to the finish line."); return }
  const t = cats.find(c => Math.hypot(c.x - x, c.y - y) < MERGE_RADIUS);
  if (t) drop(t, id, d);
  else if (points >= d.cost) { points -= d.cost; cats.push(makeCat(d, id, x, y)); sfx("place"); log(`Placed a ${d.name} cat.`) }
  else log("Not enough points.");
  hud();
};

function makeCat(d, id, x, y, mixed = false) {
  const c = {
    breedId: id, mixed, role: d.role, upgradeLevel: 0, x, y, radius: d.radius, color: d.color, name: d.name,
    livesMax: d.livesMax ?? 1, livesLeft: d.livesMax ?? 1, hpPerLife: d.hpPerLife ?? 20, currentHp: d.hpPerLife ?? 20,
    incomeBonus: d.incomeBonus ? { ...d.incomeBonus, timer: d.incomeBonus.interval } : null
  };
  if (d.role === "economy") { c.incomeAmount = d.incomeAmount; c.incomeInterval = d.incomeInterval; c.incomeTimer = d.incomeInterval }
  else if (d.role === "shooter") { c.dmg = d.dmg; c.atkTime = d.atkTime; c.atkTimer = Math.random() * d.atkTime; c.bulletSpeed = d.bulletSpeed; c.rowTolerance = d.rowTolerance }
  return c;
}

function drop(t, id, d) {
  if (t.mixed) { log("Merged cats cannot merge again."); return }
  if (t.breedId === id) {
    if (t.upgradeLevel >= 2 || points < d.cost) { log(t.upgradeLevel >= 2 ? "Max upgrade." : "Not enough points."); return }
    points -= d.cost;
    t.upgradeLevel++;
    t.radius += 2;
    if (t.role === "economy") t.incomeAmount += 2;
    if (t.role === "shooter") { t.dmg += 6; t.atkTime = Math.max(.35, t.atkTime * .85) }
    if (t.role === "wall") { t.livesMax++; t.livesLeft++ }
    sfx("merge");
    log(`${t.name} upgraded!`);
    return;
  }
  const r = MERGE_WHEEL[key(t.breedId, id)];
  if (!r) { log(`${t.name} and ${d.name} don't merge.`); return }
  if (points < d.cost) { log("Not enough points."); return }
  points -= d.cost;
  cats[cats.indexOf(t)] = makeCat(r, r.id, t.x, t.y, true);
  sfx("merge");
  log(`Merged into ${r.name}!`);
}

function spawn() {
  const w = WAVES[waveIndex];
  enemies.push({ x: W - 20, y: 40 + Math.random() * (H - 80), hp: w.hp, maxHp: w.hp, speed: w.speed, radius: 20, blockedBy: null });
}
function nextWave() {
  waveIndex++;
  if (waveIndex >= WAVES.length) { gameWon = true; log("All waves cleared — you win!"); return }
  spawned = 0; waveActive = true; waveTimer = 0;
  log(waveIndex === WAVES.length - 1 ? "Big wave incoming!" : `Wave ${waveIndex + 1} incoming.`);
}
function shake() {
  wrap.classList.remove("screen-shake");
  void wrap.offsetWidth;
  wrap.classList.add("screen-shake");
  setTimeout(() => wrap.classList.remove("screen-shake"), 300);
}

function update(dt) {
  if (gameOver || gameWon) return;

  if (!waveActive) {
    waveTimer -= dt;
    if (waveTimer <= 0) nextWave();
  } else {
    const w = WAVES[waveIndex];
    waveTimer -= dt;
    if (spawned < w.count && waveTimer <= 0) { spawn(); spawned++; waveTimer = w.gap }
    if (spawned >= w.count && enemies.length === 0) { waveActive = false; waveTimer = 1.5 }
  }

  cats.forEach(c => {
    if (c.incomeBonus && (c.incomeBonus.timer -= dt) <= 0) { points += c.incomeBonus.amount; c.incomeBonus.timer = c.incomeBonus.interval }
    if (c.role === "economy") {
      if ((c.incomeTimer -= dt) <= 0) { points += c.incomeAmount; c.incomeTimer = c.incomeInterval }
    } else if (c.role === "shooter") {
      if ((c.atkTimer -= dt) <= 0 && enemies.some(e => e.x > c.x && Math.abs(e.y - c.y) <= c.rowTolerance + e.radius)) {
        projectiles.push({ x: c.x, y: c.y, vx: c.bulletSpeed, dmg: c.dmg, rowTolerance: c.rowTolerance, color: c.color });
        c.atkTimer = c.atkTime;
        flash.set(c, .18);
        sfx("shoot");
      }
    }
  });

  for (const [c, t] of flash) { if (t - dt <= 0) flash.delete(c); else flash.set(c, t - dt) }

  enemies.forEach(e => {
    if (e.blockedBy && cats.includes(e.blockedBy) && e.blockedBy.livesLeft > 0) {
      const c = e.blockedBy;
      c.currentHp -= 18 * dt;
      if (c.currentHp <= 0) {
        c.livesLeft--;
        c.currentHp = c.hpPerLife;
        e.blockedBy = null;
        if (c.livesLeft <= 0) { cats.splice(cats.indexOf(c), 1); sfx("catDeath"); log(`${c.name} was destroyed.`) }
      }
      return;
    }
    e.blockedBy = null;
    const b = cats.find(c => c.livesLeft > 0 && Math.hypot(c.x - e.x, c.y - e.y) < c.radius + e.radius);
    if (b) e.blockedBy = b;
    else e.x -= e.speed * dt;
  });

  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].x <= FINISH_X) {
      enemies.splice(i, 1);
      lives--;
      shake();
      sfx("finishHit");
      log("An enemy hit the finish line!");
      if (lives <= 0) gameOver = true;
    }
  }

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.vx * dt;
    if (p.x > W) { projectiles.splice(i, 1); continue }
    const h = enemies.find(e => Math.abs(e.y - p.y) <= p.rowTolerance + e.radius && Math.abs(e.x - p.x) <= e.radius);
    if (h) {
      h.hp -= p.dmg;
      projectiles.splice(i, 1);
      if (h.hp <= 0) { points += 3; sfx("enemyDeath"); enemies.splice(enemies.indexOf(h), 1) }
    }
  }

  hud();
}

function imageReady(u) { const i = img(u); return i && i.complete && i.naturalWidth }
function imageDraw(u, x, y, w, h) { if (imageReady(u)) { ctx.drawImage(img(u), x, y, w, h); return true } return false }

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#2ea44f"; ctx.fillRect(6, 6, 18, H - 12);
  cats.forEach(drawCat);
  enemies.forEach(drawEnemy);
  projectiles.forEach(p => { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill() });
  if (gameOver || gameWon) {
    ctx.fillStyle = "#0009"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#fff"; ctx.font = "bold 28px Arial"; ctx.textAlign = "center";
    ctx.fillText(gameWon ? "You win!" : "Game over", W / 2, H / 2);
  }
}
function drawCat(c) {
  const a = ASSETS.cats[c.breedId], u = flash.has(c) && real(a?.shoot) ? a.shoot : a?.idle, r = c.radius;
  if (c.role === "shooter") {
    ctx.globalAlpha = .08; ctx.fillStyle = c.color;
    ctx.fillRect(c.x, c.y - c.rowTolerance, W - c.x, c.rowTolerance * 2);
    ctx.globalAlpha = 1;
  }
  if (!imageDraw(u, c.x - r, c.y - r, r * 2, r * 2)) {
    ctx.fillStyle = c.color; ctx.strokeStyle = "#111";
    ctx.fillRect(c.x - r, c.y - r, r * 2, r * 2);
    ctx.strokeRect(c.x - r, c.y - r, r * 2, r * 2);
  }
  for (let i = 0; i < c.livesMax; i++) { ctx.fillStyle = i < c.livesLeft ? "#111" : "#ddd"; ctx.fillRect(c.x - r + i * 10, c.y + r + 6, 7, 7) }
  if (c.role === "economy") { ctx.fillStyle = "#111"; ctx.font = "bold 10px Arial"; ctx.textAlign = "center"; ctx.fillText("+" + c.incomeAmount, c.x, c.y + r + 14) }
}
function drawEnemy(e) {
  const r = e.radius;
  if (!imageDraw(ASSETS.enemyGif, e.x - r, e.y - r, r * 2, r * 2)) { ctx.fillStyle = "#7a1f1f"; ctx.fillRect(e.x - r, e.y - r, r * 2, r * 2) }
  ctx.fillStyle = "#eee"; ctx.fillRect(e.x - r, e.y - r - 8, r * 2, 4);
  ctx.fillStyle = "#c62828"; ctx.fillRect(e.x - r, e.y - r - 8, r * 2 * Math.max(0, e.hp / e.maxHp), 4);
}

function showMenu() { state = "menu"; menuScreen.classList.remove("hidden"); gameScreen.classList.add("hidden"); musicStop() }
function showGame() { menuScreen.classList.add("hidden"); gameScreen.classList.remove("hidden"); reset(); state = "playing"; musicPlay() }

playBtn.onclick = () => { sfx("click"); showGame() };
menuBtn.onclick = () => { sfx("click"); showMenu() };
restartBtn.onclick = () => { sfx("click"); reset(); musicPlay() };
quitBtn.onclick = () => { sfx("click"); window.close(); quitMsg.textContent = "Browsers usually prevent a page from closing its own tab. Close this tab manually." };

if (real(ASSETS.backgroundGif)) menuScreen.style.backgroundImage = `url("${ASSETS.backgroundGif}")`;
showMenu();

function loop(t) {
  const dt = Math.min(.05, (t - last) / 1000 || 0);
  last = t;
  if (state === "playing") { update(dt); draw() }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);