# Physarum // Biological Computing Lab

An interactive academic case study on *Physarum polycephalum*: a brainless plasmodium that explores, senses nutrient sources, reinforces useful tubes, and prunes weak routes.

## Included

- Five interactive models: Nakagaki maze, food search, Travelling Man, Tokyo rail, and cosmic web.
- One Mumbai Metro model backed by the supplied geographical map.
- A normalized 360-tick lifecycle with exploratory foraging, food contact/cytoplasmic flow, and pruning/reinforcement.
- BFS maze routing constrained to open corridor cells.
- Mouse and touch food placement for the food-driven models.
- Fully embedded Canva project presentation: `https://www.canva.com/design/DAHZNl61o84/nnyr9t98mYhLzTkaTeFdaw/view?embed`
- Team cards with photographs, full names, SAP IDs, and explicit roll-number/division fields.

The models are biologically inspired teaching simulations. They reproduce the observed search → reinforcement → pruning story, but do not claim to model every molecular process in a living culture.

## Run locally

From this directory, start any static web server:

```bash
python3 -m http.server 4173
```

Then open [http://localhost:4173](http://localhost:4173) in your browser.

## Published

Designed by Suhaan Balpande, Ranvirr Bhakri, Paarth Asapuri, and Aayush Baluapuri for an academic case study presentation at NMIMS Mumbai.
