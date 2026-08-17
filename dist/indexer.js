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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildIndex = buildIndex;
exports.getIndexPath = getIndexPath;
exports.loadIndex = loadIndex;
exports.saveIndex = saveIndex;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const glob_1 = require("glob");
const tree_sitter_1 = __importDefault(require("tree-sitter"));
const tree_sitter_typescript_1 = __importDefault(require("tree-sitter-typescript"));
const tree_sitter_python_1 = __importDefault(require("tree-sitter-python"));
const tree_sitter_rust_1 = __importDefault(require("tree-sitter-rust"));
const tree_sitter_go_1 = __importDefault(require("tree-sitter-go"));
const token_counter_1 = require("./token-counter");
const LANGUAGE_MAP = {
    '.ts': { parser: tree_sitter_typescript_1.default, query: '(function_declaration name: (identifier) @name) (class_declaration name: (type_identifier) @name) (interface_declaration name: (type_identifier) @name)' },
    '.tsx': { parser: tree_sitter_typescript_1.default, query: '(function_declaration name: (identifier) @name) (class_declaration name: (type_identifier) @name)' },
    '.py': { parser: tree_sitter_python_1.default, query: '(function_definition name: (identifier) @name) (class_definition name: (identifier) @name)' },
    '.rs': { parser: tree_sitter_rust_1.default, query: '(function_item name: (identifier) @name) (struct_item name: (type_identifier) @name) (impl_item type: (type_identifier) @name)' },
    '.go': { parser: tree_sitter_go_1.default, query: '(function_declaration name: (identifier) @name) (type_declaration (type_spec name: (type_identifier) @name))' },
};
const IMPORT_QUERIES = {
    '.ts': '(import_statement source: (string) @module)',
    '.tsx': '(import_statement source: (string) @module)',
    '.py': '(import_from_statement module_name: (dotted_name (identifier) @module)) (import_statement name: (dotted_name (identifier) @module))',
    '.rs': '(use_declaration argument: (scoped_identifier path: (identifier) @module))',
    '.go': '(import_spec path: (interpreted_string_literal) @module)',
};
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'target', 'vendor']);
function shouldIgnore(filePath) {
    const parts = filePath.split(path.sep);
    return parts.some(p => IGNORED_DIRS.has(p));
}
function extractSymbols(parser, source, ext) {
    const tree = parser.parse(source);
    const lang = parser.getLanguage();
    const queryStr = LANGUAGE_MAP[ext]?.query;
    if (!queryStr)
        return [];
    try {
        const query = new tree_sitter_1.default.Query(lang, queryStr);
        const captures = query.captures(tree.rootNode);
        return captures.map((c) => ({
            name: c.node.text,
            kind: c.node.parent?.type || 'unknown',
            line: c.node.startPosition.row + 1,
        }));
    }
    catch {
        return [];
    }
}
function extractImports(parser, source, ext) {
    const tree = parser.parse(source);
    const lang = parser.getLanguage();
    const queryStr = IMPORT_QUERIES[ext];
    if (!queryStr)
        return [];
    try {
        const query = new tree_sitter_1.default.Query(lang, queryStr);
        const captures = query.captures(tree.rootNode);
        return captures.map((c) => c.node.text.replace(/['"]/g, ''));
    }
    catch {
        return [];
    }
}
async function buildIndex(rootDir) {
    const allExts = Object.keys(LANGUAGE_MAP);
    const patterns = allExts.map(ext => `**/*${ext}`);
    const files = await (0, glob_1.glob)(patterns, {
        cwd: rootDir,
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.git/**'],
        absolute: false,
    });
    const entries = [];
    for (const relPath of files) {
        const fullPath = path.join(rootDir, relPath);
        const ext = path.extname(relPath);
        const langConfig = LANGUAGE_MAP[ext];
        if (!langConfig)
            continue;
        try {
            const content = fs.readFileSync(fullPath, 'utf-8');
            const stat = fs.statSync(fullPath);
            const parser = new tree_sitter_1.default();
            parser.setLanguage(langConfig.parser);
            const symbols = extractSymbols(parser, content, ext);
            const imports = extractImports(parser, content, ext);
            entries.push({
                path: relPath,
                language: ext.slice(1),
                symbols,
                imports,
                content,
                mtime: stat.mtimeMs,
                tokenCount: (0, token_counter_1.estimateTokens)(content),
            });
        }
        catch {
            // skip unparseable files
        }
    }
    const totalTokens = entries.reduce((sum, e) => sum + e.tokenCount, 0);
    return {
        version: '0.1.0',
        createdAt: new Date().toISOString(),
        rootDir,
        files: entries,
        totalTokens,
    };
}
function getIndexPath(rootDir) {
    return path.join(rootDir, '.context-surgeon', 'index.json');
}
function loadIndex(rootDir) {
    const p = getIndexPath(rootDir);
    if (!fs.existsSync(p))
        return null;
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
}
function saveIndex(rootDir, index) {
    const p = getIndexPath(rootDir);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(index, null, 2));
}
