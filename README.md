# Interdisciplinary Study at Harvard

A course discovery and planning tool built on top of [beta.my.harvard.edu](https://beta.my.harvard.edu), designed to promote interdisciplinary learning across all Harvard schools.

> Final project for **Intangible Design: Organizations** — Harvard Graduate School of Design, Spring 2026.
> Course page: [gsd.harvard.edu/course/intangible-design-organizations-spring-2026](https://www.gsd.harvard.edu/course/intangible-design-organizations-spring-2026/)

---

## The Idea

Harvard's cross-registration policy lets students take courses at any of the university's schools — yet most students stay within their home school. This tool makes the full catalog legible and navigable, and shows how disciplines connect through shared topic labels.

Every course in the catalog (6,042 across 8 schools) was tagged with topic labels. Those labels become the edges of a knowledge graph — revealing which fields naturally speak to each other and surfacing unexpected interdisciplinary paths.

---

## Features

### Course Explorer
Browse and filter 6,042 courses across FAS, GSD, HBS, HDS, HGSE, HKS, HLS, and HSPH. Search by keyword, instructor, school, semester, or course type. Save courses for later or mark them as taken.

### Knowledge Graph
A personalized, interactive force-directed graph built from the topic labels of your taken and saved courses. Nodes represent topic areas, edges represent co-occurrence across courses. Clusters group related disciplines.

- **Click a node** to select it; select multiple to find courses that span those topics
- **Right panel** shows matching courses ranked by overlap, filterable by semester
- **AI Knowledge Summary** generates a personal academic profile from your course history (requires Anthropic API key)

### AI Course Advisor
Describe your background and goals in plain language. Claude reads your saved course context and recommends specific courses from the full catalog, with explanations of how they connect to your existing path.

---

## Tech Stack

- **Next.js 16** (App Router, Turbopack) with React 19
- **Tailwind CSS v4**
- **Canvas API** — custom force-directed graph simulation (no D3 or graph libraries)
- **Anthropic SDK** — streaming responses via `claude-sonnet-4-6`
- **localStorage** — client-side persistence for saved/taken courses

---

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The AI features require an [Anthropic API key](https://console.anthropic.com). Enter it directly in the Knowledge Graph or AI Advisor pages — it is stored in `sessionStorage` only and never sent to any server other than Anthropic's.

---

## Project Structure

```
src/
  app/
    page.tsx              # Dashboard
    explore/page.tsx      # Course Explorer
    graph/page.tsx        # Knowledge Graph (data layer)
    suggest/page.tsx      # AI Advisor
    api/
      suggest/            # Streaming course recommendations
      knowledge-summary/  # Streaming knowledge profile
  components/
    Dashboard.tsx
    CourseExplorer.tsx
    KnowledgeGraph.tsx    # Canvas graph + force simulation
    AISuggest.tsx
    Nav.tsx
  lib/
    types.ts
    useSaved.ts
    useTaken.ts
data/
  courses.json            # 6,042 courses with topic labels
```

---

## Schools

| Code | School |
|------|--------|
| FAS | Faculty of Arts & Sciences |
| GSD | Graduate School of Design |
| HBS | Business School |
| HDS | Divinity School |
| HGSE | Graduate School of Education |
| HKS | Kennedy School |
| HLS | Law School |
| HSPH | School of Public Health |
