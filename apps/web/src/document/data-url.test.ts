import { describe, expect, it } from 'vitest';
import { base64DeDataUrl, bytesDeDataUrl } from './data-url';

const PNG_1X1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('data-url', () => {
  it('extrai o base64', () => {
    expect(base64DeDataUrl('data:font/woff;base64,d09GRg==')).toBe('d09GRg==');
  });

  it('decodifica os bytes sem fetch', () => {
    const bytes = bytesDeDataUrl(PNG_1X1);
    expect([...bytes.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect([...bytesDeDataUrl('data:font/woff;base64,d09GRg==')]).toEqual([0x77, 0x4f, 0x46, 0x46]);
  });

  it('lança TypeError quando não é data URL base64', () => {
    expect(() => base64DeDataUrl('data:image/svg+xml,<svg>')).toThrow(TypeError);
    expect(() => bytesDeDataUrl('data:image/svg+xml,<svg>')).toThrow(TypeError);
    expect(() => base64DeDataUrl('https://exemplo.com/a.png')).toThrow(TypeError);
    expect(() => base64DeDataUrl('')).toThrow(TypeError);
  });
});
