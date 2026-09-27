#!/usr/bin/env node
// The `scope` PR check (spec §6): a PR into `dev` may change infrastructure or product, never both.
const INFRASTRUCTURE = [
  '.github/',
  '.sandcastle/',
  '.eas/',
  '.husky/',
  // The gate scripts themselves, so a PR can't rewrite the check that judges it.
  'scripts/',
  'package.json',
  'package-lock.json',
  'app.config.ts',
  'eas.json',
  'wrangler.jsonc',
];
const PRODUCT = ['app/', 'src/', 'functions/', 'tests/', 'e2e/', 'public/'];

const matches = (prefixes) => (file) =>
  prefixes.some((prefix) => (prefix.endsWith('/') ? file.startsWith(prefix) : file === prefix));

function checkScope(base, files) {
  if (base !== 'dev') return { ok: true };
  const infrastructure = files.filter(matches(INFRASTRUCTURE));
  const product = files.filter(matches(PRODUCT));
  return { ok: infrastructure.length === 0 || product.length === 0, infrastructure, product };
}

function changedFiles(baseRev, headRev) {
  const { execFileSync } = require('node:child_process');
  // --no-renames lists both sides of a move, so moving a file across the line still counts.
  // -z keeps git from quoting names with non-ASCII characters, which would dodge the prefixes.
  return execFileSync(
    'git',
    ['diff', '--name-only', '--no-renames', '-z', `${baseRev}...${headRev}`],
    { encoding: 'utf8' },
  )
    .split('\0')
    .filter(Boolean);
}

if (require.main === module) {
  const [base, baseRev, headRev] = process.argv.slice(2);
  if (!base || !baseRev || !headRev) {
    console.error('Usage: node scripts/scope.js <base-branch> <base-rev> <head-rev>');
    process.exit(2);
  }
  const result = checkScope(base, changedFiles(baseRev, headRev));
  if (result.ok) {
    console.log(`scope: ok for a PR into ${base}.`);
  } else {
    console.error(
      `scope: a PR into ${base} may not mix infrastructure and product paths. Split it into two PRs.`,
    );
    console.error(`Infrastructure:\n  ${result.infrastructure.join('\n  ')}`);
    console.error(`Product:\n  ${result.product.join('\n  ')}`);
    process.exit(1);
  }
}

module.exports = { checkScope };
