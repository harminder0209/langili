const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { scanDist } = require('./scan-dist');

function distWith(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-dist-'));
  for (const [name, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

const options = {
  allowedNames: ['EXPO_PUBLIC_APP_ENV', 'EXPO_PUBLIC_API_BASE_URL'],
  secretValues: ['s3cr3t-value-123'],
};

describe('scanDist', () => {
  it('passes a bundle holding only allowed public values', () => {
    const dir = distWith({
      'index.html': '<div id="root"></div>',
      '_expo/static/js/web/entry.js': 'const env="development";EXPO_PUBLIC_APP_ENV',
    });

    expect(scanDist(dir, options)).toEqual([]);
  });

  it('reports an EXPO_PUBLIC_ name that is not allowed', () => {
    const dir = distWith({ 'app.js': 'process.env.EXPO_PUBLIC_STRIPE_KEY' });

    expect(scanDist(dir, options)).toEqual([
      { file: 'app.js', problem: 'unexpected public variable EXPO_PUBLIC_STRIPE_KEY' },
    ]);
  });

  it('reports a known secret value without echoing it', () => {
    const dir = distWith({ 'nested/app.js': 'const k="s3cr3t-value-123"' });

    expect(scanDist(dir, options)).toEqual([
      { file: path.join('nested', 'app.js'), problem: 'contains a secret value' },
    ]);
  });

  it('reports the inlined value of a public variable that is not allowed', () => {
    const dir = distWith({ 'app.js': 'const key="pk_live_abcdef"' });

    expect(
      scanDist(dir, { ...options, unexpectedPublic: { EXPO_PUBLIC_STRIPE_KEY: 'pk_live_abcdef' } }),
    ).toEqual([{ file: 'app.js', problem: 'unexpected public variable EXPO_PUBLIC_STRIPE_KEY' }]);
  });

  it('reports a private key block', () => {
    const dir = distWith({ 'key.txt': '-----BEGIN RSA PRIVATE KEY-----\nabc' });

    expect(scanDist(dir, options)).toEqual([
      { file: 'key.txt', problem: 'contains a private key' },
    ]);
  });

  it('fails when the bundle directory is missing', () => {
    expect(() => scanDist(path.join(os.tmpdir(), 'no-such-dist'), options)).toThrow(/not found/);
  });
});

describe('secretValuesFrom', () => {
  const { secretValuesFrom } = require('./scan-dist');

  it('takes .dev.vars values and secret-looking environment values, never public ones', () => {
    const values = secretValuesFrom('API_SECRET="from-dev-vars"\n# comment\nEMPTY=\n', {
      CLOUDFLARE_API_TOKEN: 'token-value-abc',
      EXPO_PUBLIC_APP_ENV: 'development',
      HOME: '/Users/someone',
      SHORT_TOKEN: 'abc',
    });

    expect(values.sort()).toEqual(['from-dev-vars', 'token-value-abc']);
  });

  it('never treats an allowed public value as a secret', () => {
    const values = secretValuesFrom(
      'APP_ENV=development\nAPI_BASE_URL=http://localhost:8788/api\nAPI_SECRET=real-secret\n',
      {},
      ['development', 'http://localhost:8788/api'],
    );

    expect(values).toEqual(['real-secret']);
  });
});
