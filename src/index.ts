#!/usr/bin/env node

import process from 'node:process';

import { confirm, intro, outro, spinner } from '@clack/prompts';
import boxen from 'boxen';
import { versionBump } from 'bumpp';
import consola from 'consola';
import c from 'picocolors';

import { generateChangelog, updateChangelog } from './changelog';
import { getRepositoryUrl, gitCommit, gitPush, gitTag } from './git';

async function main() {
    const dryRun = process.argv.includes('--dry');

    intro(c.cyan(c.bold('Release New Version')));
    const s = spinner();

    const runStep = async (startMsg: string, step: () => Promise<void>, completeMsg?: string) => {
        s.start(startMsg);
        await step();
        s.stop(completeMsg ?? startMsg);
    };

    // https://github.com/antfu/bumpp/blob/main/src/version-bump.ts
    const { newVersion } = await versionBump({ files: [] });

    await runStep(
        'update changelog',
        async () => {
            const changelog = await generateChangelog(newVersion);
            await updateChangelog(changelog);
        },
        'changelog updated',
    );

    const commitMessage = `release: v${newVersion}`;
    await runStep(
        'git commit',
        async () => {
            if (!dryRun) {
                await gitCommit(commitMessage);
            }
        },
        'committed',
    );

    await runStep(
        'git tag',
        async () => {
            if (!dryRun) {
                await gitTag(newVersion, commitMessage);
            }
        },
        'tagged',
    );

    const shouldPush = await confirm({
        message: 'git push?',
    });
    if (shouldPush) {
        await runStep(
            'git push',
            async () => {
                if (!dryRun) {
                    await gitPush();
                }
            },
            'pushed to remote',
        );
    }

    outro(`release ${c.green(`v${newVersion}`)} success!`);

    const repository = await getRepositoryUrl();
    if (repository) {
        const releaseUrl = c.green(`${repository}/releases/tag/v${newVersion}`);
        const actionsUrl = c.green(`${repository}/actions`);
        const more = `${c.magenta('Release:')} ${releaseUrl}
${c.magenta('Actions:')} ${actionsUrl}`;
        consola.log(
            boxen(more, {
                padding: 1,
                margin: 1,
                borderColor: 'yellow',
                borderStyle: 'round',
            }),
        );
    }
}

main().catch((error) => {
    consola.error(error);
    process.exit(1);
});
