import { IndexData } from './types';
export declare function buildIndex(rootDir: string): Promise<IndexData>;
export declare function getIndexPath(rootDir: string): string;
export declare function loadIndex(rootDir: string): IndexData | null;
export declare function saveIndex(rootDir: string, index: IndexData): void;
