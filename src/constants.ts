import { resolve } from 'node:path';
import process from 'node:process';

export const cwd = process.cwd();
export const changelogPath = resolve(process.cwd(), 'CHANGELOG.md');
