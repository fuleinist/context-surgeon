import { describe, it, expect } from 'vitest';
import { generatePack } from './packer';
import { IndexData, FileEntry, ScoreResult } from './types';

function makeFile(path: string, content: string, tokenCount: number): FileEntry {
  return {
    path,
    language: 'ts',
    symbols: [{ name: 'testFn', kind: 'function', line: 1 }],
    imports: [],
    content,
    mtime: Date.now(),
    tokenCount,
  };
}

describe('generatePack', () => {
  it('includes top-scored files within token budget', () => {
    const index: IndexData = {
      version: '0.1.0',
      createdAt: new Date().toISOString(),
      rootDir: '.',
      files: [
        makeFile('a.ts', 'code a', 100),
        makeFile('b.ts', 'code b', 100),
        makeFile('c.ts', 'code c', 100),
      ],
      totalTokens: 300,
    };

    const scores: ScoreResult[] = [
      { file: 'a.ts', score: 50, reasons: ['keyword match'] },
      { file: 'b.ts', score: 30, reasons: ['keyword match'] },
      { file: 'c.ts', score: 10, reasons: [] },
    ];

    const pack = generatePack(index, scores, 250);
    expect(pack.files).toContain('a.ts');
    expect(pack.files).toContain('b.ts');
    expect(pack.files.length).toBe(2);
  });

  it('stops at token budget', () => {
    const index: IndexData = {
      version: '0.1.0',
      createdAt: new Date().toISOString(),
      rootDir: '.',
      files: [
        makeFile('big.ts', 'x'.repeat(4000), 1000),
        makeFile('small.ts', 'y', 10),
      ],
      totalTokens: 1010,
    };

    const scores: ScoreResult[] = [
      { file: 'big.ts', score: 50, reasons: [] },
      { file: 'small.ts', score: 40, reasons: [] },
    ];

    const pack = generatePack(index, scores, 500);
    expect(pack.files).toContain('big.ts');
    expect(pack.files).not.toContain('small.ts');
  });

  it('greedy-fills: skips oversized files and includes smaller later ones', () => {
    const index: IndexData = {
      version: '0.1.0',
      createdAt: new Date().toISOString(),
      rootDir: '.',
      files: [
        makeFile('a.ts', 'code a', 100),
        makeFile('huge.ts', 'x'.repeat(4000), 1000),
        makeFile('c.ts', 'code c', 40),
      ],
      totalTokens: 1140,
    };

    const scores: ScoreResult[] = [
      { file: 'a.ts', score: 50, reasons: [] },
      { file: 'huge.ts', score: 40, reasons: [] },
      { file: 'c.ts', score: 30, reasons: [] },
    ];

    const pack = generatePack(index, scores, 150);
    expect(pack.files).toEqual(['a.ts', 'c.ts']);
    expect(pack.totalTokens).toBe(140);
  });

  it('sorts unsorted scores descending before packing', () => {
    const index: IndexData = {
      version: '0.1.0',
      createdAt: new Date().toISOString(),
      rootDir: '.',
      files: [
        makeFile('low.ts', 'code', 10),
        makeFile('high.ts', 'code', 10),
      ],
      totalTokens: 20,
    };

    const scores: ScoreResult[] = [
      { file: 'low.ts', score: 10, reasons: [] },
      { file: 'high.ts', score: 90, reasons: [] },
    ];

    const pack = generatePack(index, scores, 100);
    expect(pack.files).toEqual(['high.ts', 'low.ts']);
  });

  it('skips files with zero score', () => {
    const index: IndexData = {
      version: '0.1.0',
      createdAt: new Date().toISOString(),
      rootDir: '.',
      files: [
        makeFile('relevant.ts', 'code', 50),
        makeFile('irrelevant.ts', 'code', 50),
      ],
      totalTokens: 100,
    };

    const scores: ScoreResult[] = [
      { file: 'relevant.ts', score: 50, reasons: [] },
      { file: 'irrelevant.ts', score: 0, reasons: [] },
    ];

    const pack = generatePack(index, scores, 500);
    expect(pack.files).toEqual(['relevant.ts']);
  });

  it('produces valid markdown output', () => {
    const index: IndexData = {
      version: '0.1.0',
      createdAt: new Date().toISOString(),
      rootDir: '.',
      files: [makeFile('test.ts', 'const x = 1;', 10)],
      totalTokens: 10,
    };

    const scores: ScoreResult[] = [
      { file: 'test.ts', score: 50, reasons: [] },
    ];

    const pack = generatePack(index, scores, 100);
    expect(pack.content).toContain('# Context Pack');
    expect(pack.content).toContain('## test.ts');
    expect(pack.content).toContain('```ts');
  });
});
