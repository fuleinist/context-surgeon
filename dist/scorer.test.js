"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const scorer_1 = require("./scorer");
function makeFile(partial) {
    return {
        language: 'ts',
        symbols: [],
        imports: [],
        content: '',
        mtime: Date.now() - 86400000, // 1 day ago
        tokenCount: 100,
        ...partial,
    };
}
function makeIndex(files) {
    return {
        version: '0.1.0',
        createdAt: new Date().toISOString(),
        rootDir: '.',
        files,
        totalTokens: files.reduce((s, f) => s + f.tokenCount, 0),
    };
}
(0, vitest_1.describe)('scoreFiles', () => {
    (0, vitest_1.it)('ranks files with matching keywords higher', () => {
        const index = makeIndex([
            makeFile({ path: 'src/auth/login.ts', content: 'function authenticateUser() { return checkPasswordHash() }', symbols: [{ name: 'authenticateUser', kind: 'function', line: 1 }] }),
            makeFile({ path: 'src/utils/math.ts', content: 'function add(a, b) { return a + b }', symbols: [{ name: 'add', kind: 'function', line: 1 }] }),
            makeFile({ path: 'src/auth/session.ts', content: 'function createSession() { return generateToken() }', symbols: [{ name: 'createSession', kind: 'function', line: 1 }] }),
        ]);
        const results = (0, scorer_1.scoreFiles)(index, 'add user authentication');
        (0, vitest_1.expect)(results[0].file).toBe('src/auth/login.ts');
        (0, vitest_1.expect)(results[0].score).toBeGreaterThan(results[1].score);
    });
    (0, vitest_1.it)('gives zero scores for empty task', () => {
        const index = makeIndex([
            makeFile({ path: 'src/index.ts', content: 'hello world' }),
        ]);
        const results = (0, scorer_1.scoreFiles)(index, '');
        (0, vitest_1.expect)(results[0].score).toBe(0);
    });
    (0, vitest_1.it)('boosts files with matching symbol names', () => {
        const index = makeIndex([
            makeFile({ path: 'src/api.ts', content: 'api stuff', symbols: [{ name: 'handleRequest', kind: 'function', line: 1 }] }),
            makeFile({ path: 'src/db.ts', content: 'database', symbols: [{ name: 'connectDB', kind: 'function', line: 1 }] }),
        ]);
        const results = (0, scorer_1.scoreFiles)(index, 'handle request processing');
        (0, vitest_1.expect)(results[0].file).toBe('src/api.ts');
    });
    (0, vitest_1.it)('penalizes test files when task is not about testing', () => {
        const index = makeIndex([
            makeFile({ path: 'src/auth.test.ts', content: 'test authentication logic', symbols: [{ name: 'test', kind: 'function', line: 1 }] }),
            makeFile({ path: 'src/auth.ts', content: 'authentication logic', symbols: [{ name: 'auth', kind: 'function', line: 1 }] }),
        ]);
        const results = (0, scorer_1.scoreFiles)(index, 'authentication logic');
        // Non-test file should rank higher despite similar content
        (0, vitest_1.expect)(results[0].file).toBe('src/auth.ts');
    });
    (0, vitest_1.it)('applies recency boost to recently modified files', () => {
        const index = makeIndex([
            makeFile({ path: 'old.ts', content: 'authentication', mtime: Date.now() - 30 * 86400000 }),
            makeFile({ path: 'new.ts', content: 'authentication', mtime: Date.now() }),
        ]);
        const results = (0, scorer_1.scoreFiles)(index, 'authentication');
        (0, vitest_1.expect)(results[0].file).toBe('new.ts');
    });
});
