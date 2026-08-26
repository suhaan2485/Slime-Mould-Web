# Physarum Study | Agent-Based Slime Mould Optimization

An interactive biological simulation showcase demonstrating *Physarum polycephalum* transport network optimization, chemotaxis, and biological pathfinding algorithms.

## Features

- **Biological Agent Engine (16,000 Particles):** Implements Jeff Jones' sensory-motor loop algorithm (Sensory Angle, Sensory Distance, Chemotaxis, 2D Pheromone Trail Grid with Gaussian Blur Diffusion and Decay).
- **Interactive Food Node Placement:** Click anywhere on the simulation canvas to place custom food attractors in real time.
- **5 Simulation Presets:**
  1. **Food Chemotaxis:** Radial foraging and tendril reinforcement.
  2. **Traveling Salesperson (TSP):** Biological minimal spanning connection across 9 cities.
  3. **Tokyo Rail Network:** Simulates the classic 2010 Tero et al. experiment mapping Tokyo stations.
  4. **Mumbai Metro Network:** Biological transport route generation over the Mumbai transit map.
  5. **Cosmic Web Filaments:** Cyan bioluminescent dark matter filament network model connecting galaxy clusters.
- **Interactive Parameters Dashboard:** Real-time controls for Agent Speed, Sensor Angle, and Trail Decay Rate.
- **State-of-the-Art Design:** Glassmorphic UI, deep bio-luminescent glow themes, dark mode aesthetics, and responsive layout.

## Run Locally

From this directory, start any static web server:

```bash
python3 -m http.server 4173
```

Then open [http://localhost:4173](http://localhost:4173) in your browser.

## Published & Deployed

Designed by Suhaan Balpande, Ranvirr Bhakri, Paarth Asapuri, and Aayush Baluapuri for academic case study presentation (NMIMS Mumbai).
