import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import Parser from 'tree-sitter';
import TS from 'tree-sitter-typescript';
import Python from 'tree-sitter-python';
import Rust from 'tree-sitter-rust';
import Go from 'tree-sitter-go';
import Java from 'tree-sitter-java';
import { FileEntry, IndexData, SymbolInfo } from './types';
import { estimateTokens } from './token-counter';

const LANGUAGE_MAP: Record<string, { parser: any; query: string }> = {
  '.ts': { parser: TS, query: '(function_declaration name: (identifier) @name) (class_declaration name: (type_identifier) @name) (interface_declaration name: (type_identifier) @name)' },
  '.tsx': { parser: TS, query: '(function_declaration name: (identifier) @name) (class_declaration name: (type_identifier) @name)' },
  '.py': { parser: Python, query: '(function_definition name: (identifier) @name) (class_definition name: (identifier) @name)' },
  '.rs': { parser: Rust, query: '(function_item name: (identifier) @name) (struct_item name: (type_identifier) @name) (impl_item type: (type_identifier) @name)' },
  '.go': { parser: Go, query: '(function_declaration name: (identifier) @name) (type_declaration (type_spec name: (type_identifier) @name))' },
  '.java': { parser: Java, query: '(method_declaration name: (identifier) @name) (class_declaration name: (identifier) @name) (interface_declaration name: (identifier) @name)' },
};

const IMPORT_QUERIES: Record<string, string> = {
  '.ts': '(import_statement source: (string) @module)',
  '.tsx': '(import_statement source: (string) @module)',
  '.py': '(import_from_statement module_name: (dotted_name (identifier) @module)) (import_statement name: (dotted_name (identifier) @module))',
  '.rs': '(use_declaration argument: (scoped_identifier path: (identifier) @module))',
  '.go': '(import_spec path: (interpreted_string_literal) @module)',
  '.java': '(import_declaration (scoped_identifier) @module)',
};

// Some tree-sitter grammar packages export { languageName: Language } (e.g.
// tree-sitter-typescript -> { typescript, tsx }) instead of the language
// object itself. Unwrap until we get something setLanguage() accepts.
function resolveLanguage(mod: any): any {
  if (!mod) return mod;
  if (typeof mod.name === 'string') return mod; // already a Language object
  if (typeof mod === 'object') {
    for (const key of Object.keys(mod)) {
      const candidate = mod[key];
      if (candidate && typeof candidate.name === 'string') return candidate;
    }
  }
  return mod;
}

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'target', 'vendor']);

function shouldIgnore(filePath: string): boolean {
  const parts = filePath.split(path.sep);
  return parts.some(p => IGNORED_DIRS.has(p));
}

function extractSymbols(parser: Parser, source: string, ext: string): SymbolInfo[] {
  const tree = parser.parse(source);
  const lang = parser.getLanguage();
  const queryStr = LANGUAGE_MAP[ext]?.query;
  if (!queryStr) return [];

  try {
    const query = new Parser.Query(lang, queryStr);
    const captures = query.captures(tree.rootNode);
    return captures.map((c: any) => ({
      name: c.node.text,
      kind: c.node.parent?.type || 'unknown',
      line: c.node.startPosition.row + 1,
    }));
  } catch {
    return [];
  }
}

function extractImports(parser: Parser, source: string, ext: string): string[] {
  const tree = parser.parse(source);
  const lang = parser.getLanguage();
  const queryStr = IMPORT_QUERIES[ext];
  if (!queryStr) return [];

  try {
    const query = new Parser.Query(lang, queryStr);
    const captures = query.captures(tree.rootNode);
    return captures.map((c: any) => c.node.text.replace(/['"]/g, ''));
  } catch {
    return [];
  }
}

export async function buildIndex(rootDir: string): Promise<IndexData> {
  const allExts = Object.keys(LANGUAGE_MAP);
  const patterns = allExts.map(ext => `**/*${ext}`);
  const files = await glob(patterns, {
    cwd: rootDir,
    ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
    absolute: false,
  });

  const entries: FileEntry[] = [];

  for (const relPath of files) {
    const fullPath = path.join(rootDir, relPath);
    const ext = path.extname(relPath);
    const langConfig = LANGUAGE_MAP[ext];
    if (!langConfig) continue;

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const stat = fs.statSync(fullPath);

      const parser = new Parser();
      parser.setLanguage(resolveLanguage(langConfig.parser));

      const symbols = extractSymbols(parser, content, ext);
      const imports = extractImports(parser, content, ext);

      entries.push({
        path: relPath,
        language: ext.slice(1),
        symbols,
        imports,
        content,
        mtime: stat.mtimeMs,
        tokenCount: estimateTokens(content),
      });
    } catch {
      // skip unparseable files
    }
  }

  const totalTokens = entries.reduce((sum, e) => sum + e.tokenCount, 0);

  return {
    version: '0.1.0',
    createdAt: new Date().toISOString(),
    rootDir,
    files: entries,
    totalTokens,
  };
}

export function getIndexPath(rootDir: string): string {
  return path.join(rootDir, '.context-surgeon', 'index.json');
}

export function loadIndex(rootDir: string): IndexData | null {
  const p = getIndexPath(rootDir);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

export function saveIndex(rootDir: string, index: IndexData): void {
  const p = getIndexPath(rootDir);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(index, null, 2));
}
