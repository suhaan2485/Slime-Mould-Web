# Physarum // Biological Computing Lab

An interactive academic case study on *Physarum polycephalum*: a brainless plasmodium that explores, senses nutrient sources, reinforces useful tubes, and prunes weak routes.

## Included

- Five interactive models: Nakagaki maze, food search, Travelling Man, Tokyo rail, and cosmic web.
- One Mumbai Metro model backed by the supplied geographical map.
- A normalized 360-tick lifecycle with exploratory foraging, food contact/cytoplasmic flow, and pruning/reinforcement.
- BFS maze routing constrained to open corridor cells.
- Mouse and touch food placement for the food-driven models.
- Fully embedded Canva project presentation: `https://www.canva.com/design/DAHZNl61o84/nnyr9t98mYhLzTkaTeFdaw/view?embed`
- Team cards with photographs, full names, SAP IDs, and roll numbers: Suhaan Balpande (C166), Ranvirr Bhakri (C168), Paarth Asapuri (C165), and Aayush Baluapuri (C160).

## Biology-first simulation model

The models use one shared Physarum-style adaptive tube network rather than a genetic algorithm, ant swarm, or preselected shortest path. Food nodes are represented as nutrient-pressure sources, the inoculation point is a sink, and each candidate tube carries pressure-driven flow. Tube conductance adapts from the magnitude of flow: exploratory conductance is available at the start, high-flow tubes strengthen, and low-flow tubes decay during pruning. Animated particles shuttle back and forth along tubes to represent cytoplasmic streaming.

The maze is constrained to open corridor cells, Tokyo and Mumbai use station graphs, food search uses a spatial lattice, Travelling Man demonstrates a multi-food nutrient network rather than claiming an exact TSP solution, and Cosmic Web is explicitly labelled as a visual analogy rather than biology.

The biology audit follows Nakagaki, Yamada & Tóth's maze experiment ([Nature, 2000](https://doi.org/10.1038/35035159)), Tero et al.'s adaptive network experiment ([Science, 2010](https://doi.org/10.1126/science.1177894)), and Alim et al.'s pressure-driven signal propagation work ([PNAS, 2017](https://doi.org/10.1073/pnas.1618114114)).

The models are biologically inspired teaching simulations. They reproduce the observed exploration → nutrient contact → pressure-flow reinforcement → pruning story, but do not claim to model every molecular process in a living culture.

## Run locally

From this directory, start any static web server:

```bash
python3 -m http.server 4173
```

Then open [http://localhost:4173](http://localhost:4173) in your browser.

## Published

Designed by Suhaan Balpande, Ranvirr Bhakri, Paarth Asapuri, and Aayush Baluapuri for an academic case study presentation at NMIMS Mumbai.
