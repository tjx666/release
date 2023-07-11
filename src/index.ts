import fsp from 'node:fs/promises';
import { resolve } from 'node:path';

import { confirm, intro, outro, spinner } from '@clack/prompts';
import boxen from 'boxen';
import { versionBump } from 'bumpp';
import type { ChangelogConfig } from 'changelogen';
import { generateMarkDown, getGitDiff, loadChangelogConfig, parseCommits } from 'changelogen';
import execa from 'execa';
import c from 'picocolors';

const cwd = process.cwd();

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
    if (compareChanges) {
        md = md.replace(compareChanges, '');
        md += `\n\n${compareChanges.replace('compare changes', 'View changes on GitHub')}`;
    }

    // remove extra empty lines
    md = md.replace(/\n{3,}/, '\n\n');

    return md;
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

async function getRepository() {
    const pkg = JSON.parse(await fsp.readFile(resolve(cwd, 'package.json'), 'utf8'));
    const url = pkg.repository?.url;
    if (typeof url === 'string') {
        const regex = /^(?:git\+)?(https?:\/\/?\S+?)(?:\.git)?$/;
        const match = regex.exec(url);
        return match?.[1];
    }
}

async function main() {
    const dryRun = process.argv.includes('--dry');

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
    if (!dryRun) {
        await gitCommit(commitMessage);
    }
    s.stop('committed');

    s.start('git tag');
    if (!dryRun) {
        await gitTag(newVersion, commitMessage);
    }
    s.stop('tagged');

    const shouldPush = await confirm({
        message: 'git push?',
    });
    if (shouldPush) {
        s.start('git push');
        if (!dryRun) {
            await gitPush();
        }
        s.stop('pushed to remote');
    }

    outro(`release ${c.green(`v${newVersion}`)} success!`);

    const repository = await getRepository();
    if (repository) {
        const releaseUrl = c.green(`${repository}/releases/tag/v${newVersion}`);
        const actionsUrl = c.green(`${repository}/actions`);
        const more = `${c.magenta('Release:')} ${releaseUrl}
${c.magenta('Actions:')} ${actionsUrl}`;
        console.log(
            boxen(more, {
                padding: 1,
                margin: 1,
                borderColor: 'yellow',
                borderStyle: 'round',
            }),
        );
    }
}

main();
