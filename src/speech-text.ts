const DEFAULT_SPEECH_CHUNK_LENGTH = 240;

export function sanitizeSpeechText(markdown: string): string {
  if (typeof markdown !== 'string') return '';
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/~~~[\s\S]*?~~~/g, ' ')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<https?:\/\/[^>]+>/gi, ' ')
    .replace(/https?:\/\/[^\s)>\]]+/gi, ' ')
    .replace(/^\s{0,3}(?:#{1,6}|>|[-+*]|\d+[.)])\s+/gm, '')
    .replace(/`([^`\n]+)`/g, '$1')
    .replace(/[*_~]{1,3}/g, '')
    .replace(/<\/?[^>\n]+>/g, ' ')
    .replace(/\s*\|\s*/g, ', ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

function splitLongChunk(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let pending = '';
  for (const word of text.split(/\s+/)) {
    if (word.length > maxLength) {
      if (pending) {
        chunks.push(pending);
        pending = '';
      }
      for (let offset = 0; offset < word.length; offset += maxLength) {
        chunks.push(word.slice(offset, offset + maxLength));
      }
      continue;
    }
    const candidate = pending ? `${pending} ${word}` : word;
    if (candidate.length > maxLength) {
      chunks.push(pending);
      pending = word;
    } else {
      pending = candidate;
    }
  }
  if (pending) chunks.push(pending);
  return chunks;
}

export function chunkSpeechText(
  text: string,
  maxLength = DEFAULT_SPEECH_CHUNK_LENGTH,
): string[] {
  if (!Number.isInteger(maxLength) || maxLength < 40 || maxLength > 1_000) {
    throw new Error('Speech chunk length must be between 40 and 1000.');
  }
  const sanitized = sanitizeSpeechText(text);
  if (!sanitized) return [];

  const sentences = sanitized.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let pending = '';
  for (const sentence of sentences) {
    const candidate = pending ? `${pending} ${sentence}` : sentence;
    if (candidate.length <= maxLength) {
      pending = candidate;
      continue;
    }
    if (pending) {
      chunks.push(pending);
      pending = '';
    }
    chunks.push(...splitLongChunk(sentence, maxLength));
  }
  if (pending) chunks.push(pending);
  return chunks;
}

export { DEFAULT_SPEECH_CHUNK_LENGTH };
