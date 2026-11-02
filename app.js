/**
 * PHYSARUM POLYCEPHALUM SIMULATION ENGINE v4.0
 *
 * The visual model uses a normalized 360-tick lifecycle:
 *   0–126  exploratory foraging
 *   126–234 food contact and cytoplasmic flow
 *   234–360 pruning and reinforcement
 *
 * It is intentionally dependency-free so it can run on GitHub Pages.
 */

(() => {
  const TAU = Math.PI * 2;
  const BIO_TICKS = 360;
  const STAGE_ONE_END = 126;
  const STAGE_TWO_END = 234;
  const TICKS_PER_HOUR = BIO_TICKS / 12;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function fitCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(1, Math.round(height * dpr));
    const dprKey = String(dpr);

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight || canvas.dataset.dpr !== dprKey) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
      canvas.dataset.dpr = dprKey;
    }

    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return [width, height, ctx];
  }

  function createOrganicBranch(points, jitter = 8, steps = 12) {
    const result = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      const start = points[i];
      const end = points[i + 1];
      for (let step = 0; step <= steps; step += 1) {
        if (i > 0 && step === 0) continue;
        const q = step / steps;
        const isEndpoint = step === 0 || step === steps;
        result.push({
          x: start.x + (end.x - start.x) * q + (isEndpoint ? 0 : rand(-jitter, jitter)),
          y: start.y + (end.y - start.y) * q + (isEndpoint ? 0 : rand(-jitter, jitter))
        });
      }
    }
    return result;
  }

  function drawVein(ctx, points, progress, opacity, color, width, glow, time, pulse = true) {
    if (!points || points.length < 2 || opacity <= 0.01) return;
    const count = Math.floor(clamp(progress, 0, 1) * (points.length - 1));
    if (count < 1) return;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i <= count; i += 1) {
      const point = points[i];
      const wave = pulse ? Math.sin(time * 0.08 + i * 0.32) * 0.55 : 0;
      ctx.lineTo(point.x + wave, point.y + wave);
    }
    ctx.globalAlpha = opacity;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.shadowBlur = glow;
    ctx.shadowColor = color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.restore();
  }

  // Nakagaki's maze: 0 is open corridor, 1 is a wall.
  const MAZE_GRID = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,1,0,0,0,0,0,0,0,0,0,1],
    [1,0,1,0,1,0,1,1,1,1,1,0,1,0,1],
    [1,0,1,0,0,0,0,0,0,0,1,0,1,0,1],
    [1,0,1,1,1,1,1,0,1,0,1,0,1,0,1],
    [1,0,0,0,0,0,1,0,1,0,0,0,1,0,1],
    [1,1,1,0,1,0,1,0,1,1,1,0,1,0,1],
    [1,0,0,0,1,0,0,0,0,0,1,0,0,0,1],
    [1,0,1,1,1,1,1,1,1,0,1,1,1,0,1],
    [1,0,0,0,0,0,0,0,1,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ];

  function cellKey(col, row) {
    return `${col},${row}`;
  }

  function findMazeCorridorPath(start, end) {
    const [startCol, startRow] = start;
    const [endCol, endRow] = end;
    if (MAZE_GRID[startRow]?.[startCol] !== 0 || MAZE_GRID[endRow]?.[endCol] !== 0) return [];

    const queue = [[startCol, startRow]];
    const visited = new Set([cellKey(startCol, startRow)]);
    const previous = new Map();
    const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    while (queue.length) {
      const [col, row] = queue.shift();
      if (col === endCol && row === endRow) break;
      directions.forEach(([dc, dr]) => {
        const nextCol = col + dc;
        const nextRow = row + dr;
        const key = cellKey(nextCol, nextRow);
        if (MAZE_GRID[nextRow]?.[nextCol] === 0 && !visited.has(key)) {
          visited.add(key);
          previous.set(key, [col, row]);
          queue.push([nextCol, nextRow]);
        }
      });
    }

    const endKey = cellKey(endCol, endRow);
    if (!visited.has(endKey)) return [];
    const path = [];
    let current = [endCol, endRow];
    while (current) {
      path.unshift(current);
      current = previous.get(cellKey(current[0], current[1]));
    }
    return path;
  }

  function getClosestCorridorCell(x, y, geometry) {
    const col = clamp(Math.floor((x - geometry.offsetX) / geometry.cellW), 0, geometry.cols - 1);
    const row = clamp(Math.floor((y - geometry.offsetY) / geometry.cellH), 0, geometry.rows - 1);
    if (MAZE_GRID[row][col] === 0) return [col, row];

    let best = [1, 1];
    let bestDistance = Infinity;
    for (let r = 0; r < geometry.rows; r += 1) {
      for (let c = 0; c < geometry.cols; c += 1) {
        if (MAZE_GRID[r][c] !== 0) continue;
        const distance = Math.hypot(c - col, r - row);
        if (distance < bestDistance) {
          best = [c, r];
          bestDistance = distance;
        }
      }
    }
    return best;
  }

  function cellPathToPoints(path, geometry) {
    return path.map(([col, row]) => ({
      x: geometry.offsetX + (col + 0.5) * geometry.cellW,
      y: geometry.offsetY + (row + 0.5) * geometry.cellH
    }));
  }

  const MUMBAI_STATIONS = [
    { name: 'Churchgate', x: 0.24, y: 0.86 }, { name: 'CST', x: 0.32, y: 0.82 }, { name: 'Dadar', x: 0.36, y: 0.62 },
    { name: 'Bandra', x: 0.35, y: 0.50 }, { name: 'Andheri', x: 0.38, y: 0.36 }, { name: 'Borivali', x: 0.38, y: 0.20 },
    { name: 'Kurla', x: 0.48, y: 0.52 }, { name: 'Ghatkopar', x: 0.54, y: 0.42 }, { name: 'Thane', x: 0.70, y: 0.22 },
    { name: 'Vashi', x: 0.75, y: 0.58 }, { name: 'Panvel', x: 0.84, y: 0.80 }
  ];
  const MUMBAI_LINES = [[0, 2, 3, 4, 5], [1, 2, 6, 7, 8], [1, 6, 9, 10], [4, 7]];

  function phaseForTick(tick) {
    if (tick < STAGE_ONE_END) {
      return { label: 'Stage 1 / Exploratory Foraging', deadendOpacity: clamp(tick / STAGE_ONE_END, 0, 1) * 0.78 };
    }
    if (tick < STAGE_TWO_END) return { label: 'Stage 2 / Food Contact & Cytoplasmic Flow', deadendOpacity: 0.78 };
    const fade = clamp((tick - STAGE_TWO_END) / (BIO_TICKS - STAGE_TWO_END), 0, 1);
    return { label: 'Stage 3 / Pruning to Optimal Network', deadendOpacity: 0.78 * (1 - fade) };
  }

  function updateLifecycle(phaseEl, timerEl, tick) {
    const phase = phaseForTick(tick);
    if (phaseEl) phaseEl.textContent = phase.label;
    if (timerEl) {
      const hours = (Math.min(tick, BIO_TICKS) / TICKS_PER_HOUR).toFixed(1);
      timerEl.textContent = `⏱️ ${hours} hrs${tick >= BIO_TICKS ? ' (Optimal Path Found)' : ''}`;
    }
    return phase;
  }

  function hero() {
    const canvas = document.getElementById('heroCanvas');
    if (!canvas) return;
    const particles = [];
    function frame() {
      const [width, height, ctx] = fitCanvas(canvas);
      if (!particles.length) {
        for (let i = 0; i < 42; i += 1) particles.push({ x: width / 2 + rand(-15, 15), y: height / 2 + rand(-15, 15), a: rand(0, TAU), speed: rand(0.6, 1.2) });
      }
      ctx.fillStyle = 'rgba(7, 16, 29, 0.2)';
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';
      particles.forEach((particle) => {
        particle.a += rand(-0.035, 0.035);
        particle.x = clamp(particle.x + Math.cos(particle.a) * particle.speed, 20, width - 20);
        particle.y = clamp(particle.y + Math.sin(particle.a) * particle.speed, 20, height - 20);
        ctx.strokeStyle = 'rgba(243, 190, 56, 0.35)';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(particle.x, particle.y);
        ctx.lineTo(particle.x - Math.cos(particle.a) * 18, particle.y - Math.sin(particle.a) * 18);
        ctx.stroke();
        ctx.fillStyle = '#f3be38';
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, 1.5, 0, TAU);
        ctx.fill();
      });
      ctx.globalCompositeOperation = 'source-over';
      requestAnimationFrame(frame);
    }
    frame();
  }

  function growth() {
    const canvas = document.getElementById('growthCanvas');
    if (!canvas) return;
    const startBtn = document.getElementById('growthStart');
    const resetBtn = document.getElementById('growthReset');
    const phaseEl = document.getElementById('growthPhase');
    const timerEl = document.getElementById('timerText');
    const explainEl = document.getElementById('simExplain');
    const clickHint = document.getElementById('clickHint');
    const labTitle = document.getElementById('labTitle');
    const interactiveModes = new Set(['maze', 'food', 'tsp']);
    const copyTexts = {
      maze: "Nakagaki's Maze Experiment (2000): the mould explores every open corridor, reaches the food sources, and reinforces only corridor-safe routes.",
      food: 'The central plasmodium grows outward in all directions, senses oat flakes, and reinforces useful connecting veins. Click or tap to place more food sources.',
      tsp: 'Candidate routes grow between food points before the strongest connected tour remains. Click or tap to add another point to the network.',
      tokyo: 'BBC 2010 Tokyo Rail Experiment (Atsushi Tero): growth from Tokyo Central reproduces the Yamanote Ring and regional rail topology.',
      mumbai: 'Mumbai suburban hubs act as food sources. The simulated organism explores the network, then reinforces the most useful corridors.',
      cosmic: 'Galaxy clusters act like food sources while slime-like filaments trace the hidden cosmic web.'
    };
    const titles = { maze: 'NAKAGAKI MAZE EXPERIMENT', food: 'CENTRAL PLASMODIUM / FOOD SEARCH', tsp: 'CONNECTED FOOD TOUR', tokyo: 'TOKYO RAIL NETWORK / BBC 2010', mumbai: 'MUMBAI SUBURBAN NETWORK', cosmic: 'COSMIC WEB ANALOGY' };
    let mode = 'maze';
    let running = false;
    let tick = 0;
    let raf = 0;
    let simData = {};
    let lastTouchAt = 0;

    function setRunButton() {
      const text = document.getElementById('startText');
      const icon = document.getElementById('startIcon');
      if (text) text.textContent = tick >= BIO_TICKS ? 'Replay growth' : running ? 'Pause growth' : 'Start growth';
      if (icon) icon.textContent = tick >= BIO_TICKS ? '↻' : running ? 'Ⅱ' : '▶';
    }

    function mazeGeometry(width, height) {
      const cols = MAZE_GRID[0].length;
      const rows = MAZE_GRID.length;
      const cellW = (width * 0.82) / cols;
      const cellH = (height * 0.85) / rows;
      return { cols, rows, cellW, cellH, offsetX: (width - cols * cellW) / 2, offsetY: (height - rows * cellH) / 2 };
    }

    function initMode() {
      const [width, height] = fitCanvas(canvas);
      tick = 0;
      simData = { origin: { x: width / 2, y: height / 2 }, nodes: [], shortest: [], deadends: [], stars: [] };
      if (clickHint) clickHint.style.display = interactiveModes.has(mode) ? 'block' : 'none';
      if (labTitle) labTitle.textContent = titles[mode];

      if (mode === 'maze') {
        const geometry = mazeGeometry(width, height);
        const getPoint = ([col, row]) => ({ x: geometry.offsetX + (col + 0.5) * geometry.cellW, y: geometry.offsetY + (row + 0.5) * geometry.cellH });
        const originCell = [1, 1];
        const exitCell = [13, 9];
        simData.originCell = originCell;
        simData.mazeGeometry = geometry;
        simData.origin = getPoint(originCell);
        simData.nodes = [{ ...getPoint(originCell), label: 'Food A (Entrance)' }, { ...getPoint(exitCell), label: 'Food B (Exit)' }, { ...getPoint([1, 9]), label: 'Oat Flake' }, { ...getPoint([13, 1]), label: 'Oat Flake' }];
        const primaryPath = findMazeCorridorPath(originCell, exitCell);
        simData.shortest = primaryPath.length ? [cellPathToPoints(primaryPath, geometry)] : [];
        simData.deadends = [[1, 9], [13, 1], [3, 7], [9, 7]].map((cell) => {
          const path = findMazeCorridorPath(originCell, cell);
          return path.length ? cellPathToPoints(path, geometry) : [];
        });
      } else if (mode === 'food') {
        simData.origin = { x: width / 2, y: height / 2, label: 'Central Plasmodium' };
        simData.nodes = Array.from({ length: 6 }, (_, i) => {
          const angle = -Math.PI * 0.82 + (i / 5) * Math.PI * 1.64;
          return { x: width / 2 + Math.cos(angle) * width * 0.36, y: height / 2 + Math.sin(angle) * height * 0.36, label: `Oat flake ${i + 1}` };
        });
        simData.shortest = simData.nodes.map((node) => createOrganicBranch([simData.origin, { x: (simData.origin.x + node.x) / 2, y: (simData.origin.y + node.y) / 2 }, node], 5));
        simData.deadends = Array.from({ length: 8 }, (_, i) => {
          const angle = (i / 8) * TAU + 0.2;
          return createOrganicBranch([simData.origin, { x: simData.origin.x + Math.cos(angle) * width * 0.38, y: simData.origin.y + Math.sin(angle) * height * 0.38 }], 10);
        });
      } else if (mode === 'tsp') {
        simData.origin = { x: width / 2, y: height / 2, label: 'Inoculation' };
        simData.nodes = Array.from({ length: 9 }, (_, i) => {
          const angle = (i / 9) * TAU - Math.PI / 2;
          return { x: width / 2 + Math.cos(angle) * width * 0.35, y: height / 2 + Math.sin(angle) * height * 0.35, label: String.fromCharCode(65 + i) };
        });
        const tour = [...simData.nodes, simData.nodes[0]];
        simData.shortest = tour.slice(0, -1).map((node, i) => createOrganicBranch([node, tour[i + 1]], 5));
        simData.deadends = [0, 2, 4].map((i) => createOrganicBranch([simData.origin, simData.nodes[i]], 8));
      } else if (mode === 'tokyo') {
        const stations = [['Tokyo Central',0.50,0.52],['Shinjuku',0.42,0.46],['Shibuya',0.41,0.58],['Shinagawa',0.48,0.65],['Ueno',0.55,0.41],['Ikebukuro',0.43,0.36],['Yokohama',0.36,0.82],['Kawasaki',0.42,0.72],['Hachioji',0.18,0.45],['Tachikawa',0.28,0.42],['Omiya',0.45,0.18],['Chiba',0.82,0.52],['Narita',0.88,0.32],['Kamakura',0.30,0.90]];
        simData.nodes = stations.map(([label, x, y]) => ({ label, x: x * width, y: y * height }));
        simData.origin = simData.nodes[0];
        const ring = [0, 3, 2, 1, 5, 4, 0];
        const radials = [[3,7],[7,6],[6,13],[1,9],[9,8],[5,10],[4,11],[11,12]];
        simData.shortest = ring.slice(0, -1).map((index, i) => createOrganicBranch([simData.nodes[index], simData.nodes[ring[i + 1]]], 3));
        simData.shortest.push(...radials.map(([a, b]) => createOrganicBranch([simData.nodes[a], simData.nodes[b]], 5)));
        simData.deadends = [createOrganicBranch([simData.origin, simData.nodes[11]], 14), createOrganicBranch([simData.nodes[3], simData.nodes[11]], 14)];
      } else if (mode === 'mumbai') {
        simData.nodes = MUMBAI_STATIONS.map((station) => ({ ...station, x: station.x * width, y: station.y * height }));
        simData.origin = simData.nodes[2];
        simData.shortest = MUMBAI_LINES.map((line) => createOrganicBranch(line.map((index) => simData.nodes[index]), 3));
        simData.deadends = [createOrganicBranch([simData.origin, { x: width * 0.16, y: height * 0.42 }], 10), createOrganicBranch([simData.origin, { x: width * 0.62, y: height * 0.86 }], 10), createOrganicBranch([simData.origin, { x: width * 0.90, y: height * 0.16 }], 10)];
      } else if (mode === 'cosmic') {
        const clusters = [[0.12,0.28],[0.22,0.17],[0.33,0.31],[0.43,0.18],[0.56,0.27],[0.70,0.16],[0.84,0.30],[0.18,0.52],[0.36,0.48],[0.52,0.57],[0.69,0.46],[0.86,0.61],[0.25,0.80],[0.43,0.73],[0.61,0.84],[0.78,0.77]];
        simData.origin = { x: width / 2, y: height / 2, label: 'Field centre' };
        simData.nodes = clusters.map(([x, y], i) => ({ x: x * width, y: y * height, label: i % 4 === 0 ? 'Galaxy Cluster' : '' }));
        simData.shortest = simData.nodes.slice(1).map((node, i) => createOrganicBranch([simData.nodes[i], node], 8));
        simData.stars = Array.from({ length: 80 }, () => ({ x: rand(0, width), y: rand(0, height), r: rand(0.4, 1.6), a: rand(0.2, 0.7) }));
      }

      if (explainEl) explainEl.textContent = copyTexts[mode];
      updateLifecycle(phaseEl, timerEl, tick);
      setRunButton();
      draw();
    }

    function draw() {
      const [width, height, ctx] = fitCanvas(canvas);
      ctx.fillStyle = mode === 'cosmic' ? '#030711' : '#050c16';
      ctx.fillRect(0, 0, width, height);
      if (mode === 'maze' && simData.mazeGeometry) {
        const geometry = simData.mazeGeometry;
        ctx.fillStyle = '#0a1726';
        ctx.strokeStyle = '#1b324d';
        ctx.lineWidth = 2;
        for (let row = 0; row < geometry.rows; row += 1) {
          for (let col = 0; col < geometry.cols; col += 1) {
            if (MAZE_GRID[row][col] === 1) {
              const x = geometry.offsetX + col * geometry.cellW;
              const y = geometry.offsetY + row * geometry.cellH;
              ctx.fillRect(x, y, geometry.cellW, geometry.cellH);
              ctx.strokeRect(x, y, geometry.cellW, geometry.cellH);
            }
          }
        }
        ctx.strokeStyle = 'rgba(243, 190, 56, 0.4)';
        ctx.lineWidth = 3;
        ctx.strokeRect(geometry.offsetX, geometry.offsetY, geometry.cols * geometry.cellW, geometry.rows * geometry.cellH);
      }
      if (mode === 'cosmic') {
        simData.stars.forEach((star) => {
          ctx.fillStyle = `rgba(180, 220, 255, ${star.a})`;
          ctx.beginPath();
          ctx.arc(star.x, star.y, star.r, 0, TAU);
          ctx.fill();
        });
      }

      const progress = clamp(tick / BIO_TICKS, 0, 1);
      const phase = updateLifecycle(phaseEl, timerEl, tick);
      ctx.globalCompositeOperation = 'lighter';
      simData.deadends.forEach((branch, i) => drawVein(ctx, branch, clamp(progress * 2.2 - i * 0.08, 0, 1), phase.deadendOpacity, mode === 'cosmic' ? '#3894db' : '#88bc88', 1.6, 4, tick, mode !== 'maze'));
      simData.shortest.forEach((branch, i) => {
        const reinforced = tick >= STAGE_TWO_END;
        drawVein(ctx, branch, clamp(progress * 1.55 - i * 0.035, 0, 1), 0.95, mode === 'cosmic' ? '#6dd4d2' : '#f3be38', reinforced ? 4.3 : 2.5, reinforced ? 18 : 8, tick, mode !== 'maze');
      });
      if (simData.origin && ['food', 'tokyo', 'mumbai'].includes(mode)) {
        ctx.shadowBlur = 24;
        ctx.shadowColor = '#f3be38';
        ctx.fillStyle = '#ffe066';
        ctx.beginPath();
        ctx.arc(simData.origin.x, simData.origin.y, 14 + Math.sin(tick * 0.08) * 2, 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      simData.nodes.forEach((node) => {
        ctx.shadowBlur = 16;
        ctx.shadowColor = mode === 'cosmic' ? '#6dd4d2' : '#f3be38';
        ctx.fillStyle = mode === 'cosmic' ? '#b9f4ff' : '#fff4b2';
        ctx.beginPath();
        ctx.arc(node.x, node.y, mode === 'maze' ? 7 : 6, 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
        if (node.label) {
          ctx.fillStyle = '#eef4f7';
          ctx.font = '500 11px "DM Mono", monospace';
          ctx.fillText(node.label, node.x + 10, node.y - 6);
        }
      });
      ctx.globalCompositeOperation = 'source-over';
      if (running && tick < BIO_TICKS) {
        tick = Math.min(BIO_TICKS, tick + 1);
        raf = requestAnimationFrame(draw);
      } else {
        running = false;
        setRunButton();
      }
    }

    function pointFromEvent(event) {
      const rect = canvas.getBoundingClientRect();
      return { x: clamp(event.clientX - rect.left, 0, rect.width), y: clamp(event.clientY - rect.top, 0, rect.height) };
    }

    function addFoodAt(x, y) {
      if (!interactiveModes.has(mode)) return;
      if (mode === 'maze') {
        const cell = getClosestCorridorCell(x, y, simData.mazeGeometry);
        const point = cellPathToPoints([cell], simData.mazeGeometry)[0];
        const path = findMazeCorridorPath(simData.originCell, cell);
        if (!path.length) return;
        simData.nodes.push({ ...point, label: 'New oat flake' });
        simData.shortest.push(cellPathToPoints(path, simData.mazeGeometry));
      } else {
        const node = { x, y, label: mode === 'food' ? 'New oat flake' : 'New point' };
        simData.nodes.push(node);
        simData.shortest.push(createOrganicBranch([simData.origin, { x: (simData.origin.x + x) / 2, y: (simData.origin.y + y) / 2 }, node], 5));
      }
      tick = Math.min(tick, STAGE_ONE_END);
      running = true;
      cancelAnimationFrame(raf);
      draw();
    }

    canvas.addEventListener('click', (event) => {
      if (Date.now() - lastTouchAt < 500) return;
      const point = pointFromEvent(event);
      addFoodAt(point.x, point.y);
    });
    canvas.addEventListener('touchstart', (event) => {
      if (!interactiveModes.has(mode)) return;
      event.preventDefault();
      canvas._touchStart = event.changedTouches[0];
    }, { passive: false });
    canvas.addEventListener('touchend', (event) => {
      if (!interactiveModes.has(mode) || !canvas._touchStart) return;
      event.preventDefault();
      const touch = event.changedTouches[0];
      const start = canvas._touchStart;
      canvas._touchStart = null;
      lastTouchAt = Date.now();
      if (Math.hypot(touch.clientX - start.clientX, touch.clientY - start.clientY) < 24) {
        const point = pointFromEvent(touch);
        addFoodAt(point.x, point.y);
      }
    }, { passive: false });

    startBtn?.addEventListener('click', () => {
      if (tick >= BIO_TICKS) initMode();
      running = !running;
      setRunButton();
      if (running) draw();
    });
    resetBtn?.addEventListener('click', () => {
      cancelAnimationFrame(raf);
      running = false;
      initMode();
    });
    document.querySelectorAll('.sim-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        mode = tab.dataset.sim;
        document.querySelectorAll('.sim-tab').forEach((item) => {
          item.classList.toggle('is-active', item === tab);
          item.setAttribute('aria-selected', item === tab ? 'true' : 'false');
        });
        cancelAnimationFrame(raf);
        running = false;
        initMode();
      });
    });
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        cancelAnimationFrame(raf);
        running = false;
        initMode();
      }, 120);
    });
    initMode();
  }

  function metro() {
    const canvas = document.getElementById('metroCanvas');
    if (!canvas) return;
    const startBtn = document.getElementById('metroStart');
    const resetBtn = document.getElementById('metroReset');
    const phaseEl = document.getElementById('metroPhase');
    const timerEl = document.getElementById('metroTimerText');
    let running = false;
    let tick = 0;
    let raf = 0;
    let paths = [];
    let exploratory = [];
    let lastSize = '';
    let resizeTimer = 0;

    function setButton() {
      if (startBtn) startBtn.textContent = tick >= BIO_TICKS ? 'Replay Mumbai network ↻' : running ? 'Pause Mumbai network Ⅱ' : 'Grow Mumbai network ▶';
    }
    function rebuild(width, height) {
      paths = MUMBAI_LINES.map((line) => createOrganicBranch(line.map((index) => ({ x: MUMBAI_STATIONS[index].x * width, y: MUMBAI_STATIONS[index].y * height })), 3));
      const hub = { x: MUMBAI_STATIONS[2].x * width, y: MUMBAI_STATIONS[2].y * height };
      exploratory = [createOrganicBranch([hub, { x: width * 0.15, y: height * 0.35 }], 10), createOrganicBranch([hub, { x: width * 0.60, y: height * 0.88 }], 10), createOrganicBranch([hub, { x: width * 0.90, y: height * 0.15 }], 10)];
    }
    function draw() {
      const [width, height, ctx] = fitCanvas(canvas);
      const size = `${width}x${height}`;
      if (size !== lastSize) {
        lastSize = size;
        rebuild(width, height);
      }
      ctx.clearRect(0, 0, width, height);
      const progress = clamp(tick / BIO_TICKS, 0, 1);
      const phase = updateLifecycle(phaseEl, timerEl, tick);
      ctx.globalCompositeOperation = 'lighter';
      exploratory.forEach((branch, i) => drawVein(ctx, branch, clamp(progress * 2.2 - i * 0.1, 0, 1), phase.deadendOpacity, '#88bc88', 1.6, 4, tick));
      paths.forEach((branch, i) => {
        const primary = i < 3;
        drawVein(ctx, branch, clamp(progress * 1.45 - i * 0.1, 0, 1), primary ? 0.95 : 0.75, '#f3be38', tick >= STAGE_TWO_END ? (primary ? 4.2 : 3) : (primary ? 2.8 : 2.2), tick >= STAGE_TWO_END ? 18 : 8, tick);
      });
      const hub = MUMBAI_STATIONS[2];
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#f3be38';
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.arc(hub.x * width, hub.y * height, 10 + Math.sin(tick * 0.08) * 2, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
      MUMBAI_STATIONS.forEach((station) => {
        const x = station.x * width;
        const y = station.y * height;
        ctx.shadowBlur = 14;
        ctx.shadowColor = '#f3be38';
        ctx.fillStyle = '#fff4b2';
        ctx.beginPath();
        ctx.arc(x, y, 5.5, 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#eef4f7';
        ctx.font = '500 10px "DM Mono", monospace';
        ctx.fillText(station.name, x + 8, y - 4);
      });
      ctx.globalCompositeOperation = 'source-over';
      if (running && tick < BIO_TICKS) {
        tick = Math.min(BIO_TICKS, tick + 1);
        raf = requestAnimationFrame(draw);
      } else {
        running = false;
        setButton();
      }
    }
    startBtn?.addEventListener('click', () => {
      if (tick >= BIO_TICKS) tick = 0;
      running = !running;
      setButton();
      if (running) draw();
    });
    resetBtn?.addEventListener('click', () => {
      cancelAnimationFrame(raf);
      tick = 0;
      running = false;
      setButton();
      draw();
    });
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        lastSize = '';
        draw();
      }, 120);
    });
    setButton();
    draw();
  }

  function init() {
    hero();
    growth();
    metro();
  }

  // GitHub Pages can reach this script after DOMContentLoaded on a fast load.
  if (document.readyState === 'complete' || document.readyState === 'interactive') init();
  else document.addEventListener('DOMContentLoaded', init, { once: true });
})();
