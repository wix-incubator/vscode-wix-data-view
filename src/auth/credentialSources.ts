import fs from 'fs';
import os from 'os';
import path from 'path';

import * as vscode from 'vscode';

const WIX_CLI_API_KEY_PATH = '.wix/auth/api-key.json';

export class APIKeyAuthSource {
    private readonly context: vscode.ExtensionContext;
    private apiKey?: string;
    private ready: boolean = false;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.load();
    }

    private load(): void {
        this.context.secrets.get('wixApiKey')
            .then((apiKey) => {
                if (apiKey) {
                    this.apiKey = apiKey;
                } else {
                    this.apiKey = this.loadFromCliConfig();
                }
                this.ready = true;
            });
    }

    private loadFromCliConfig(): string {
        const cliConfigPath = path.join(os.homedir(), WIX_CLI_API_KEY_PATH);
        try {
            if (fs.existsSync(cliConfigPath)) {
                const config = JSON.parse(fs.readFileSync(cliConfigPath, 'utf8'));
                return config.token ?? '';
            }
        } catch (error) {
            console.error('Failed to load API key from CLI config:', error);
        }
        return '';
    }

    public updateApiKey(apiKey: string): void {
        this.context.secrets.store('wixApiKey', apiKey);
        this.apiKey = apiKey;
        this.ready = true;
    }

    public getApiKey(): string {
        return this.apiKey ?? '';
    }

    public isReady(): boolean {
        return this.ready;
    }
}

const SITE_ID_CONFIG_KEY = 'wixSiteId';

export class ConfigurationSiteIdSource {
    private readonly context: vscode.ExtensionContext;
    private siteId?: string;
    private ready: boolean = false;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.load();
    }

    private load(): void {
        this.siteId = this.context.globalState.get(SITE_ID_CONFIG_KEY) ?? '';
        this.ready = true;
    }

    public updateSiteId(siteId: string) {
        this.context.globalState.update(SITE_ID_CONFIG_KEY, siteId);
        this.siteId = siteId;
    }

    public getSiteId(): string {
        return this.siteId ?? '';
    }

    public isReady(): boolean {
        return this.ready;
    }
}

export class WorkspaceWixConfigSiteIdSource {
    private readonly context: vscode.ExtensionContext;
    private siteId?: string;
    private ready: boolean = false;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.load();
    }

    private load(): void {
        if (vscode.workspace.workspaceFolders) {
            for (let workspaceFolder of vscode.workspace.workspaceFolders) {
                const configFile = workspaceFolder.uri.fsPath + '/wix.config.json';
                if (fs.existsSync(configFile)) {
                    const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
                    this.siteId = config.siteId;
                    this.ready = true;
                    return;
                }
            }
        }

        this.ready = true;
    }

    public isAvailable(): boolean {
        if (vscode.workspace.workspaceFolders) {
            for (let workspaceFolder of vscode.workspace.workspaceFolders) {
                const configFile = workspaceFolder.uri.fsPath + '/wix.config.json';
                if (fs.existsSync(configFile)) {
                    return true;
                }
            }
        }
        return false;
    }

    public getSiteId(): string {
        return this.siteId ?? '';
    }

    public isReady(): boolean {
        return this.ready;
    }
}
