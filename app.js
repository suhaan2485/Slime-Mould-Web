/**
 * PHYSARUM POLYCEPHALUM SIMULATION ENGINE v5.0
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
    if (tick < STAGE_ONE_END) return { label: 'Stage 1 / Exploratory Foraging' };
    if (tick < STAGE_TWO_END) return { label: 'Stage 2 / Food Contact & Cytoplasmic Flow' };
    return { label: 'Stage 3 / Pruning to Optimal Network' };
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

  function makeEdge(nodes, a, b, jitter = 0) {
    const start = nodes[a];
    const end = nodes[b];
    const length = Math.max(1, Math.hypot(end.x - start.x, end.y - start.y));
    return { a, b, length, conductance: 0.12 + rand(0, 0.04), flow: 0, activity: 0, phase: rand(0, TAU), points: createOrganicBranch([start, end], jitter, 10) };
  }

  function uniquePairs(pairs) {
    const seen = new Set();
    return pairs.filter(([a, b]) => {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (a === b || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function linePairs(line) {
    return line.slice(1).map((node, index) => [line[index], node]);
  }

  function nearestNodeIndex(nodes, x, y) {
    let best = 0;
    let bestDistance = Infinity;
    nodes.forEach((node, index) => {
      const distance = Math.hypot(node.x - x, node.y - y);
      if (distance < bestDistance) {
        best = index;
        bestDistance = distance;
      }
    });
    return best;
  }

  function nearestPairs(nodes, count = 3) {
    const pairs = [];
    nodes.forEach((node, index) => {
      nodes.map((other, otherIndex) => ({ other, otherIndex, distance: Math.hypot(node.x - other.x, node.y - other.y) }))
        .filter((item) => item.otherIndex !== index)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, count)
        .forEach((item) => pairs.push([index, item.otherIndex]));
    });
    return uniquePairs(pairs);
  }

  /*
   * Physarum-style adaptive tube network.
   *
   * This is a pressure/flow model, not a genetic algorithm and not an
   * agent swarm. Food nodes are held at a nutrient pressure, the inoculation
   * node is the sink, and tube conductance adapts to the magnitude of flow:
   * D <- D + rate * (exploration floor + flow response - D).
   * The flow is recalculated from Kirchhoff-style pressure balance each step.
   * It captures the observed positive feedback: useful tubes carry more
   * cytoplasm and thicken; low-use tubes lose conductance and dissolve.
   */
  function createPhysarumNetwork(nodes, pairs, sourceIndices, sinkIndex, jitter = 0) {
    const network = {
      nodes,
      edges: uniquePairs(pairs).map(([a, b]) => makeEdge(nodes, a, b, jitter)),
      sources: new Set(sourceIndices),
      sink: sinkIndex,
      pressures: nodes.map(() => 0.5),
      adjacency: [],
      lastMaxFlow: 0,
      rebuild() {
        this.adjacency = this.nodes.map(() => []);
        this.edges.forEach((edge, index) => {
          this.adjacency[edge.a].push([index, edge.b]);
          this.adjacency[edge.b].push([index, edge.a]);
        });
      },
      addSourceNode(node, label) {
        const index = this.nodes.length;
        this.nodes.push({ ...node, label: label || 'New oat flake', isSource: true });
        const nearest = this.nodes.slice(0, index).map((other, otherIndex) => ({ otherIndex, distance: Math.hypot(node.x - other.x, node.y - other.y) }))
          .sort((a, b) => a.distance - b.distance).slice(0, 3);
        nearest.forEach(({ otherIndex }) => this.edges.push(makeEdge(this.nodes, index, otherIndex, 5)));
        this.sources.add(index);
        this.pressures.push(1);
        this.rebuild();
        return index;
      },
      setSource(index, label) {
        this.sources.add(index);
        if (label) this.nodes[index].label = label;
        this.nodes[index].isSource = true;
      },
      foodCount() {
        return this.sources.size + (this.sink === null || this.sink === undefined || this.sources.has(this.sink) ? 0 : 1);
      },
      activeTubeCount() {
        return this.edges.filter((edge) => edge.conductance > 0.1).length;
      },
      step(tick) {
        const fixed = new Map();
        this.sources.forEach((index) => fixed.set(index, 1));
        if (this.sink !== null && this.sink !== undefined) fixed.set(this.sink, 0);
        for (let iteration = 0; iteration < 16; iteration += 1) {
          this.nodes.forEach((_, index) => {
            if (fixed.has(index)) {
              this.pressures[index] = fixed.get(index);
              return;
            }
            let numerator = 0;
            let denominator = 0;
            this.adjacency[index].forEach(([edgeIndex, other]) => {
              const edge = this.edges[edgeIndex];
              const weight = edge.conductance / edge.length;
              numerator += weight * this.pressures[other];
              denominator += weight;
            });
            if (denominator > 0) this.pressures[index] = numerator / denominator;
          });
        }

        let maxFlow = 0;
        this.edges.forEach((edge) => {
          edge.flow = edge.conductance / edge.length * (this.pressures[edge.a] - this.pressures[edge.b]);
          maxFlow = Math.max(maxFlow, Math.abs(edge.flow));
        });
        this.lastMaxFlow = maxFlow;

        const normalizedTime = clamp(tick / BIO_TICKS, 0, 1);
        const exploreFloor = tick < STAGE_ONE_END
          ? 0.42 - normalizedTime * 0.16
          : tick < STAGE_TWO_END
            ? 0.22 - ((tick - STAGE_ONE_END) / (STAGE_TWO_END - STAGE_ONE_END)) * 0.12
            : Math.max(0.025, 0.10 - ((tick - STAGE_TWO_END) / (BIO_TICKS - STAGE_TWO_END)) * 0.075);
        const rate = tick < STAGE_ONE_END ? 0.045 : tick < STAGE_TWO_END ? 0.09 : 0.13;
        this.edges.forEach((edge) => {
          const activity = maxFlow > 0 ? Math.abs(edge.flow) / maxFlow : 0;
          edge.activity = activity;
          const target = exploreFloor + (1 - exploreFloor) * Math.pow(activity, 0.72);
          edge.conductance = clamp(edge.conductance + rate * (target - edge.conductance), 0.015, 1);
        });
      }
    };
    network.nodes.forEach((node, index) => { node.isSource = network.sources.has(index); });
    network.rebuild();
    return network;
  }

  function gridNetwork(width, height, cols, rows, sourceCells, sinkCell, allowed) {
    const nodes = [];
    const lookup = new Map();
    const cellW = (width * 0.82) / cols;
    const cellH = (height * 0.78) / rows;
    const offsetX = (width - cols * cellW) / 2;
    const offsetY = (height - rows * cellH) / 2;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (allowed && allowed[row]?.[col] !== 0) continue;
        const key = cellKey(col, row);
        lookup.set(key, nodes.length);
        nodes.push({ x: offsetX + (col + 0.5) * cellW, y: offsetY + (row + 0.5) * cellH, cell: [col, row], label: '' });
      }
    }
    const pairs = [];
    nodes.forEach((node, index) => {
      const [col, row] = node.cell;
      [[1, 0], [0, 1]].forEach(([dc, dr]) => {
        const other = lookup.get(cellKey(col + dc, row + dr));
        if (other !== undefined) pairs.push([index, other]);
      });
    });
    const sourceIndices = sourceCells.map((cell) => lookup.get(cellKey(cell[0], cell[1]))).filter((index) => index !== undefined);
    const sinkIndex = lookup.get(cellKey(sinkCell[0], sinkCell[1]));
    return {
      nodes,
      pairs,
      sourceIndices,
      sinkIndex,
      geometry: { cols, rows, cellW, cellH, offsetX, offsetY, lookup }
    };
  }

  function drawAdaptiveNetwork(ctx, network, tick, progress, mode, labelSize = 6) {
    const color = mode === 'cosmic' ? '#6dd4d2' : '#f3be38';
    const dimColor = mode === 'cosmic' ? '#277e9c' : '#88bc88';
    ctx.globalCompositeOperation = 'lighter';
    network.edges.forEach((edge) => {
      const strength = clamp((edge.conductance - 0.02) / 0.72, 0, 1);
      const visible = clamp(progress * 2.25 + strength * 0.55, 0, 1);
      const weak = tick >= STAGE_TWO_END && strength < 0.16;
      const opacity = weak ? strength * 0.62 : 0.12 + strength * 0.9;
      const width = 0.65 + strength * (tick >= STAGE_TWO_END ? 4.2 : 2.4);
      drawVein(ctx, edge.points, visible, opacity, strength > 0.28 ? color : dimColor, width, strength > 0.35 ? 14 : 3, tick, false);

      if (strength > 0.16) {
        const particles = strength > 0.55 ? 3 : 1;
        for (let p = 0; p < particles; p += 1) {
          let position = 0.5 + Math.sin(tick * 0.18 + edge.phase + p * 2.1) * 0.48;
          if (edge.flow < 0) position = 1 - position;
          const scaled = position * (edge.points.length - 1);
          const pointIndex = Math.min(edge.points.length - 2, Math.floor(scaled));
          const local = scaled - pointIndex;
          const a = edge.points[pointIndex];
          const b = edge.points[pointIndex + 1];
          ctx.globalAlpha = Math.min(0.9, strength * 1.15);
          ctx.fillStyle = mode === 'cosmic' ? '#b8f5ff' : '#fff0a2';
          ctx.shadowBlur = 10;
          ctx.shadowColor = color;
          ctx.beginPath();
          ctx.arc(a.x + (b.x - a.x) * local, a.y + (b.y - a.y) * local, 0.8 + strength * 1.3, 0, TAU);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    });
    ctx.globalAlpha = 1;
    network.nodes.forEach((node, index) => {
      const isSink = index === network.sink;
      const isSource = network.sources.has(index);
      ctx.shadowBlur = isSource || isSink ? 18 : 8;
      ctx.shadowColor = isSink ? '#6dd4d2' : color;
      ctx.fillStyle = isSink ? '#b8f5ff' : isSource ? '#fff0a2' : '#d7e9ed';
      ctx.beginPath();
      ctx.arc(node.x, node.y, isSink ? 8 : isSource ? 5.5 : 2.3, 0, TAU);
      ctx.fill();
      ctx.shadowBlur = 0;
      if (node.label && (isSource || isSink || labelSize > 7)) {
        ctx.fillStyle = '#eef4f7';
        ctx.font = '500 10px "DM Mono", monospace';
        ctx.fillText(node.label, node.x + 8, node.y - 5);
      }
    });
    ctx.globalCompositeOperation = 'source-over';
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
      maze: "Nakagaki's Maze Experiment (2000): open-corridor tubes start exploratory, then pressure-driven flow reinforces the shortest food-to-food connection. No route is preselected.",
      food: 'A central plasmodium is connected to oat flakes by a growing tube field. Nutrient pressure and shuttle flow reinforce useful connections. Click or tap to add another food source.',
      tsp: 'Travelling Man is shown as a biological multi-food network: the plasmodium connects nutrient sources through local flow feedback, not a genetic algorithm or a guaranteed TSP solver. Click or tap to add a source.',
      tokyo: 'Tero et al. (Science, 2010): station food sources and a Tokyo inoculation node drive an adaptive tube network whose useful corridors thicken without central planning.',
      cosmic: 'Cosmic Web is an analogy only: galaxy clusters are nutrient-like sources and the same adaptive tube rule traces a filament-like network.'
    };
    const titles = { maze: 'NAKAGAKI MAZE EXPERIMENT', food: 'CENTRAL PLASMODIUM / FOOD SEARCH', tsp: 'TRAVELLING MAN / MULTI-FOOD NETWORK', tokyo: 'TOKYO RAIL NETWORK / TERO 2010', cosmic: 'COSMIC WEB / PHYSARUM ANALOGY' };
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

    function updateDashboard(progress) {
      const agents = document.getElementById('agentCount');
      const foods = document.getElementById('foodCount');
      const state = document.getElementById('networkState');
      const routeState = document.getElementById('routeState');
      const progressBar = document.getElementById('stageProgress');
      const network = simData.network;
      if (agents) agents.textContent = String(network?.activeTubeCount() || 0).padStart(2, '0');
      if (foods) foods.textContent = String(network?.foodCount() || 0).padStart(2, '0');
      const route = tick >= BIO_TICKS ? 'OPTIMAL NETWORK' : tick >= STAGE_TWO_END ? 'REINFORCING' : tick >= STAGE_ONE_END ? 'FLOW CONTACT' : 'EXPLORING';
      if (state) state.textContent = route;
      if (routeState) routeState.textContent = route === 'OPTIMAL NETWORK' ? 'ADAPTIVE NETWORK STABLE' : `${route} TUBES`;
      if (progressBar) progressBar.style.width = `${progress * 100}%`;
      document.querySelectorAll('.stage-step').forEach((step) => {
        const stage = Number(step.dataset.stage);
        const active = (stage === 1 && tick < STAGE_ONE_END) || (stage === 2 && tick >= STAGE_ONE_END && tick < STAGE_TWO_END) || (stage === 3 && tick >= STAGE_TWO_END);
        step.classList.toggle('is-live', active);
      });
    }

    function mazeGeometry(width, height) {
      const cols = MAZE_GRID[0].length;
      const rows = MAZE_GRID.length;
      const cellW = (width * 0.82) / cols;
      const cellH = (height * 0.78) / rows;
      return { cols, rows, cellW, cellH, offsetX: (width - cols * cellW) / 2, offsetY: (height - rows * cellH) / 2 };
    }

    function initMode() {
      const [width, height] = fitCanvas(canvas);
      tick = 0;
      simData = { nodes: [], network: null, mazeGeometry: null, stars: [] };
      if (clickHint) clickHint.style.display = interactiveModes.has(mode) ? 'block' : 'none';
      if (labTitle) labTitle.textContent = titles[mode];

      if (mode === 'maze') {
        const geometry = mazeGeometry(width, height);
        const built = gridNetwork(width, height, geometry.cols, geometry.rows, [[1, 1]], [13, 9], MAZE_GRID);
        const startIndex = built.geometry.lookup.get(cellKey(1, 1));
        const exitIndex = built.geometry.lookup.get(cellKey(13, 9));
        built.nodes[startIndex].label = 'Food A / source';
        built.nodes[exitIndex].label = 'Food B / sink';
        simData.mazeGeometry = geometry;
        simData.originCell = [1, 1];
        simData.network = createPhysarumNetwork(built.nodes, built.pairs, [startIndex], exitIndex, 0);
      } else if (mode === 'food') {
        const built = gridNetwork(width, height, 15, 9, [[1, 1], [7, 1], [13, 2], [2, 7], [7, 7], [13, 7]], [7, 4]);
        built.sourceIndices.forEach((index, i) => { built.nodes[index].label = `Oat flake ${i + 1}`; });
        built.nodes[built.sinkIndex].label = 'Central plasmodium / sink';
        simData.network = createPhysarumNetwork(built.nodes, built.pairs, built.sourceIndices, built.sinkIndex, 4);
      } else if (mode === 'tsp') {
        const points = [{ label: 'Inoculation / sink', x: width * 0.5, y: height * 0.5 }];
        for (let i = 0; i < 9; i += 1) {
          const angle = (i / 9) * TAU - Math.PI / 2;
          points.push({ label: `Food ${String.fromCharCode(65 + i)}`, x: width * 0.5 + Math.cos(angle) * width * 0.35, y: height * 0.5 + Math.sin(angle) * height * 0.35 });
        }
        simData.network = createPhysarumNetwork(points, nearestPairs(points, 3), points.slice(1).map((_, i) => i + 1), 0, 5);
      } else if (mode === 'tokyo') {
        const stations = [['Tokyo Central',0.50,0.52],['Shinjuku',0.42,0.46],['Shibuya',0.41,0.58],['Shinagawa',0.48,0.65],['Ueno',0.55,0.41],['Ikebukuro',0.43,0.36],['Yokohama',0.36,0.82],['Kawasaki',0.42,0.72],['Hachioji',0.18,0.45],['Tachikawa',0.28,0.42],['Omiya',0.45,0.18],['Chiba',0.82,0.52],['Narita',0.88,0.32],['Kamakura',0.30,0.90]];
        const nodes = stations.map(([label, x, y]) => ({ label, x: x * width, y: y * height }));
        const ring = [0, 4, 5, 1, 2, 3, 0];
        const radials = [[3, 7], [7, 6], [6, 13], [1, 9], [9, 8], [5, 10], [4, 11], [11, 12]];
        const pairs = [...linePairs(ring), ...radials];
        simData.network = createPhysarumNetwork(nodes, pairs, nodes.slice(1).map((_, i) => i + 1), 0, 3);
      } else if (mode === 'cosmic') {
        const clusters = [[0.12,0.28],[0.22,0.17],[0.33,0.31],[0.43,0.18],[0.56,0.27],[0.70,0.16],[0.84,0.30],[0.18,0.52],[0.36,0.48],[0.52,0.57],[0.69,0.46],[0.86,0.61],[0.25,0.80],[0.43,0.73],[0.61,0.84],[0.78,0.77]];
        const nodes = [{ x: width / 2, y: height / 2, label: 'Field centre / sink' }, ...clusters.map(([x, y], i) => ({ x: x * width, y: y * height, label: i % 4 === 0 ? 'Galaxy cluster' : '' }))];
        simData.network = createPhysarumNetwork(nodes, nearestPairs(nodes, 3), nodes.slice(1).map((_, i) => i + 1), 0, 8);
        simData.stars = Array.from({ length: 80 }, () => ({ x: rand(0, width), y: rand(0, height), r: rand(0.4, 1.6), a: rand(0.2, 0.7) }));
      }

      simData.nodes = simData.network.nodes;
      if (explainEl) explainEl.textContent = copyTexts[mode];
      updateLifecycle(phaseEl, timerEl, tick);
      updateDashboard(0);
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
      updateLifecycle(phaseEl, timerEl, tick);
      if (simData.network) {
        if (running) {
          simData.network.step(tick);
        }
        drawAdaptiveNetwork(ctx, simData.network, tick, progress, mode, mode === 'tokyo' ? 10 : 6);
      }
      updateDashboard(progress);
      if (running && tick < BIO_TICKS) {
        tick = Math.min(BIO_TICKS, tick + 2);
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
      if (!interactiveModes.has(mode) || !simData.network) return;
      if (mode === 'maze') {
        const cell = getClosestCorridorCell(x, y, simData.mazeGeometry);
        const index = simData.mazeGeometry.lookup.get(cellKey(cell[0], cell[1]));
        if (index !== undefined) simData.network.setSource(index, 'New food source');
      } else {
        simData.network.addSourceNode({ x, y }, mode === 'food' ? 'New oat flake' : 'New food source');
        simData.nodes = simData.network.nodes;
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
      if (Math.hypot(touch.clientX - start.clientX, touch.clientY - start.clientY) < 24) addFoodAt(...Object.values(pointFromEvent(touch)));
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
    let network = null;
    let lastSize = '';
    let resizeTimer = 0;

    function setButton() {
      if (startBtn) startBtn.textContent = tick >= BIO_TICKS ? 'Replay Mumbai network ↻' : running ? 'Pause Mumbai network Ⅱ' : 'Grow Mumbai network ▶';
    }
    function rebuild(width, height) {
      const nodes = MUMBAI_STATIONS.map((station) => ({ ...station, x: station.x * width, y: station.y * height }));
      const pairs = MUMBAI_LINES.flatMap(linePairs);
      const sourceIndices = nodes.map((_, index) => index).filter((index) => index !== 2);
      network = createPhysarumNetwork(nodes, pairs, sourceIndices, 2, 3);
      network.nodes[2].label = 'Dadar / sink';
      network.nodes.forEach((node, index) => { if (index !== 2) node.label = MUMBAI_STATIONS[index].name; });
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
      updateLifecycle(phaseEl, timerEl, tick);
      if (running && network) {
        network.step(tick);
      }
      if (network) drawAdaptiveNetwork(ctx, network, tick, progress, 'mumbai', 10);
      if (running && tick < BIO_TICKS) {
        tick = Math.min(BIO_TICKS, tick + 2);
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
      lastSize = '';
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
