import fsp from 'node:fs/promises';

import type { ChangelogConfig } from 'changelogen';
import { generateMarkDown, getGitDiff, loadChangelogConfig, parseCommits } from 'changelogen';

import { changelogPath, cwd } from './constants';
import { pathExists } from './utils';

export function getDateStr() {
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    const monthFormatted = month.toString().padStart(2, '0');
    const dayFormatted = day.toString().padStart(2, '0');

    return `${year}-${monthFormatted}-${dayFormatted}`;
}

/**
 * https://github.com/unjs/changelogen/blob/main/src/commands/default.ts
 */
export async function generateChangelog(newVersion: string) {
    if (!(await pathExists(changelogPath, true))) {
        await fsp.writeFile(changelogPath, '', 'utf8');
    }

    const types: ChangelogConfig['types'] = {
        feat: { title: '🚀 Features' },
        fix: { title: '🐞 Bug Fixes' },
        perf: { title: '🏎 Performance' },
    };
    const config = await loadChangelogConfig(cwd, {
        types,
        newVersion: `${newVersion} (${getDateStr()})`,
    });
    const rawCommits = await getGitDiff(config.from, config.to);
    const commits = parseCommits(rawCommits, config).filter(
        (c) => config.types[c.type] && Object.keys(types).includes(c.type.toLowerCase()),
    );

    let md = await generateMarkDown(commits, config);

    // move compare changes part to bottom position
    const compareChanges = md
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '')
        .find((line) => line.startsWith('[compare changes]('));
    if (commits.length === 0) {
        md += '\n\nNo significant changes';
    }

    if (compareChanges) {
        md = md.replace(compareChanges, '');
        md += `\n\n${compareChanges.replace('compare changes', 'View changes on GitHub')}`;
    }

    // remove extra empty lines
    md = md.replace(/\n{3,}/, '\n\n');

    return md;
}

export async function updateChangelog(changelog: string) {
    let changelogMD = await fsp.readFile(changelogPath, 'utf8');

    // eslint-disable-next-line regexp/no-super-linear-backtracking
    const lastEntry = changelogMD.match(/^###?\s+?.*$/m);

    if (lastEntry) {
        changelogMD = `${changelogMD.slice(0, lastEntry.index) + changelog}\n\n${changelogMD.slice(
            lastEntry.index,
        )}`;
    } else {
        changelogMD += `${changelog}\n`;
    }

    await fsp.writeFile(changelogPath, changelogMD);
}
