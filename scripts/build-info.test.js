const { resolveBuildInfo } = require('./build-info');

const SHA = '0123456789abcdef0123456789abcdef01234567';
const LOCAL_HEAD = 'fedcba9876543210fedcba9876543210fedcba98';
const local = {
  publicValues: { EXPO_PUBLIC_APP_ENV: 'development' },
  gitHead: () => LOCAL_HEAD,
};

describe('resolveBuildInfo', () => {
  it('takes the Pages build commit and build environment on Cloudflare', () => {
    const env = { CF_PAGES: '1', CF_PAGES_COMMIT_SHA: SHA, EXPO_PUBLIC_APP_ENV: 'staging' };

    expect(resolveBuildInfo(env, local)).toEqual({ version: SHA, environment: 'staging' });
  });

  it('falls back to the public values Expo inlines and the checked-out commit off Cloudflare', () => {
    expect(resolveBuildInfo({}, local)).toEqual({
      version: LOCAL_HEAD,
      environment: 'development',
    });
  });

  it('fails a Cloudflare build that has no build commit', () => {
    const env = { CF_PAGES: '1', EXPO_PUBLIC_APP_ENV: 'staging' };

    expect(() => resolveBuildInfo(env, local)).toThrow('CF_PAGES_COMMIT_SHA');
  });

  it('fails a Cloudflare build without its own environment instead of using the committed one', () => {
    const env = { CF_PAGES: '1', CF_PAGES_COMMIT_SHA: SHA };

    expect(() => resolveBuildInfo(env, local)).toThrow('EXPO_PUBLIC_APP_ENV');
  });

  it.each([
    ['a short commit', { CF_PAGES_COMMIT_SHA: '0123456' }],
    ['a branch name', { CF_PAGES_COMMIT_SHA: 'dev' }],
    ['an unknown environment', { EXPO_PUBLIC_APP_ENV: 'preview' }],
  ])('refuses %s, so only public identity reaches the module', (_, env) => {
    expect(() => resolveBuildInfo(env, local)).toThrow(Object.keys(env)[0]);
  });
});
