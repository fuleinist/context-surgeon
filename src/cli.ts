#!/usr/bin/env node
import { Command } from 'commander';
import * as path from 'path';
import { buildIndex, loadIndex, saveIndex } from './indexer';
import { scoreFiles } from './scorer';
import { generatePack, savePack } from './packer';

const program = new Command();

program
  .name('cs')
  .description('Surgical context window manager for AI coding agents')
  .version('0.1.0');

program
  .command('index')
  .description('Build or rebuild the codebase index')
  .argument('[directory]', 'Target directory', '.')
  .action(async (dir: string) => {
    const rootDir = path.resolve(dir);
    console.log(`Indexing ${rootDir}...`);
    const index = await buildIndex(rootDir);
    saveIndex(rootDir, index);
    console.log(`Indexed ${index.files.length} files (${index.totalTokens.toLocaleString()} tokens)`);
    console.log(`Index saved to .context-surgeon/index.json`);
  });

program
  .command('score')
  .description('Score files by relevance to a task')
  .argument('<task>', 'Task description')
  .argument('[directory]', 'Target directory', '.')
  .action((task: string, dir: string) => {
    const rootDir = path.resolve(dir);
    const index = loadIndex(rootDir);
    if (!index) {
      console.error('No index found. Run "cs index" first.');
      process.exit(1);
    }
    const results = scoreFiles(index, task);
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
  .action((task: string, dir: string, opts: { maxTokens: string }) => {
    const rootDir = path.resolve(dir);
    const index = loadIndex(rootDir);
    if (!index) {
      console.error('No index found. Run "cs index" first.');
      process.exit(1);
    }
    const maxTokens = parseInt(opts.maxTokens, 10);
    const scores = scoreFiles(index, task);
    const pack = generatePack(index, scores, maxTokens);
    const packPath = savePack(rootDir, pack);
    console.log(`Pack generated: ${packPath}`);
    console.log(`Files: ${pack.files.length} | Tokens: ~${pack.totalTokens}/${maxTokens}`);
  });

program
  .command('stats')
  .description('Show index statistics')
  .argument('[directory]', 'Target directory', '.')
  .action((dir: string) => {
    const rootDir = path.resolve(dir);
    const index = loadIndex(rootDir);
    if (!index) {
      console.error('No index found. Run "cs index" first.');
      process.exit(1);
    }
    console.log(`Index for: ${index.rootDir}`);
    console.log(`Created: ${index.createdAt}`);
    console.log(`Files: ${index.files.length}`);
    console.log(`Total tokens: ${index.totalTokens.toLocaleString()}`);
    const langs: Record<string, number> = {};
    for (const f of index.files) {
      langs[f.language] = (langs[f.language] || 0) + 1;
    }
    console.log('Languages:');
    for (const [lang, count] of Object.entries(langs).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${lang}: ${count} files`);
    }
  });

program.parse();
