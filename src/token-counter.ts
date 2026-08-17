let encoder: any = null;

async function getEncoder() {
  if (!encoder) {
    const { getEncoding } = await import('js-tiktoken');
    encoder = getEncoding('cl100k_base');
  }
  return encoder;
}

export async function countTokens(text: string): Promise<number> {
  const enc = await getEncoder();
  return enc.encode(text).length;
}

export function estimateTokens(text: string): number {
  // Fast heuristic: ~4 chars per token for code
  return Math.ceil(text.length / 4);
}
