import fs from 'fs';
import path from 'path';

import * as vscode from 'vscode';
import { parseWixConfig } from './credentialErrors';

export class WorkspaceWixConfigSiteIdSource {
    private readonly context: vscode.ExtensionContext;
    private siteId?: string;
    private ready: boolean = false;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.load();
    }

    public load(): void {
        this.siteId = undefined;
        for (const configFile of this.getConfigFiles()) {
            try {
                if (fs.existsSync(configFile)) {
                    const config = parseWixConfig(fs.readFileSync(configFile, 'utf8'), configFile);
                    if (config.siteId) {
                        this.siteId = config.siteId;
                        this.ready = true;
                        return;
                    }
                }
            } catch (error) {
                // Invalid configuration needs fixing before a lower-priority file can select a site.
                this.ready = true;
                vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
                return;
            }
        }

        this.ready = true;
    }

    public isAvailable(): boolean {
        return this.getConfigFiles().some((configFile) => fs.existsSync(configFile));
    }

    private getConfigFiles(): string[] {
        return (vscode.workspace.workspaceFolders ?? []).flatMap((workspaceFolder) => [
            path.join(workspaceFolder.uri.fsPath, 'wix.config.json'),
            path.join(workspaceFolder.uri.fsPath, '.wix', 'app.config.json'),
        ]);
    }

    public getSiteId(): string {
        return this.siteId ?? '';
    }

    public isReady(): boolean {
        return this.ready;
    }
}
