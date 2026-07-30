import { describe, expect, it } from 'vitest';
import {
  chunkSpeechText,
  sanitizeSpeechText,
} from './speech-text';

describe('speech text preparation', () => {
  it('speaks prose labels without URLs, markup, or fenced code', () => {
    const source = `
# Result

The **build passed**. Read the [release guide](https://example.test/release).

\`\`\`ts
const secret = "do not narrate code";
\`\`\`

- Open \`Settings\` next.
`;
    expect(sanitizeSpeechText(source)).toBe(
      'Result The build passed. Read the release guide. Open Settings next.',
    );
  });

  it('does not turn local file links or tables into punctuation noise', () => {
    expect(
      sanitizeSpeechText(
        '[App.tsx](C:/repo/src/App.tsx) | Status\n--- | ---\nPersona | Ready',
      ),
    ).toBe('App.tsx, Status ---, --- Persona, Ready');
  });

  it('chunks at sentence and word boundaries under the requested limit', () => {
    const chunks = chunkSpeechText(
      'First sentence is short. Second sentence contains several words and should not be cut in the middle of a word. Third sentence is here.',
      55,
    );
    expect(chunks.every((chunk) => chunk.length <= 55)).toBe(true);
    expect(chunks.join(' ')).toContain('middle of a word.');
  });

  it('returns no utterances for markup-only input', () => {
    expect(chunkSpeechText('```ts\nconst ignored = true;\n```')).toEqual([]);
  });
});
