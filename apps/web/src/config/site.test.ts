import { describe, expect, it } from 'vitest';
import {
  CAMINHOS_CODIGO,
  COMMIT_DESENVOLVIMENTO,
  SITE,
  refDoCodigo,
  urlDoCodigo,
  urlDoCommit,
} from './site';

const SHA = '0123456789abcdef0123456789abcdef01234567';

describe('urlDoCodigo', () => {
  it('em desenvolvimento aponta para a main, em /tree/ quando o caminho é uma pasta', () => {
    expect(urlDoCodigo('a/b', COMMIT_DESENVOLVIMENTO)).toBe(
      'https://github.com/MadCrow69/lavra-ata/tree/main/a/b',
    );
  });

  it('com SHA aponta para o commit publicado', () => {
    expect(urlDoCodigo('a/b', SHA)).toBe(`${SITE.repositorio}/tree/${SHA}/a/b`);
  });

  it('usa /blob/ quando o último segmento tem extensão', () => {
    expect(urlDoCodigo('a/c.js', SHA)).toBe(`${SITE.repositorio}/blob/${SHA}/a/c.js`);
  });

  it('o commit padrão é o do build (dev nos testes)', () => {
    expect(urlDoCodigo('a/b')).toBe(`${SITE.repositorio}/tree/main/a/b`);
  });
});

describe('refDoCodigo', () => {
  it('main em desenvolvimento, o SHA no build', () => {
    expect(refDoCodigo(COMMIT_DESENVOLVIMENTO)).toBe('main');
    expect(refDoCodigo(SHA)).toBe(SHA);
  });
});

describe('urlDoCommit', () => {
  it('liga ao commit no repositório', () => {
    expect(urlDoCommit(SHA)).toBe(`${SITE.repositorio}/commit/${SHA}`);
  });
});

describe('constantes', () => {
  it('a demo e os caminhos de código estão definidos', () => {
    expect(SITE.demo).toBe('https://madcrow69.github.io/lavra-ata/');
    expect(CAMINHOS_CODIGO.csp).toBe('apps/web/csp.config.js');
  });
});
