import { constants as FS_CONSTANTS } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

export async function pathExists(
    filePath: string,
    fileNameCaseSensitive = false,
): Promise<boolean> {
    if (fileNameCaseSensitive) {
        const fileName = path.basename(filePath);
        const directory = filePath.replace(fileName, '');
        try {
            const fileNames = await fs.readdir(directory);
            return fileNames.includes(fileName);
        } catch {
            return false;
        }
    } else {
        return fs
            .access(filePath, FS_CONSTANTS.F_OK)
            .then(() => true)
            .catch(() => false);
    }
}
