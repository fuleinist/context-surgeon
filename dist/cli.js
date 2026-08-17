#!/usr/bin/env node
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
const commander_1 = require("commander");
const path = __importStar(require("path"));
const indexer_1 = require("./indexer");
const scorer_1 = require("./scorer");
const packer_1 = require("./packer");
const program = new commander_1.Command();
program
    .name('cs')
    .description('Surgical context window manager for AI coding agents')
    .version('0.1.0');
program
    .command('index')
    .description('Build or rebuild the codebase index')
    .argument('[directory]', 'Target directory', '.')
    .action(async (dir) => {
    const rootDir = path.resolve(dir);
    console.log(`Indexing ${rootDir}...`);
    const index = await (0, indexer_1.buildIndex)(rootDir);
    (0, indexer_1.saveIndex)(rootDir, index);
    console.log(`Indexed ${index.files.length} files (${index.totalTokens.toLocaleString()} tokens)`);
    console.log(`Index saved to .context-surgeon/index.json`);
});
program
    .command('score')
    .description('Score files by relevance to a task')
    .argument('<task>', 'Task description')
    .argument('[directory]', 'Target directory', '.')
    .action((task, dir) => {
    const rootDir = path.resolve(dir);
    const index = (0, indexer_1.loadIndex)(rootDir);
    if (!index) {
        console.error('No index found. Run "cs index" first.');
        process.exit(1);
    }
    const results = (0, scorer_1.scoreFiles)(index, task);
    console.log(`\nRelevance scores for: "${task}"\n`);
    console.log('Rank  Score  File');
    console.log('────  ─────  ────');
    results.slice(0, 20).forEach((r, i) => {
        const rank = String(i + 1).padStart(4);
        const score = String(r.score).padStart(5);
        console.log(`${rank}  ${score}  ${r.file}`);
        if (r.reasons.length > 0) {
            console.log(`         ${r.reasons.join(', ')}`);
        }
    });
    if (results.length > 20) {
        console.log(`\n... and ${results.length - 20} more files`);
    }
});
program
    .command('pack')
    .description('Generate an optimized context pack')
    .argument('<task>', 'Task description')
    .argument('[directory]', 'Target directory', '.')
    .option('-n, --max-tokens <number>', 'Token budget', '2000')
    .action((task, dir, opts) => {
    const rootDir = path.resolve(dir);
    const index = (0, indexer_1.loadIndex)(rootDir);
    if (!index) {
        console.error('No index found. Run "cs index" first.');
        process.exit(1);
    }
    const maxTokens = parseInt(opts.maxTokens, 10);
    const scores = (0, scorer_1.scoreFiles)(index, task);
    const pack = (0, packer_1.generatePack)(index, scores, maxTokens);
    const packPath = (0, packer_1.savePack)(rootDir, pack);
    console.log(`Pack generated: ${packPath}`);
    console.log(`Files: ${pack.files.length} | Tokens: ~${pack.totalTokens}/${maxTokens}`);
});
program
    .command('stats')
    .description('Show index statistics')
    .argument('[directory]', 'Target directory', '.')
    .action((dir) => {
    const rootDir = path.resolve(dir);
    const index = (0, indexer_1.loadIndex)(rootDir);
    if (!index) {
        console.error('No index found. Run "cs index" first.');
        process.exit(1);
    }
    console.log(`Index for: ${index.rootDir}`);
    console.log(`Created: ${index.createdAt}`);
    console.log(`Files: ${index.files.length}`);
    console.log(`Total tokens: ${index.totalTokens.toLocaleString()}`);
    const langs = {};
    for (const f of index.files) {
        langs[f.language] = (langs[f.language] || 0) + 1;
    }
    console.log('Languages:');
    for (const [lang, count] of Object.entries(langs).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${lang}: ${count} files`);
    }
});
program.parse();
