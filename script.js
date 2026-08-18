const BREEDS = {
  pink: { id:'pink', name:'Pink', role:'economy', color:'#d6379e', cost:5,
          incomeAmount:5, incomeInterval:5, radius:20,
          fn:'+5 pts every 5s. No attack.' },
  blue: { id:'blue', name:'Blue', role:'shooter', color:'#4d6fe0', cost:10,
          dmg:10, atkTime:1.0, bulletSpeed:260, rowTolerance:26, radius:22,
          fn:'Shoots bullets horizontally at zombies in its row.' },
  teal: { id:'teal', name:'Teal', role:'wall', color:'#2fb6a3', cost:10,
          livesMax:3, hpPerLife:32, radius:22,
          fn:'Blocks 3 zombies (1 life each), then breaks. No attack.' },
};

function mergeKey(a,b){ return [a,b].sort().join('-'); }

const MERGE_WHEEL = {
  [mergeKey('blue','pink')]: { id:'mix_purple', name:'Purple Mix', role:'shooter', color:'#8b5fd1',
    dmg:15, atkTime:0.7, bulletSpeed:280, rowTolerance:26, radius:25,
    incomeBonus:{ amount:3, interval:5 },
    fn:'Shooter + trickle income (+3 pts/5s).' },
  [mergeKey('pink','teal')]: { id:'mix_rose', name:'Rose Mix', role:'wall', color:'#c65a7a',
    livesMax:5, hpPerLife:32, radius:25,
    incomeBonus:{ amount:3, interval:5 },
    fn:'Wall (5 lives) + trickle income (+3 pts/5s).' },
  [mergeKey('blue','teal')]: { id:'mix_azure', name:'Azure Mix', role:'shooter', color:'#3f8fbf',
    dmg:15, atkTime:0.7, bulletSpeed:280, rowTolerance:26, livesMax:5, hpPerLife:32, radius:25,
    fn:'Heavier, faster-firing shooter with 5 lives.' },
};

const WAVES = [
  { count:3, hp:20, speed:34, gap:1.2 },
  { count:4, hp:26, speed:36, gap:1.1 },
  { count:5, hp:32, speed:38, gap:1.0 },
  { count:6, hp:40, speed:42, gap:0.9 },
  { count:7, hp:50, speed:44, gap:0.85 },
  { count:9, hp:65, speed:48, gap:0.75 },
];
const BIG_WAVE_INDEX = WAVES.length - 1;
const CHIP_DAMAGE_PER_SEC = 18;
const NON_WALL_HP_PER_LIFE = 20;

const canvas = document.getElementById('field');
const ctx = canvas.getContext('2d');
const FIELD_W = canvas.width, FIELD_H = canvas.height;
const FINISH_X = 26;
const MERGE_RADIUS = 30;

let points, lives, cats, enemies, projectiles;
let waveIndex, waveTimer, spawnedInWave, waveActive, gameOver, gameWon;
let lastTime = 0;
let screenState = 'menu';

function resetGame() {
  points = 10;
  lives = 3;
  cats = [];
  enemies = [];
  projectiles = [];
  waveIndex = -1;
  waveTimer = 1.0;
  spawnedInWave = 0;
  waveActive = false;
  gameOver = false;
  gameWon = false;
  log('Drag a cat from the shop and drop it on the field.');
  updateHUD();
  buildShop();
}

function log(msg) { document.getElementById('log').textContent = msg; }

function updateHUD() {
  document.getElementById('pointsLabel').textContent = points;
  document.getElementById('livesLabel').textContent = lives;
  document.getElementById('waveLabel').textContent = Math.max(0, waveIndex + 1);
  document.getElementById('waveTotalLabel').textContent = WAVES.length;
  document.getElementById('stateLabel').textContent = gameWon ? 'You win!' : gameOver ? 'Game over' : 'Playing';
  updateWaveBar();
  buildShop();
}

function updateWaveBar() {
  const progress = gameWon ? 1 : Math.max(0, waveIndex) / WAVES.length;
  document.getElementById('waveBarFill').style.width = (progress * 100) + '%';
  document.getElementById('waveBarMarker').style.left = ((BIG_WAVE_INDEX / WAVES.length) * 100) + '%';
}

function buildShop() {
  const shop = document.getElementById('shop');
  shop.innerHTML = '';
  Object.values(BREEDS).forEach(b => {
    const el = document.createElement('div');
    const affordable = points >= b.cost;
    el.className = 'shop-item' + (affordable ? '' : ' disabled');
    el.draggable = affordable && !gameOver && !gameWon;
    el.innerHTML = `<div class="shop-box" style="background:${b.color}"></div>
                     <div class="shop-name">${b.name}</div>
                     <div class="shop-fn">${b.fn}</div>
                     <div class="shop-cost">${b.cost} pts</div>`;
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', b.id);
      e.dataTransfer.effectAllowed = 'copy';
      el.classList.add('dragging');
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
    shop.appendChild(el);
  });
}

canvas.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
  canvas.classList.add('drag-over');
});
canvas.addEventListener('dragleave', () => canvas.classList.remove('drag-over'));
canvas.addEventListener('drop', (e) => {
  e.preventDefault();
  canvas.classList.remove('drag-over');
  if (gameOver || gameWon) return;
  const breedId = e.dataTransfer.getData('text/plain');
  const breedDef = BREEDS[breedId];
  if (!breedDef) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (x < FINISH_X + 30) { log("Can't place that close to the finish line."); return; }
  const target = cats.find(c => Math.hypot(c.x - x, c.y - y) < MERGE_RADIUS);
  if (target) {
    handleDrop(target, breedId, breedDef);
  } else {
    if (points < breedDef.cost) { log('Not enough points.'); return; }
    points -= breedDef.cost;
    cats.push(makeCat(breedDef, breedId, x, y));
    log(`Placed a ${breedDef.name} cat (${breedDef.role}).`);
  }
  updateHUD();
});

function makeCat(def, breedId, x, y, mixed=false) {
  const livesMax = def.livesMax !== undefined ? def.livesMax : 1;
  const hpPerLife = def.hpPerLife !== undefined ? def.hpPerLife : NON_WALL_HP_PER_LIFE;
  const cat = {
    breedId, mixed,
    role: def.role,
    upgradeLevel: 0,
    x, y,
    radius: def.radius,
    color: def.color,
    name: def.name,
    incomeBonus: def.incomeBonus ? { ...def.incomeBonus, timer: def.incomeBonus.interval } : null,
    livesMax, livesLeft: livesMax, hpPerLife, currentHp: hpPerLife,
  };
  if (def.role === 'economy') {
    cat.incomeAmount = def.incomeAmount;
    cat.incomeInterval = def.incomeInterval;
    cat.incomeTimer = def.incomeInterval;
  } else if (def.role === 'shooter') {
    cat.dmg = def.dmg;
    cat.atkTime = def.atkTime;
    cat.atkTimer = Math.random() * def.atkTime;
    cat.bulletSpeed = def.bulletSpeed;
    cat.rowTolerance = def.rowTolerance;
  }
  return cat;
}

function handleDrop(target, breedId, breedDef) {
  if (target.mixed) { log(`${target.name} is already a merged cat and can't merge again.`); return; }
  if (target.breedId === breedId) {
    if (target.upgradeLevel >= 2) { log(`${target.name} is already at max upgrade.`); return; }
    if (points < breedDef.cost) { log('Not enough points to upgrade.'); return; }
    points -= breedDef.cost;
    target.upgradeLevel += 1;
    target.radius += 2;
    if (target.role === 'economy') {
      target.incomeAmount += 2;
    } else if (target.role === 'shooter') {
      target.dmg += 6;
      target.atkTime = Math.max(0.35, target.atkTime * 0.85);
    } else if (target.role === 'wall') {
      target.livesMax += 1;
      target.livesLeft += 1;
    }
    log(`${target.name} upgraded to level ${target.upgradeLevel}!`);
    return;
  }
  const key = mergeKey(target.breedId, breedId);
  const result = MERGE_WHEEL[key];
  if (!result) { log(`${target.name} and ${breedDef.name} don't merge together.`); return; }
  if (points < breedDef.cost) { log('Not enough points to merge.'); return; }
  points -= breedDef.cost;
  const idx = cats.indexOf(target);
  cats[idx] = makeCat(result, result.id, target.x, target.y, true);
  log(`Merged into a ${result.name} cat!`);
}

function startNextWave() {
  waveIndex++;
  if (waveIndex >= WAVES.length) { gameWon = true; log('All waves cleared — you win!'); return; }
  spawnedInWave = 0;
  waveActive = true;
  waveTimer = 0;
  log(waveIndex === BIG_WAVE_INDEX ? 'Big wave incoming!' : `Wave ${waveIndex + 1} incoming.`);
}

function spawnEnemy() {
  const w = WAVES[waveIndex];
  enemies.push({
    x: FIELD_W - 20,
    y: 40 + Math.random() * (FIELD_H - 80),
    hp: w.hp, maxHp: w.hp,
    speed: w.speed,
    radius: 20,
    blockedBy: null,
  });
}

function update(dt) {
  if (gameOver || gameWon) return;

  if (!waveActive) {
    waveTimer -= dt;
    if (waveTimer <= 0) startNextWave();
  } else {
    const w = WAVES[waveIndex];
    waveTimer -= dt;
    if (spawnedInWave < w.count && waveTimer <= 0) {
      spawnEnemy();
      spawnedInWave++;
      waveTimer = w.gap;
    }
    if (spawnedInWave >= w.count && enemies.length === 0) {
      waveActive = false;
      waveTimer = 1.5;
    }
  }

  for (const cat of cats) {
    if (cat.incomeBonus) {
      cat.incomeBonus.timer -= dt;
      if (cat.incomeBonus.timer <= 0) {
        points += cat.incomeBonus.amount;
        cat.incomeBonus.timer = cat.incomeBonus.interval;
      }
    }
    if (cat.role === 'economy') {
      cat.incomeTimer -= dt;
      if (cat.incomeTimer <= 0) {
        points += cat.incomeAmount;
        cat.incomeTimer = cat.incomeInterval;
      }
    } else if (cat.role === 'shooter') {
      cat.atkTimer -= dt;
      if (cat.atkTimer <= 0) {
        const hasTarget = enemies.some(en =>
          en.x > cat.x && Math.abs(en.y - cat.y) <= cat.rowTolerance + en.radius);
        if (hasTarget) {
          projectiles.push({ x: cat.x, y: cat.y, vx: cat.bulletSpeed, dmg: cat.dmg,
                              rowTolerance: cat.rowTolerance, color: cat.color });
          cat.atkTimer = cat.atkTime;
        }
      }
    }
  }

  for (const en of enemies) {
    if (en.blockedBy && cats.includes(en.blockedBy) && en.blockedBy.livesLeft > 0) {
      const blocker = en.blockedBy;
      blocker.currentHp -= CHIP_DAMAGE_PER_SEC * dt;
      if (blocker.currentHp <= 0) {
        blocker.livesLeft -= 1;
        blocker.currentHp = blocker.hpPerLife;
        en.blockedBy = null;
        if (blocker.livesLeft <= 0) {
          const bi = cats.indexOf(blocker);
          if (bi >= 0) cats.splice(bi, 1);
          log(blocker.role === 'wall'
            ? `${blocker.name} broke after blocking ${blocker.livesMax} zombies.`
            : `${blocker.name} was killed by a zombie.`);
        }
      }
      continue;
    }
    en.blockedBy = null;
    const blocker = cats.find(c => c.livesLeft > 0 &&
      Math.hypot(c.x - en.x, c.y - en.y) < c.radius + en.radius);
    if (blocker) {
      en.blockedBy = blocker;
      continue;
    }
    en.x -= en.speed * dt;
  }

  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].x <= FINISH_X) {
      enemies.splice(i, 1);
      lives -= 1;
      if (lives <= 0) { gameOver = true; log('The finish line was overrun :('); }
    }
  }

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.vx * dt;
    if (p.x > FIELD_W) { projectiles.splice(i, 1); continue; }
    const hit = enemies.find(en =>
      Math.abs(en.y - p.y) <= p.rowTolerance + en.radius &&
      Math.abs(en.x - p.x) <= en.radius);
    if (hit) {
      hit.hp -= p.dmg;
      projectiles.splice(i, 1);
      if (hit.hp <= 0) {
        points += 3;
        const idx = enemies.indexOf(hit);
        if (idx >= 0) enemies.splice(idx, 1);
      }
    }
  }

  updateHUD();
}

function draw() {
  ctx.clearRect(0, 0, FIELD_W, FIELD_H);

  ctx.fillStyle = '#2ea44f';
  ctx.fillRect(6, 6, 18, FIELD_H - 12);

  for (const cat of cats) {
    if (cat.role === 'shooter') {
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = cat.color;
      ctx.fillRect(cat.x, cat.y - cat.rowTolerance, FIELD_W - cat.x, cat.rowTolerance * 2);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = cat.color;
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    const r = cat.radius;
    ctx.fillRect(cat.x - r, cat.y - r, r * 2, r * 2);
    ctx.strokeRect(cat.x - r, cat.y - r, r * 2, r * 2);

    if (cat.upgradeLevel > 0) {
      ctx.strokeStyle = '#e8b93a';
      ctx.lineWidth = 2;
      for (let k = 0; k < cat.upgradeLevel; k++) {
        ctx.strokeRect(cat.x - r - 4 - k*4, cat.y - r - 4 - k*4, (r + 4 + k*4) * 2, (r + 4 + k*4) * 2);
      }
    }

    for (let li = 0; li < cat.livesMax; li++) {
      ctx.fillStyle = li < cat.livesLeft ? '#111' : '#ddd';
      ctx.fillRect(cat.x - r + li * 10, cat.y + r + 6, 7, 7);
    }
    if (cat.role === 'economy') {
      ctx.fillStyle = '#111';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('+' + cat.incomeAmount, cat.x, cat.y + r + 14);
    }
  }

  for (const en of enemies) {
    ctx.fillStyle = '#7a1f1f';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.fillRect(en.x - en.radius, en.y - en.radius, en.radius * 2, en.radius * 2);
    ctx.strokeRect(en.x - en.radius, en.y - en.radius, en.radius * 2, en.radius * 2);
    const hpw = en.radius * 2;
    ctx.fillStyle = '#eee';
    ctx.fillRect(en.x - en.radius, en.y - en.radius - 8, hpw, 4);
    ctx.fillStyle = '#c62828';
    ctx.fillRect(en.x - en.radius, en.y - en.radius - 8, hpw * (en.hp / en.maxHp), 4);
  }

  for (const p of projectiles) {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  if (gameOver || gameWon) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, FIELD_W, FIELD_H);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(gameWon ? 'You win!' : 'Game over', FIELD_W / 2, FIELD_H / 2);
  }
}

function loop(t) {
  const dt = Math.min(0.05, (t - lastTime) / 1000 || 0);
  lastTime = t;
  if (screenState === 'playing') {
    update(dt);
    draw();
  }
  requestAnimationFrame(loop);
}

function showMenu() {
  screenState = 'menu';
  document.getElementById('menuScreen').classList.remove('hidden');
  document.getElementById('gameScreen').classList.add('hidden');
  document.getElementById('quitMsg').textContent = '';
}

function showGame() {
  document.getElementById('menuScreen').classList.add('hidden');
  document.getElementById('gameScreen').classList.remove('hidden');
  resetGame();
  screenState = 'playing';
}

document.getElementById('playBtn').onclick = showGame;
document.getElementById('quitBtn').onclick = () => {
  window.close();
  document.getElementById('quitMsg').textContent =
    "Your browser won't let a page close its own tab — you can close this tab manually.";
};
document.getElementById('menuBtn').onclick = showMenu;
document.getElementById('restartBtn').onclick = resetGame;

showMenu();
requestAnimationFrame(loop);