"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreFiles = scoreFiles;
function tokenize(text) {
    return text.toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean);
}
function extractTaskKeywords(task) {
    const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'and', 'but', 'or', 'not', 'no', 'this', 'that', 'it', 'its', 'my', 'your', 'our', 'their', 'add', 'create', 'make', 'get', 'set', 'update', 'delete', 'remove', 'find', 'use', 'using', 'new', 'old', 'how', 'what', 'which', 'who', 'when', 'where', 'why', 'i', 'we', 'you', 'they']);
    return tokenize(task).filter(w => !stopWords.has(w) && w.length > 2);
}
function baseScore(file, keywords) {
    const reasons = [];
    let score = 0;
    const fileText = file.content.toLowerCase();
    const fileName = file.path.toLowerCase();
    const symbolNames = file.symbols.map(s => s.name.toLowerCase()).join(' ');
    // Keyword match in content
    let keywordHits = 0;
    for (const kw of keywords) {
        if (fileText.includes(kw))
            keywordHits++;
        if (fileName.includes(kw))
            keywordHits += 2;
        if (symbolNames.includes(kw))
            keywordHits += 3;
    }
    if (keywordHits > 0) {
        score += Math.min(keywordHits * 5, 40);
        reasons.push(`${keywordHits} keyword matches`);
    }
    // Symbol density bonus (files with more matching symbols)
    const matchingSymbols = file.symbols.filter(s => keywords.some(kw => s.name.toLowerCase().includes(kw)));
    if (matchingSymbols.length > 0) {
        score += matchingSymbols.length * 8;
        reasons.push(`${matchingSymbols.length} matching symbols`);
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
// Normalize a file path (minus extension) into a forward-slash stem so it
// can be matched against import specifiers, which always use forward slashes.
function importKey(filePath) {
    return filePath.replace(/\.[^.]+$/, '').replace(/\\/g, '/');
}
function scoreFiles(index, task) {
    const keywords = extractTaskKeywords(task);
    if (keywords.length === 0) {
        return index.files.map(f => ({ file: f.path, score: 0, reasons: ['no extractable keywords'] }));
    }
    // Pass 1: base scores (keywords, symbols, recency, penalties).
    const base = index.files.map(file => ({ file, ...baseScore(file, keywords) }));
    // Pass 2: graph proximity — boost files imported by already-relevant files.
    return base
        .map(({ file, score, reasons }) => {
        const key = importKey(file.path);
        let boost = 0;
        let relevantImporters = 0;
        for (const other of base) {
            if (other.file === file || other.score <= 0)
                continue;
            if (!other.file.imports.some(imp => {
                const spec = imp.replace(/['"]/g, '');
                const base = key.split('/').pop();
                return spec.includes(key) || spec.split('/').pop() === base;
            }))
                continue;
            relevantImporters++;
            boost += Math.min(Math.ceil(other.score / 5), 5);
            if (boost >= 15) {
                boost = 15;
                break;
            }
        }
        if (relevantImporters > 0) {
            score += boost;
            reasons.push(`imported by ${relevantImporters} relevant file${relevantImporters > 1 ? 's' : ''}`);
        }
        return { file: file.path, score, reasons };
    })
        .sort((a, b) => b.score - a.score);
}
