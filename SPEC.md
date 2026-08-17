# Context Surgeon — Spec

## Problem
AI coding agents (Claude Code, Cursor, etc.) waste tokens reading irrelevant files. Context windows are expensive — every irrelevant token burned is money lost and accuracy degraded.

## Solution
A CLI tool that analyzes your codebase, scores every file by relevance to a given task, and produces an optimized context pack the agent should read.

## Features (MVP)

### 1. Codebase Indexing (`cs index`)
- Walk a directory tree, parse files with tree-sitter
- Extract symbols (functions, classes, imports, exports)
- Build an in-memory graph of file→symbol→reference relationships
- Store index as JSON in `.context-surgeon/index.json`

### 2. Relevance Scoring (`cs score <task description>`)
- Take a natural-language task description
- Score each file by:
  - **Keyword match**: symbol names, comments, strings matching task keywords
  - **Graph proximity**: files that import/refer to already-relevant files get boosted
  - **Recency**: recently modified files get a small boost
- Return ranked list with scores (0-100)

### 3. Context Pack Generation (`cs pack <task> --max-tokens N`)
- Take top-scored files until token budget is hit
- Output a single markdown file with:
  - File path header
  - File content (or extracted symbols only, for large files)
  - Token count per file
- Write to `.context-surgeon/pack.md`

### 4. CLI Interface
```
cs index [directory]        — build/rebuild the codebase index
cs score <task>             — show relevance scores for all files
cs pack <task> -n <tokens>  — generate optimized context pack
cs stats                    — show index stats (files, symbols, size)
```

## Tech Stack
- TypeScript (Node.js CLI)
- tree-sitter for parsing (TypeScript, Python, Rust, Go, Java)
- `cl100k_base` tiktoken for token counting
- No external API calls for MVP — pure local scoring

## File Structure
```
context-surgeon/
├── src/
│   ├── cli.ts            # CLI entry point (commander.js)
│   ├── indexer.ts        # Walk + parse + build index
│   ├── scorer.ts         # Relevance scoring engine
│   ├── packer.ts         # Context pack generator
│   ├── token-counter.ts  # Token counting wrapper
│   └── types.ts          # Shared types
├── package.json
├── tsconfig.json
└── README.md
```

## Acceptance Criteria
1. `cs index` on a small repo (<50 files) completes in <5s
2. `cs score "add user auth"` returns ranked list with plausible top files
3. `cs pack "add user auth" -n 2000` produces a pack under the token limit
4. Pack output is valid markdown with file paths and code blocks
5. Works on TypeScript and Python codebases out of the box
6. All tests pass (`npm test`)

## Out of Scope (v1)
- Embedding-based semantic scoring (v2)
- VS Code extension (v2)
- Watch mode / incremental indexing (v2)
- Remote/cloud features
