import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { buildIndex } from './indexer';

describe('buildIndex', () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-test-'));
    fs.writeFileSync(
      path.join(tmpDir, 'hello.ts'),
      'export function greet(name: string): string {\n  return `hi ${name}`;\n}\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, 'main.py'),
      'def add(a, b):\n    return a + b\n'
    );
    fs.writeFileSync(
      path.join(tmpDir, 'App.java'),
      'import java.util.List;\n\npublic class App {\n    public int add(int a, int b) {\n        return a + b;\n    }\n}\n'
    );
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('indexes TypeScript, Python, and Java files with symbols', async () => {
    const index = await buildIndex(tmpDir);
    expect(index.files.length).toBe(3);

    const ts = index.files.find(f => f.path.includes('hello.ts'))!;
    expect(ts.symbols.some(s => s.name === 'greet')).toBe(true);

    const py = index.files.find(f => f.path.includes('main.py'))!;
    expect(py.symbols.some(s => s.name === 'add')).toBe(true);

    const java = index.files.find(f => f.path.includes('App.java'))!;
    expect(java.symbols.some(s => s.name === 'App')).toBe(true);
    expect(java.symbols.some(s => s.name === 'add')).toBe(true);
    expect(java.imports.some(i => i.includes('java.util.List'))).toBe(true);
  });

  it('counts tokens for every indexed file', async () => {
    const index = await buildIndex(tmpDir);
    expect(index.totalTokens).toBeGreaterThan(0);
    for (const f of index.files) expect(f.tokenCount).toBeGreaterThan(0);
  });

  it('ignores node_modules and dist', async () => {
    fs.mkdirSync(path.join(tmpDir, 'node_modules', 'junk'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'node_modules', 'junk', 'x.ts'), 'const x = 1;');
    fs.mkdirSync(path.join(tmpDir, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'dist', 'y.ts'), 'const y = 2;');

    const index = await buildIndex(tmpDir);
    const paths = index.files.map(f => f.path.replace(/\\/g, '/'));
    expect(paths.some(p => p.includes('node_modules'))).toBe(false);
    expect(paths.some(p => p.includes('dist'))).toBe(false);
  });
});
