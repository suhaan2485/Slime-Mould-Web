/**
 * PHYSARUM POLYCEPHALUM SIMULATION ENGINE v3.0
 * 1. Central Inoculation Plasmodium (Slime Mould grows OUTWARD from center)
 * 2. Toshiyuki Nakagaki Maze & BBC Tokyo Rail Engine
 * 3. Accurate Mumbai Metro Network Geography & Multi-Line Rail Simulation
 */

(() => {
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function fitCanvas(canvas) {
    const r = canvas.getBoundingClientRect();
    const d = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = r.width * d;
    canvas.height = r.height * d;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(d, 0, 0, d, 0, 0);
    return [r.width, r.height, ctx];
  }

  // --- HERO CANVAS BACKGROUND ---
  function hero() {
    const canvas = document.getElementById('heroCanvas');
    if (!canvas) return;
    let pts = [];

    function frame() {
      const [w, h, c] = fitCanvas(canvas);
      if (!pts.length) {
        for (let i = 0; i < 42; i++) {
          pts.push({
            x: w / 2 + rand(-15, 15),
            y: h / 2 + rand(-15, 15),
            a: rand(0, TAU),
            speed: rand(0.6, 1.2)
          });
        }
      }

      c.fillStyle = 'rgba(7, 16, 29, 0.2)';
      c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'lighter';

      pts.forEach((p) => {
        const targetA = p.a + rand(-0.1, 0.1);
        p.a += (targetA - p.a) * 0.1;
        p.x += Math.cos(p.a) * p.speed;
        p.y += Math.sin(p.a) * p.speed;

        p.x = clamp(p.x, 20, w - 20);
        p.y = clamp(p.y, 20, h - 20);

        c.strokeStyle = 'rgba(243, 190, 56, 0.35)';
        c.lineWidth = 1.8;
        c.beginPath();
        c.moveTo(p.x, p.y);
        c.lineTo(p.x - Math.cos(p.a) * 18, p.y - Math.sin(p.a) * 18);
        c.stroke();

        c.fillStyle = '#f3be38';
        c.beginPath();
        c.arc(p.x, p.y, 1.5, 0, TAU);
        c.fill();
      });

      c.globalCompositeOperation = 'source-over';
      requestAnimationFrame(frame);
    }
    frame();
  }

  // --- MAZE GRID FOR NAKAGAKI EXPERIMENT ---
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

  function createOrganicBranch(pts, jitter = 8) {
    const res = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i], p2 = pts[i + 1];
      const steps = 14;
      for (let s = 0; s <= steps; s++) {
        const q = s / steps;
        const x = p1.x + (p2.x - p1.x) * q + (s > 0 && s < steps ? rand(-jitter, jitter) : 0);
        const y = p1.y + (p2.y - p1.y) * q + (s > 0 && s < steps ? rand(-jitter, jitter) : 0);
        res.push({ x, y });
      }
    }
    return res;
  }

  // --- MAIN LAB SIMULATION ENGINE ---
  function growth() {
    const canvas = document.getElementById('growthCanvas');
    const startBtn = document.getElementById('growthStart');
    const resetBtn = document.getElementById('growthReset');
    const phaseEl = document.getElementById('growthPhase');
    const explainEl = document.getElementById('simExplain');
    const clickHint = document.getElementById('clickHint');

    let mode = 'maze';
    let running = true;
    let tick = 0;
    let raf;
    let simData = {};

    const copyTexts = {
      maze: "Toshiyuki Nakagaki's Maze Experiment (2000): The mould fills all corridors from entry points, connects food sources, and prunes dead-end paths to find the shortest route.",
      food: "The central plasmodium grows outward in all directions, senses oat flakes, and reinforces useful connecting veins. Click anywhere to place new food sources!",
      tsp: "Several candidate routes are explored from the central plasmodium before the strongest connected tour remains. Click anywhere to add points!",
      tokyo: "BBC 2010 Tokyo Rail Experiment (Atsushi Tero): Slime mould grows outward from central Tokyo, reproducing the Yamanote Ring and regional rail network topology.",
      mumbai: "The same growth logic is shown as a transport network between Mumbai suburban hubs.",
      cosmic: "Galaxy clusters act like food sources while slime-like filaments trace the hidden cosmic web."
    };

    function initMode() {
      const [w, h] = fitCanvas(canvas);
      tick = 0;
      simData = { origin: { x: w / 2, y: h / 2 }, nodes: [], shortest: [], deadends: [], stars: [] };

      if (clickHint) {
        clickHint.style.display = (mode === 'food' || mode === 'tsp' || mode === 'maze') ? 'block' : 'none';
      }

      if (mode === 'maze') {
        const cols = MAZE_GRID[0].length;
        const rows = MAZE_GRID.length;
        const cellW = (w * 0.82) / cols;
        const cellH = (h * 0.85) / rows;
        const offsetX = (w - cols * cellW) / 2;
        const offsetY = (h - rows * cellH) / 2;

        const getCoord = (col, row) => ({
          x: offsetX + (col + 0.5) * cellW,
          y: offsetY + (row + 0.5) * cellH
        });

        simData.origin = getCoord(1, 1);
        simData.nodes = [
          { ...getCoord(1, 1), label: "Food A (Entrance)" },
          { ...getCoord(13, 9), label: "Food B (Exit)" },
          { ...getCoord(1, 9), label: "Oat Flake" },
          { ...getCoord(13, 1), label: "Oat Flake" }
        ];

        const shortestWaypoints = [
          getCoord(1, 1), getCoord(1, 3), getCoord(3, 3), getCoord(3, 1),
          getCoord(7, 1), getCoord(7, 3), getCoord(9, 3), getCoord(9, 1),
          getCoord(13, 1), getCoord(13, 5), getCoord(11, 5), getCoord(11, 7),
          getCoord(13, 7), getCoord(13, 9)
        ];
        simData.shortest = [createOrganicBranch(shortestWaypoints, 3)];

        const dead1 = [getCoord(1, 1), getCoord(3, 1), getCoord(3, 2)];
        const dead2 = [getCoord(7, 3), getCoord(7, 5), getCoord(5, 5), getCoord(5, 7), getCoord(3, 7), getCoord(1, 7), getCoord(1, 9)];
        const dead3 = [getCoord(9, 3), getCoord(9, 5), getCoord(9, 7), getCoord(7, 7), getCoord(7, 9)];
        const dead4 = [getCoord(13, 1), getCoord(11, 1), getCoord(11, 3)];

        simData.deadends = [
          createOrganicBranch(dead1, 4),
          createOrganicBranch(dead2, 4),
          createOrganicBranch(dead3, 4),
          createOrganicBranch(dead4, 4)
        ];

        simData.mazeRects = { cols, rows, cellW, cellH, offsetX, offsetY };

      } else if (mode === 'food') {
        // CENTRAL PLASMODIUM INOCULATION ORIGIN
        simData.origin = { x: w / 2, y: h / 2, label: "Central Plasmodium" };
        const count = 6;
        
        simData.nodes = Array.from({ length: count }, (_, i) => {
          const a = -Math.PI * 0.82 + (i / (count - 1)) * Math.PI * 1.64;
          return {
            x: w / 2 + Math.cos(a) * w * 0.36,
            y: h / 2 + Math.sin(a) * h * 0.36
          };
        });

        // Growth radiates OUTWARD from central plasmodium to food nodes!
        simData.shortest = simData.nodes.map(n =>
          createOrganicBranch([simData.origin, { x: simData.origin.x + (n.x - simData.origin.x) * 0.5, y: simData.origin.y + (n.y - simData.origin.y) * 0.5 }, n], 6)
        );

        simData.deadends = Array.from({ length: 8 }, () =>
          createOrganicBranch([simData.origin, { x: rand(40, w - 40), y: rand(40, h - 40) }], 12)
        );

      } else if (mode === 'tsp') {
        simData.origin = { x: w / 2, y: h / 2 };
        simData.nodes = Array.from({ length: 9 }, (_, i) => {
          const a = (i / 9) * TAU - Math.PI / 2;
          return {
            x: w / 2 + Math.cos(a) * w * 0.35,
            y: h / 2 + Math.sin(a) * h * 0.35,
            label: String.fromCharCode(65 + i)
          };
        });

        const tour = [...simData.nodes, simData.nodes[0]];
        simData.shortest = tour.slice(0, -1).map((n, i) =>
          createOrganicBranch([n, tour[i + 1]], 5)
        );

        simData.deadends = [
          createOrganicBranch([simData.origin, simData.nodes[0]], 8),
          createOrganicBranch([simData.origin, simData.nodes[4]], 8),
          createOrganicBranch([simData.origin, simData.nodes[2]], 8)
        ];

      } else if (mode === 'tokyo') {
        // EXACT BBC TOKYO RAIL TOPOLOGY (Atsushi Tero 2010)
        simData.origin = { x: 0.5 * w, y: 0.52 * h, label: "Tokyo Central" };

        const stations = [
          ['Tokyo Central', 0.5, 0.52],
          ['Shinjuku', 0.42, 0.46],
          ['Shibuya', 0.41, 0.58],
          ['Shinagawa', 0.48, 0.65],
          ['Ueno', 0.55, 0.41],
          ['Ikebukuro', 0.43, 0.36],
          ['Yokohama', 0.36, 0.82],
          ['Kawasaki', 0.42, 0.72],
          ['Hachioji', 0.18, 0.45],
          ['Tachikawa', 0.28, 0.42],
          ['Omiya', 0.45, 0.18],
          ['Chiba', 0.82, 0.52],
          ['Narita', 0.88, 0.32],
          ['Kamakura', 0.3, 0.9]
        ];

        simData.nodes = stations.map(s => ({
          label: s[0],
          x: s[1] * w,
          y: s[2] * h
        }));

        // Yamanote Ring Loop
        const yamanote = [0, 3, 2, 1, 5, 4, 0];
        const loopBranches = yamanote.slice(0, -1).map((idx, i) =>
          createOrganicBranch([simData.nodes[idx], simData.nodes[yamanote[i + 1]]], 3)
        );

        // Radial Corridors extending outward
        const radials = [
          [3, 7], [7, 6], [6, 13],
          [1, 9], [9, 8],
          [5, 10],
          [4, 11], [11, 12]
        ];

        const radialBranches = radials.map(pair =>
          createOrganicBranch([simData.nodes[pair[0]], simData.nodes[pair[1]]], 5)
        );

        simData.shortest = [...loopBranches, ...radialBranches];

        simData.deadends = [
          createOrganicBranch([simData.origin, simData.nodes[11]], 14),
          createOrganicBranch([simData.nodes[3], simData.nodes[11]], 14),
          createOrganicBranch([simData.nodes[2], simData.nodes[6]], 12)
        ];

      } else if (mode === 'cosmic') {
        simData.origin = { x: w / 2, y: h / 2 };
        const clusters = [
          [0.12, 0.28], [0.22, 0.17], [0.33, 0.31], [0.43, 0.18], [0.56, 0.27], [0.7, 0.16], [0.84, 0.3],
          [0.18, 0.52], [0.36, 0.48], [0.52, 0.57], [0.69, 0.46], [0.86, 0.61],
          [0.25, 0.8], [0.43, 0.73], [0.61, 0.84], [0.78, 0.77]
        ];
        simData.nodes = clusters.map((v, i) => ({
          label: i % 4 === 0 ? 'Galaxy Cluster' : '',
          x: v[0] * w,
          y: v[1] * h
        }));

        simData.shortest = simData.nodes.slice(1).map((n, i) =>
          createOrganicBranch([simData.nodes[i], n], 8)
        );

        simData.stars = Array.from({ length: 80 }, () => ({
          x: rand(0, w), y: rand(0, h), r: rand(0.4, 1.6), a: rand(0.2, 0.7)
        }));
      }

      if (explainEl) explainEl.textContent = copyTexts[mode] || '';
      draw();
    }

    // INTERACTIVE CANVAS CLICK TO ADD FOOD SOURCE
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Add clean food node (no text clutter)
      const newNode = { x: clickX, y: clickY };
      simData.nodes.push(newNode);

      // Sprout organic branch FROM CENTRAL PLASMODIUM (or nearest node) out to new food!
      const startPoint = simData.origin || (simData.nodes.length ? simData.nodes[0] : { x: clickX, y: clickY });
      const newBranch = createOrganicBranch([startPoint, newNode], 6);
      simData.shortest.push(newBranch);

      // Re-trigger growth sequence to organically integrate new food node
      tick = Math.floor(360 * 0.35);
      if (!running) {
        running = true;
        draw();
      }
    });

    function drawVein(ctx, pts, progress, opacity, color, width, glow, time) {
      if (!pts || pts.length < 2 || opacity <= 0.01) return;

      const total = pts.length - 1;
      const count = Math.floor(clamp(progress, 0, 1) * total);
      if (count < 1) return;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);

      for (let i = 1; i <= count; i++) {
        const p = pts[i];
        const pulse = Math.sin(time * 0.05 + i * 0.2) * 0.8;
        ctx.lineTo(p.x + pulse, p.y + pulse);
      }

      ctx.strokeStyle = color;
      ctx.globalAlpha = opacity;
      ctx.lineWidth = width;
      ctx.shadowBlur = glow;
      ctx.shadowColor = color;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    }

    function draw() {
      const [w, h, c] = fitCanvas(canvas);
      c.fillStyle = mode === 'cosmic' ? '#030711' : '#050c16';
      c.fillRect(0, 0, w, h);

      if (mode === 'maze' && simData.mazeRects) {
        const { cols, rows, cellW, cellH, offsetX, offsetY } = simData.mazeRects;
        
        c.fillStyle = '#0a1726';
        c.strokeStyle = '#1b324d';
        c.lineWidth = 2;

        for (let r = 0; r < rows; r++) {
          for (let col = 0; col < cols; col++) {
            if (MAZE_GRID[r][col] === 1) {
              const x = offsetX + col * cellW;
              const y = offsetY + r * cellH;
              c.fillRect(x, y, cellW, cellH);
              c.strokeRect(x, y, cellW, cellH);
            }
          }
        }
        
        c.strokeStyle = 'rgba(243, 190, 56, 0.4)';
        c.lineWidth = 3;
        c.strokeRect(offsetX, offsetY, cols * cellW, rows * cellH);
      }

      if (mode === 'cosmic' && simData.stars) {
        simData.stars.forEach(s => {
          c.fillStyle = `rgba(180, 220, 255, ${s.a})`;
          c.beginPath();
          c.arc(s.x, s.y, s.r, 0, TAU);
          c.fill();
        });
      }

      const maxTicks = 360;
      const progress = clamp(tick / maxTicks, 0, 1);

      let phaseText = "Stage 1 / Exploratory Foraging";
      let deadendOpacity = 0.8;

      if (progress < 0.35) {
        phaseText = "Stage 1 / Exploration (Outward Expansion)";
        deadendOpacity = (progress / 0.35) * 0.75;
      } else if (progress < 0.65) {
        phaseText = "Stage 2 / Food Contact & Cytoplasmic Flow";
        deadendOpacity = 0.75;
      } else {
        phaseText = "Stage 3 / Pruning Dead Ends → Shortest Path";
        const fade = (progress - 0.65) / 0.35;
        deadendOpacity = Math.max(0, 0.75 * (1 - fade));
      }

      if (phaseEl) phaseEl.textContent = phaseText;

      c.globalCompositeOperation = 'lighter';

      // 1. Dead-End Exploratory Veins
      if (simData.deadends) {
        simData.deadends.forEach((pts, i) => {
          const pProg = clamp(progress * 2.2 - i * 0.1, 0, 1);
          drawVein(
            c, pts, pProg, deadendOpacity,
            mode === 'cosmic' ? '#3894db' : '#88bc88',
            1.6, 4, tick
          );
        });
      }

      // 2. Reinforced Shortest Path Veins
      if (simData.shortest) {
        simData.shortest.forEach((pts, i) => {
          const pProg = clamp(progress * 1.5 - i * 0.05, 0, 1);
          const isReinforced = progress >= 0.65;
          const veinWidth = isReinforced ? 4.2 : 2.5;
          const glowAmt = isReinforced ? 18 : 8;

          drawVein(
            c, pts, pProg, 0.95,
            mode === 'cosmic' ? '#6dd4d2' : '#f3be38',
            veinWidth, glowAmt, tick
          );
        });
      }

      // 3. CENTRAL SLIME PLASMODIUM INOCULATION BLOB
      if (simData.origin && (mode === 'food' || mode === 'tokyo')) {
        const ox = simData.origin.x, oy = simData.origin.y;
        c.shadowBlur = 24;
        c.shadowColor = '#f3be38';
        c.fillStyle = '#ffe066';
        c.beginPath();
        c.arc(ox, oy, 14 + Math.sin(tick * 0.08) * 2, 0, TAU);
        c.fill();
        c.shadowBlur = 0;
      }

      // 4. Food Node Oat Flakes
      if (simData.nodes) {
        simData.nodes.forEach(n => {
          c.shadowBlur = 16;
          c.shadowColor = mode === 'cosmic' ? '#6dd4d2' : '#f3be38';
          c.fillStyle = mode === 'cosmic' ? '#b9f4ff' : '#fff4b2';
          c.beginPath();
          c.arc(n.x, n.y, mode === 'maze' ? 7 : 6, 0, TAU);
          c.fill();
          c.shadowBlur = 0;

          if (n.label) {
            c.fillStyle = '#eef4f7';
            c.font = '500 11px "DM Mono", monospace';
            c.fillText(n.label, n.x + 10, n.y - 6);
          }
        });
      }

      c.globalCompositeOperation = 'source-over';

      if (running) {
        tick++;
        raf = requestAnimationFrame(draw);
      }
    }

    if (startBtn) {
      startBtn.onclick = () => {
        running = !running;
        const text = document.getElementById('startText');
        const icon = document.getElementById('startIcon');
        if (text) text.textContent = running ? 'Pause growth' : 'Resume growth';
        if (icon) icon.textContent = running ? 'Ⅱ' : '▶';
        if (running) draw();
      };
    }

    if (resetBtn) {
      resetBtn.onclick = () => {
        cancelAnimationFrame(raf);
        running = true;
        const text = document.getElementById('startText');
        const icon = document.getElementById('startIcon');
        if (text) text.textContent = 'Pause growth';
        if (icon) icon.textContent = 'Ⅱ';
        initMode();
      };
    }

    document.querySelectorAll('.sim-tab').forEach(tab => {
      tab.onclick = () => {
        mode = tab.dataset.sim;
        document.querySelectorAll('.sim-tab').forEach(t => {
          t.classList.toggle('is-active', t === tab);
          t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
        });
        cancelAnimationFrame(raf);
        running = true;
        initMode();
      };
    });

    window.addEventListener('resize', () => initMode());
    initMode();
  }

  // --- MUMBAI METRO GEOGRAPHICAL RAIL SIMULATION ---
  function metro() {
    const canvas = document.getElementById('metroCanvas');
    const startBtn = document.getElementById('metroStart');
    const resetBtn = document.getElementById('metroReset');
    if (!canvas) return;

    let running = false;
    let t = 0;
    let raf;

    // ACCURATE GEOGRAPHICAL STATIONS OVER MUMBAI MAP
    const stations = [
      { name: "Churchgate", x: 0.24, y: 0.86 },
      { name: "CST",        x: 0.32, y: 0.82 },
      { name: "Dadar",      x: 0.36, y: 0.62 },
      { name: "Bandra",     x: 0.35, y: 0.50 },
      { name: "Andheri",    x: 0.38, y: 0.36 },
      { name: "Borivali",   x: 0.38, y: 0.20 },
      { name: "Kurla",      x: 0.48, y: 0.52 },
      { name: "Ghatkopar",  x: 0.54, y: 0.42 },
      { name: "Thane",      x: 0.70, y: 0.22 },
      { name: "Vashi",      x: 0.75, y: 0.58 },
      { name: "Panvel",     x: 0.84, y: 0.80 }
    ];

    // Suburban Rail Corridors:
    // 1. Western Line: Churchgate -> Dadar -> Bandra -> Andheri -> Borivali
    // 2. Central Line: CST -> Dadar -> Kurla -> Ghatkopar -> Thane
    // 3. Harbour Line: CST -> Kurla -> Vashi -> Panvel
    // 4. Metro Line 1: Andheri -> Ghatkopar
    const railCorridors = [
      [0, 2, 3, 4, 5],
      [1, 2, 6, 7, 8],
      [1, 6, 9, 10],
      [4, 7]
    ];

    function getMetroPaths(w, h) {
      return railCorridors.map(line => {
        const waypoints = line.map(idx => ({
          x: stations[idx].x * w,
          y: stations[idx].y * h
        }));
        return createOrganicBranch(waypoints, 3);
      });
    }

    function draw() {
      const [w, h, c] = fitCanvas(canvas);
      c.clearRect(0, 0, w, h);

      const paths = getMetroPaths(w, h);
      const progress = clamp(t / 360, 0, 1);

      c.globalCompositeOperation = 'lighter';

      // Draw Slime Vein Growth along Metro Corridors
      paths.forEach((pts, i) => {
        const isPrimary = i < 3;
        const pProg = clamp(progress * 1.4 - i * 0.1, 0, 1);
        const opacity = isPrimary ? 0.95 : 0.75;
        const width = isPrimary ? 4.0 : 2.5;

        if (pts && pts.length > 1 && pProg > 0) {
          const total = pts.length - 1;
          const count = Math.floor(pProg * total);
          if (count >= 1) {
            c.beginPath();
            c.moveTo(pts[0].x, pts[0].y);
            for (let k = 1; k <= count; k++) {
              const pulse = Math.sin(t * 0.06 + k * 0.2) * 0.6;
              c.lineTo(pts[k].x + pulse, pts[k].y + pulse);
            }
            c.strokeStyle = '#f3be38';
            c.globalAlpha = opacity;
            c.lineWidth = width;
            c.shadowBlur = 16;
            c.shadowColor = '#f3be38';
            c.lineCap = 'round';
            c.stroke();
            c.shadowBlur = 0;
          }
        }
      });

      // Draw Inoculation Plasmodium at Dadar Hub
      const dadarX = stations[2].x * w, dadarY = stations[2].y * h;
      c.shadowBlur = 20;
      c.shadowColor = '#f3be38';
      c.fillStyle = '#ffe066';
      c.beginPath();
      c.arc(dadarX, dadarY, 10 + Math.sin(t * 0.08) * 2, 0, TAU);
      c.fill();
      c.shadowBlur = 0;

      // Draw Station Nodes
      stations.forEach(s => {
        const px = s.x * w, py = s.y * h;
        c.shadowBlur = 14;
        c.shadowColor = '#f3be38';
        c.fillStyle = '#fff4b2';
        c.beginPath();
        c.arc(px, py, 5.5, 0, TAU);
        c.fill();
        c.shadowBlur = 0;

        c.fillStyle = '#eef4f7';
        c.font = '500 10px "DM Mono", monospace';
        c.fillText(s.name, px + 8, py - 4);
      });

      c.globalCompositeOperation = 'source-over';

      if (running) {
        t += 1.5;
        raf = requestAnimationFrame(draw);
      }
    }

    if (startBtn) {
      startBtn.onclick = () => {
        running = !running;
        startBtn.innerHTML = running ? 'Pause growth <span>Ⅱ</span>' : 'Grow Mumbai network <span>▶</span>';
        if (running) draw();
      };
    }

    if (resetBtn) {
      resetBtn.onclick = () => {
        t = 0;
        running = false;
        cancelAnimationFrame(raf);
        startBtn.innerHTML = 'Grow Mumbai network <span>▶</span>';
        draw();
      };
    }

    draw();
  }

  // DOM Init
  document.addEventListener('DOMContentLoaded', () => {
    hero();
    growth();
    metro();
  });
})();
