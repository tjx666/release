#!/usr/bin/env node

import process from 'node:process';

import { confirm, intro, outro, spinner } from '@clack/prompts';
import boxen from 'boxen';
import { versionBump } from 'bumpp';
import c from 'picocolors';

import { generateChangelog, updateChangelog } from './changelog';
import { getRepositoryUrl, gitCommit, gitPush, gitTag } from './git';

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

    const repository = await getRepositoryUrl();
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
