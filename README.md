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
> A user types ‘What projects show my Kubernetes skills?’ → The system uses embeddings to find resume/portfolio chunks that mention Kubernetes work → LLM crafts a response using those.”

