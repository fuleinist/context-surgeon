import { IndexData, ScoreResult } from './types';
interface PackResult {
    content: string;
    files: string[];
    totalTokens: number;
}
export declare function generatePack(index: IndexData, scores: ScoreResult[], maxTokens: number): PackResult;
export declare function savePack(rootDir: string, pack: PackResult): string;
export {};
