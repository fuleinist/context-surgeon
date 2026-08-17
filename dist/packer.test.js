"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const packer_1 = require("./packer");
function makeFile(path, content, tokenCount) {
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
(0, vitest_1.describe)('generatePack', () => {
    (0, vitest_1.it)('includes top-scored files within token budget', () => {
        const index = {
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
        const scores = [
            { file: 'a.ts', score: 50, reasons: ['keyword match'] },
            { file: 'b.ts', score: 30, reasons: ['keyword match'] },
            { file: 'c.ts', score: 10, reasons: [] },
        ];
        const pack = (0, packer_1.generatePack)(index, scores, 250);
        (0, vitest_1.expect)(pack.files).toContain('a.ts');
        (0, vitest_1.expect)(pack.files).toContain('b.ts');
        (0, vitest_1.expect)(pack.files.length).toBe(2);
    });
    (0, vitest_1.it)('stops at token budget', () => {
        const index = {
            version: '0.1.0',
            createdAt: new Date().toISOString(),
            rootDir: '.',
            files: [
                makeFile('big.ts', 'x'.repeat(4000), 1000),
                makeFile('small.ts', 'y', 10),
            ],
            totalTokens: 1010,
        };
        const scores = [
            { file: 'big.ts', score: 50, reasons: [] },
            { file: 'small.ts', score: 40, reasons: [] },
        ];
        const pack = (0, packer_1.generatePack)(index, scores, 500);
        (0, vitest_1.expect)(pack.files).toContain('big.ts');
        (0, vitest_1.expect)(pack.files).not.toContain('small.ts');
    });
    (0, vitest_1.it)('skips files with zero score', () => {
        const index = {
            version: '0.1.0',
            createdAt: new Date().toISOString(),
            rootDir: '.',
            files: [
                makeFile('relevant.ts', 'code', 50),
                makeFile('irrelevant.ts', 'code', 50),
            ],
            totalTokens: 100,
        };
        const scores = [
            { file: 'relevant.ts', score: 50, reasons: [] },
            { file: 'irrelevant.ts', score: 0, reasons: [] },
        ];
        const pack = (0, packer_1.generatePack)(index, scores, 500);
        (0, vitest_1.expect)(pack.files).toEqual(['relevant.ts']);
    });
    (0, vitest_1.it)('produces valid markdown output', () => {
        const index = {
            version: '0.1.0',
            createdAt: new Date().toISOString(),
            rootDir: '.',
            files: [makeFile('test.ts', 'const x = 1;', 10)],
            totalTokens: 10,
        };
        const scores = [
            { file: 'test.ts', score: 50, reasons: [] },
        ];
        const pack = (0, packer_1.generatePack)(index, scores, 100);
        (0, vitest_1.expect)(pack.content).toContain('# Context Pack');
        (0, vitest_1.expect)(pack.content).toContain('## test.ts');
        (0, vitest_1.expect)(pack.content).toContain('```ts');
    });
});
