import fs from 'node:fs';
import path from 'node:path';

const ENV_FILE_NAME = '.env';
const ASSIGNMENT_REGEX = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=.*$/;

export function getEnvFilePath() {
  return path.resolve(process.cwd(), ENV_FILE_NAME);
}

export function updateEnvValue(key, value) {
  const envPath = getEnvFilePath();
  const backupPath = `${envPath}.bak`;
  const fileExists = fs.existsSync(envPath);
  const originalContent = fileExists ? fs.readFileSync(envPath, 'utf8') : '';

  if (fileExists) {
    fs.writeFileSync(backupPath, originalContent, 'utf8');
  }

  const lineEnding = originalContent.includes('\r\n') ? '\r\n' : '\n';
  const lines = originalContent ? originalContent.split(/\r?\n/) : [];
  const nextLines = [];
  let replaced = false;

  for (const line of lines) {
    const match = line.match(ASSIGNMENT_REGEX);

    if (!match) {
      nextLines.push(line);
      continue;
    }

    if (match[1] !== key) {
      nextLines.push(line);
      continue;
    }

    if (!replaced) {
      nextLines.push(`${key}=${serializeEnvValue(value)}`);
      replaced = true;
    }
  }

  if (!replaced) {
    if (nextLines.length > 0 && nextLines[nextLines.length - 1] !== '') {
      nextLines.push('');
    }

    nextLines.push(`${key}=${serializeEnvValue(value)}`);
  }

  const content = `${nextLines.join(lineEnding).replace(/[\r\n]+$/, '')}${lineEnding}`;
  fs.writeFileSync(envPath, content, 'utf8');

  return {
    envPath,
    backupPath: fileExists ? backupPath : null,
    created: !fileExists,
    updated: true
  };
}

function serializeEnvValue(value) {
  const stringValue = String(value ?? '');

  if (stringValue === '') {
    return '""';
  }

  if (/\s|#|"/.test(stringValue)) {
    return `"${stringValue.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }

  return stringValue;
}
