#!/usr/bin/env node
// Fails when the exported web bundle holds anything beyond the allowed EXPO_PUBLIC_* values
// (spec §6 and §13). Every EXPO_PUBLIC_* value is public by definition; nothing else may ship.
const fs = require('node:fs');
const path = require('node:path');

const ALLOWED_PUBLIC_NAMES = ['EXPO_PUBLIC_APP_ENV', 'EXPO_PUBLIC_API_BASE_URL'];

const PUBLIC_NAME = /EXPO_PUBLIC_[A-Z0-9_]+/g;
const PRIVATE_KEY = /-----BEGIN [A-Z ]*PRIVATE KEY-----/;
const SECRET_LOOKING_NAME = /SECRET|TOKEN|PASSWORD|PRIVATE|API_KEY|CREDENTIAL/i;
const MIN_SECRET_LENGTH = 8;

function filesUnder(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name));
}

function scanDist(dir, { allowedNames, secretValues, unexpectedPublic = {} }) {
  if (!fs.existsSync(dir)) {
    throw new Error(`Bundle directory ${dir} not found. Run \`npm run export:web\` first.`);
  }
  const problems = [];
  for (const file of filesUnder(dir).sort()) {
    const content = fs.readFileSync(file, 'latin1');
    const relative = path.relative(dir, file);
    // Expo inlines public values, so an unexpected variable shows up by name or by its value.
    const unexpected = new Set([
      ...[...content.matchAll(PUBLIC_NAME)]
        .map(([name]) => name)
        .filter((name) => !allowedNames.includes(name)),
      ...Object.entries(unexpectedPublic)
        .filter(([, value]) => content.includes(value))
        .map(([name]) => name),
    ]);
    for (const name of unexpected) {
      problems.push({ file: relative, problem: `unexpected public variable ${name}` });
    }
    if (secretValues.some((value) => content.includes(value))) {
      problems.push({ file: relative, problem: 'contains a secret value' });
    }
    if (PRIVATE_KEY.test(content)) {
      problems.push({ file: relative, problem: 'contains a private key' });
    }
  }
  return problems;
}

function parseDotenv(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [
        line.slice(0, index).trim(),
        line
          .slice(index + 1)
          .trim()
          .replace(/^(['"])(.*)\1$/, '$2'),
      ];
    });
}

// Secrets the scan must never find: every local Function variable, plus any secret-looking
// variable in the build environment. Allowed public values are excluded, since they ship on purpose.
function secretValuesFrom(devVarsText, env, allowedValues = []) {
  const fromDevVars = parseDotenv(devVarsText).map(([, value]) => value);
  const fromEnv = Object.entries(env)
    .filter(([name]) => !name.startsWith('EXPO_PUBLIC_') && SECRET_LOOKING_NAME.test(name))
    .map(([, value]) => value);
  return [...new Set([...fromDevVars, ...fromEnv])].filter(
    (value) => value && value.length >= MIN_SECRET_LENGTH && !allowedValues.includes(value),
  );
}

// The EXPO_PUBLIC_* values `expo export` inlines: the committed .env and its local and production
// overrides, then the process environment, which wins, as it does for Expo.
function publicValuesAt(root, env) {
  const files = ['.env', '.env.production', '.env.local', '.env.production.local']
    .map((name) => path.join(root, name))
    .filter((file) => fs.existsSync(file));
  const entries = [
    ...files.flatMap((file) => parseDotenv(fs.readFileSync(file, 'utf8'))),
    ...Object.entries(env),
  ].filter(([name, value]) => name.startsWith('EXPO_PUBLIC_') && value);
  return Object.fromEntries(entries);
}

function main() {
  const root = path.resolve(__dirname, '..');
  const devVarsPath = path.join(root, '.dev.vars');
  const devVars = fs.existsSync(devVarsPath) ? fs.readFileSync(devVarsPath, 'utf8') : '';
  const publicValues = publicValuesAt(root, process.env);
  const allowedValues = ALLOWED_PUBLIC_NAMES.map((name) => publicValues[name]).filter(Boolean);
  const unexpectedPublic = Object.fromEntries(
    Object.entries(publicValues).filter(
      ([name, value]) =>
        !ALLOWED_PUBLIC_NAMES.includes(name) &&
        value.length >= MIN_SECRET_LENGTH &&
        !allowedValues.includes(value),
    ),
  );
  const problems = scanDist(path.join(root, 'dist'), {
    allowedNames: ALLOWED_PUBLIC_NAMES,
    secretValues: secretValuesFrom(devVars, process.env, allowedValues),
    unexpectedPublic,
  });
  if (problems.length > 0) {
    for (const { file, problem } of problems) console.error(`scan:dist: dist/${file} ${problem}`);
    process.exit(1);
  }
  console.log('scan:dist: dist/ holds only allowed public values.');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`scan:dist: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { publicValuesAt, scanDist, secretValuesFrom };
