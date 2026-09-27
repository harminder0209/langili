const { checkScope } = require('./scope');

describe('checkScope', () => {
  it('fails a PR into dev that mixes infrastructure and product paths', () => {
    const result = checkScope('dev', ['.github/workflows/checks.yml', 'app/index.tsx']);

    expect(result.ok).toBe(false);
  });

  it('passes the same mix on a promotion into stage', () => {
    const result = checkScope('stage', ['.github/workflows/checks.yml', 'app/index.tsx']);

    expect(result.ok).toBe(true);
  });

  it('names the infrastructure and product files that must be split apart', () => {
    const result = checkScope('dev', [
      'package.json',
      'docs/notes.md',
      'src/contracts/health.ts',
      'wrangler.jsonc',
    ]);

    expect(result.infrastructure).toEqual(['package.json', 'wrangler.jsonc']);
    expect(result.product).toEqual(['src/contracts/health.ts']);
  });

  it('treats docs/ and CONTEXT.md as neutral on either side', () => {
    expect(checkScope('dev', ['.github/workflows/checks.yml', 'docs/x.md', 'CONTEXT.md']).ok).toBe(
      true,
    );
    expect(checkScope('dev', ['app/index.tsx', 'docs/x.md', 'CONTEXT.md']).ok).toBe(true);
  });

  it('matches whole path segments, not lookalike names', () => {
    const result = checkScope('dev', ['.husky/pre-commit', 'apps/index.tsx', 'e2e-notes.md']);

    expect(result.ok).toBe(true);
  });

  it('counts the gate scripts as infrastructure', () => {
    const result = checkScope('dev', ['scripts/scope.js', 'app/index.tsx']);

    expect(result.ok).toBe(false);
  });
});
