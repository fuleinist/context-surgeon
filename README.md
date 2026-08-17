# context-surgeon

Surgical context window manager for AI coding agents.

Stop wasting tokens. `cs` analyzes your codebase, scores every file by relevance to your task, and builds an optimized context pack that maximizes agent accuracy while minimizing token spend.

## Install

```bash
npm install
npm run build
npm link  # makes `cs` available globally
```

## Usage

```bash
# Index your codebase
cs index

# See relevance scores for a task
cs score "add user authentication"

# Generate an optimized context pack (default 2000 token budget)
cs pack "add user authentication" -n 2000

# Check index stats
cs stats
```

## How it works

1. **Index** — walks your repo, parses files with tree-sitter (TypeScript, Python, Rust, Go), extracts symbols and imports
2. **Score** — ranks files by keyword match, symbol overlap, graph proximity (imports), and recency
3. **Pack** — selects top files until token budget is hit, outputs a single markdown file ready to paste into your agent

## Architecture

```
src/
├── cli.ts           # CLI entry point (commander.js)
├── indexer.ts       # Codebase walking + tree-sitter parsing
├── scorer.ts        # Relevance scoring engine
├── packer.ts        # Context pack generator
├── token-counter.ts # Token counting (tiktoken)
└── types.ts         # Shared types
```

## Roadmap

- [ ] Embedding-based semantic scoring (v2)
- [ ] VS Code extension (v2)
- [ ] Watch mode / incremental indexing (v2)
- [ ] More language support (Java, C#, Ruby)
- [ ] Config file (`.context-surgeon/config.json`)

## License

MIT
