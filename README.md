# Wadood Subsystem for Linux

## 🚀 Overhaul of Portfolio Website http://wadoodsultan.com

- Change the entire layout
- Make the UI more intuitive
- Do not spend more time on JS
- Learn the AWS implementation
- Learn the GenAI integration with the Website
- Keep data privacy in mind

## 🧞 Commands

All commands are run from the root of the project, from a terminal:

| Command                   | Action                                           |
| :------------------------ | :----------------------------------------------- |
| `npm install`             | Installs dependencies                            |
| `npm run dev`             | Starts local dev server at `localhost:4321`      |
| `npm run build`           | Build your production site to `./dist/`          |
| `npm run preview`         | Preview your build locally, before deploying     |
| `npm run astro ...`       | Run CLI commands like `astro add`, `astro check` |

## AI Architecture 

```
Resume/Data → Chunking → Embeddings → Vector DB
                                            ↓
User Question → Embed → Similarity Search → Context
                                            ↓
                        LLM + Context → Response
```

## Overview of Architecture 

```
GitHub Repo (Public):
├── src/components/Terminal.astro
├── src/lib/rag-system.js 
├── src/data/
│   ├── template-resume.md (example data)
│   └── data-schema.md (format documentation)
├── README.md (how others can use it)

AWS S3 (Private):
├── professional.md (your real data)
├── conferences.md  
└── personal.md

Astro Build Process:
- Fetches real data from S3
- Template data or own S3
```
