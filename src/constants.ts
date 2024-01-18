import { resolve } from 'node:path';

export const cwd = process.cwd();
export const changelogPath = resolve(process.cwd(), 'CHANGELOG.md');
