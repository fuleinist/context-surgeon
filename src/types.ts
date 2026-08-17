export interface SymbolInfo {
  name: string;
  kind: string; // function, class, interface, import, etc.
  line: number;
}

export interface FileEntry {
  path: string;
  language: string;
  symbols: SymbolInfo[];
  imports: string[];
  content: string;
  mtime: number;
  tokenCount: number;
}

export interface IndexData {
  version: string;
  createdAt: string;
  rootDir: string;
  files: FileEntry[];
  totalTokens: number;
}

export interface ScoreResult {
  file: string;
  score: number;
  reasons: string[];
}
