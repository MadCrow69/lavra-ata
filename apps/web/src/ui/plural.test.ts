import { describe, expect, it } from 'vitest';
import { plural } from './plural';

describe('plural', () => {
  it('singular só para 1', () => {
    expect(plural(1, 'campo', 'campos')).toBe('campo');
    expect(plural(0, 'campo', 'campos')).toBe('campos');
    expect(plural(2, 'campo', 'campos')).toBe('campos');
  });
});
