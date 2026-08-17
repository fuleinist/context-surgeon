import { IndexData, ScoreResult, FileEntry } from './types';

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean);
}

function extractTaskKeywords(task: string): string[] {
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'and', 'but', 'or', 'not', 'no', 'this', 'that', 'it', 'its', 'my', 'your', 'our', 'their', 'add', 'create', 'make', 'get', 'set', 'update', 'delete', 'remove', 'find', 'use', 'using', 'new', 'old', 'how', 'what', 'which', 'who', 'when', 'where', 'why', 'i', 'we', 'you', 'they']);
  return tokenize(task).filter(w => !stopWords.has(w) && w.length > 2);
}

function scoreFile(file: FileEntry, keywords: string[], allFiles: FileEntry[]): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const fileText = file.content.toLowerCase();
  const fileName = file.path.toLowerCase();
  const symbolNames = file.symbols.map(s => s.name.toLowerCase()).join(' ');

  // Keyword match in content
  let keywordHits = 0;
  for (const kw of keywords) {
    if (fileText.includes(kw)) keywordHits++;
    if (fileName.includes(kw)) keywordHits += 2;
    if (symbolNames.includes(kw)) keywordHits += 3;
  }
  if (keywordHits > 0) {
    score += Math.min(keywordHits * 5, 40);
    reasons.push(`${keywordHits} keyword matches`);
  }

  // Symbol density bonus (files with more matching symbols)
  const matchingSymbols = file.symbols.filter(s =>
    keywords.some(kw => s.name.toLowerCase().includes(kw))
  );
  if (matchingSymbols.length > 0) {
    score += matchingSymbols.length * 8;
    reasons.push(`${matchingSymbols.length} matching symbols`);
  }

  // Graph proximity: files imported by already-relevant files
  const importedBy = allFiles.filter(f =>
    f.imports.some(imp => imp.includes(file.path.replace(/\.[^.]+$/, '')))
  );
  if (importedBy.length > 0) {
    score += importedBy.length * 3;
    reasons.push(`imported by ${importedBy.length} files`);
  }

  // Recency boost (files modified in last 7 days)
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  if (file.mtime > weekAgo) {
    score += 5;
    reasons.push('recently modified');
  }

  // Penalize very large files (less likely to be focused)
  if (file.tokenCount > 2000) {
    score -= 10;
    reasons.push('large file penalty');
  }

  // Penalize test files slightly (unless task mentions testing)
  const isTest = file.path.includes('test') || file.path.includes('spec') || file.path.includes('__tests__');
  if (isTest && !keywords.some(kw => ['test', 'testing', 'spec'].includes(kw))) {
    score -= 5;
    reasons.push('test file penalty');
  }

  return { score: Math.max(0, score), reasons };
}

export function scoreFiles(index: IndexData, task: string): ScoreResult[] {
  const keywords = extractTaskKeywords(task);
  if (keywords.length === 0) {
    return index.files.map(f => ({ file: f.path, score: 0, reasons: ['no extractable keywords'] }));
  }

  return index.files
    .map(file => {
      const { score, reasons } = scoreFile(file, keywords, index.files);
      return { file: file.path, score, reasons };
    })
    .sort((a, b) => b.score - a.score);
}
