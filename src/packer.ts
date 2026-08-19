import * as fs from 'fs';
import * as path from 'path';
import { IndexData, ScoreResult } from './types';
import { estimateTokens } from './token-counter';

interface PackResult {
  content: string;
  files: string[];
  totalTokens: number;
}

export function generatePack(
  index: IndexData,
  scores: ScoreResult[],
  maxTokens: number
): PackResult {
  const fileMap = new Map(index.files.map(f => [f.path, f]));
  const lines: string[] = [];
  const includedFiles: string[] = [];
  let tokensUsed = 0;

  // Header
  lines.push('# Context Pack');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Token budget: ${maxTokens}`);
  lines.push('');

  // Defensive: ensure descending score order regardless of caller
  const ranked = [...scores].sort((a, b) => b.score - a.score);

  // Greedy fill: skip files that don't fit the remaining budget and keep
  // trying smaller ones, rather than stopping at the first oversized file.
  const bodyLines: string[] = [];
  for (const score of ranked) {
    if (score.score === 0) continue;
    const file = fileMap.get(score.file);
    if (!file) continue;

    const fileTokens = file.tokenCount;
    if (tokensUsed + fileTokens > maxTokens && includedFiles.length > 0) continue;

    bodyLines.push(`## ${file.path}`);
    lines.push('');
    bodyLines.push(`**Score:** ${score.score} | **Tokens:** ~${fileTokens}`);
    bodyLines.push('');

    // For small files, include full content; for large files, include symbols + imports
    if (fileTokens < 500) {
      bodyLines.push('```' + file.language);
      bodyLines.push(file.content);
      bodyLines.push('```');
    } else {
      bodyLines.push('### Symbols');
      bodyLines.push('```');
      for (const sym of file.symbols) {
        bodyLines.push(`  ${sym.kind}: ${sym.name} (line ${sym.line})`);
      }
      bodyLines.push('```');
      if (file.imports.length > 0) {
        bodyLines.push('### Imports');
        bodyLines.push('```');
        for (const imp of file.imports) {
          bodyLines.push(`  ${imp}`);
        }
        bodyLines.push('```');
      }
    }
    bodyLines.push('');

    tokensUsed += fileTokens;
    includedFiles.push(file.path);
  }

  lines.push(...bodyLines);
  lines.push('---');
  lines.push(`Files: ${includedFiles.length}/${index.files.length} | Tokens: ~${tokensUsed}/${maxTokens}`);

  return {
    content: lines.join('\n'),
    files: includedFiles,
    totalTokens: tokensUsed,
  };
}

export function savePack(rootDir: string, pack: PackResult): string {
  const packPath = path.join(rootDir, '.context-surgeon', 'pack.md');
  fs.mkdirSync(path.dirname(packPath), { recursive: true });
  fs.writeFileSync(packPath, pack.content);
  return packPath;
}
