import fsp from 'node:fs/promises';
import { resolve } from 'node:path';

import { intro, outro, spinner, confirm } from '@clack/prompts';
import { versionBump } from 'bumpp';
import { generateMarkDown, getGitDiff, loadChangelogConfig, parseCommits } from 'changelogen';
import execa from 'execa';
import c from 'picocolors';

function getDateStr() {
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
async function generateChangelog(newVersion: string) {
    const config = await loadChangelogConfig(process.cwd(), {
        types: {
            feat: { title: '🚀 Features' },
            fix: { title: '🐞 Bug Fixes' },
            perf: { title: '🏎 Performance' },
        },
        newVersion: `${newVersion} (${getDateStr()})`,
    });
    const rawCommits = await getGitDiff(config.from, config.to);
    const commits = parseCommits(rawCommits, config).filter((c) => config.types[c.type]);
    const md = await generateMarkDown(commits, config);
    return md.replaceAll('\n\n\n', '\n\n').replaceAll('  - ', '- ');
}

const changelogPath = resolve(process.cwd(), 'CHANGELOG.md');
async function updateChangelog(changelog: string) {
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

async function gitCommit(commitMessage: string) {
    await execa('git', ['add', '-A']);
    await execa('git', ['commit', '-m', commitMessage]);
}

async function gitTag(newVersion: string, commitMessage: string) {
    await execa('git', ['tag', '--annotate', `v${newVersion}`, '--message', commitMessage]);
}

async function gitPush() {
    await execa('git', ['push']);
    await execa('git', ['push', '--tags']);
}

async function main() {
    intro(c.cyan(c.bold('Release New Version')));
    const s = spinner();

    // https://github.com/antfu/bumpp/blob/main/src/version-bump.ts
    const { newVersion } = await versionBump({ files: [] });

    s.start('update changelog');
    const changelog = await generateChangelog(newVersion);
    await updateChangelog(changelog);
    s.stop('changelog updated');

    const commitMessage = `release: v${newVersion}`;
    s.start('git commit');
    await gitCommit(commitMessage);
    s.stop('committed');

    s.start('git tag');
    await gitTag(newVersion, commitMessage);
    s.stop('tagged');

    const shouldPush = await confirm({
        message: 'git push?',
    });
    if (shouldPush) {
        s.start('git push');
        await gitPush();
        s.stop('pushed to remote');
    }

    outro(`release ${c.green(`v${newVersion}`)} success!`);
}

main();
