# Physarum Study

This is a self-contained static website for the slime mould case-study demo. The Simulations section includes Food Search, Travelling Man, Tokyo Rail, and Mumbai Metro modes. The animations are intentionally presentation-scale teaching models: they show connected exploration, reinforcement, and pruning without requiring an external API.

## Run locally

From this folder, run:

```bash
python3 -m http.server 4173
```

Then open <http://localhost:4173>.

## Publish with GitHub Pages

Upload the contents of this folder to a GitHub repository, then choose **Settings -> Pages -> Deploy from a branch**, select the branch and `/root` folder, and save. No API key or paid AI service is required by the website.

The site includes the updated PowerPoint presentation, research paper, team portraits, Mumbai Metro map, and supplied reference visuals under `assets/`.
