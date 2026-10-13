/** Mechanical file-size gate: fails over the hard limit and names files past the split point. */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const HARD = 1000;
const WARN = 600;

describe('source file size limits', () => {
  it(`keeps every src/*.js file under ${HARD} lines`, () => {
    const dir = fileURLToPath(new URL('../src/', import.meta.url));
    /** @type {string[]} */
    const over = [];
    for (const name of readdirSync(dir).filter((f) => f.endsWith('.js'))) {
      const lines = readFileSync(join(dir, name), 'utf8').split('\n').length;
      if (lines > HARD) over.push(`${name}: ${lines} lines (limit ${HARD})`);
      else if (lines > WARN) console.warn(`note: ${name} is ${lines} lines, approaching the ${HARD} limit`);
    }
    assert.deepEqual(over, []);
  });
});
