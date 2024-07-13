import fsp from 'node:fs/promises';
import { resolve } from 'node:path';

import { execa } from 'execa';

import { cwd } from './constants';

export async function getBranchName() {
    const { stdout } = await execa('git', ['branch', '--show-current']);
    return stdout.trim();
}

export async function gitCommit(message: string) {
    await execa('git', ['add', '-A']);
    await execa('git', ['commit', '-m', message]);
}

export async function gitTag(newVersion: string, message: string) {
    await execa('git', ['tag', '--annotate', `v${newVersion}`, '--message', message]);
}

export async function gitPull() {
    await execa('git', ['pull']);
}

export async function gitPush() {
    await execa('git', ['push']);
    await execa('git', ['push', '--tags']);
}

export async function getRepositoryUrl() {
    const pkg = JSON.parse(await fsp.readFile(resolve(cwd, 'package.json'), 'utf8'));
    const url = pkg.repository?.url;
    if (typeof url === 'string') {
        const regex = /^(?:git\+)?(https?:\/\/?\S+?)(?:\.git)?$/;
        const match = regex.exec(url);
        return match?.[1];
    }
}
