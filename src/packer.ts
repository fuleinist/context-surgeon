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

  for (const score of scores) {
    if (score.score === 0) continue;
    const file = fileMap.get(score.file);
    if (!file) continue;

    const fileTokens = file.tokenCount;
    if (tokensUsed + fileTokens > maxTokens && includedFiles.length > 0) break;

    lines.push(`## ${file.path}`);
    lines.push('');
    lines.push(`**Score:** ${score.score} | **Tokens:** ~${fileTokens}`);
    lines.push('');

    // For small files, include full content; for large files, include symbols + imports
    if (fileTokens < 500) {
      lines.push('```' + file.language);
      lines.push(file.content);
      lines.push('```');
    } else {
      lines.push('### Symbols');
      lines.push('```');
      for (const sym of file.symbols) {
        lines.push(`  ${sym.kind}: ${sym.name} (line ${sym.line})`);
      }
      lines.push('```');
      if (file.imports.length > 0) {
        lines.push('### Imports');
        lines.push('```');
        for (const imp of file.imports) {
          lines.push(`  ${imp}`);
        }
        lines.push('```');
      }
    }
    lines.push('');

    tokensUsed += fileTokens;
    includedFiles.push(file.path);
  }

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
