"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePack = generatePack;
exports.savePack = savePack;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function generatePack(index, scores, maxTokens) {
    const fileMap = new Map(index.files.map(f => [f.path, f]));
    const lines = [];
    const includedFiles = [];
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
    const bodyLines = [];
    for (const score of ranked) {
        if (score.score === 0)
            continue;
        const file = fileMap.get(score.file);
        if (!file)
            continue;
        const fileTokens = file.tokenCount;
        if (tokensUsed + fileTokens > maxTokens && includedFiles.length > 0)
            continue;
        bodyLines.push(`## ${file.path}`);
        lines.push('');
        bodyLines.push(`**Score:** ${score.score} | **Tokens:** ~${fileTokens}`);
        bodyLines.push('');
        // For small files, include full content; for large files, include symbols + imports
        if (fileTokens < 500) {
            bodyLines.push('```' + file.language);
            bodyLines.push(file.content);
            bodyLines.push('```');
        }
        else {
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
function savePack(rootDir, pack) {
    const packPath = path.join(rootDir, '.context-surgeon', 'pack.md');
    fs.mkdirSync(path.dirname(packPath), { recursive: true });
    fs.writeFileSync(packPath, pack.content);
    return packPath;
}
