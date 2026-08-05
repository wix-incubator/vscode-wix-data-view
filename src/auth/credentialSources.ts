import fs from 'fs';
import os from 'os';
import path from 'path';

import * as vscode from 'vscode';
import { formatCredentialLoadError, parseWixConfig } from './credentialErrors';

const WIX_CLI_API_KEY_PATH = '.wix/auth/api-key.json';

export enum ApiKeyAuthSourceType {
    SecretStore = 'SecretStore',
    WixCli = 'WixCli',
}

export class APIKeyAuthSource {
    private readonly context: vscode.ExtensionContext;
    private apiKey?: string;
    private apiKeySource?: ApiKeyAuthSourceType;
    private ready: boolean = false;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.load();
    }

    private load(): void {
        Promise.resolve(this.context.secrets.get('wixApiKey'))
            .then((apiKey) => {
                if (apiKey) {
                    this.apiKey = apiKey;
                    this.apiKeySource = ApiKeyAuthSourceType.SecretStore;
                } else {
                    this.apiKey = this.loadFromCliConfig();
                }
                this.ready = true;
            })
            .catch((error) => {
                this.apiKey = '';
                this.apiKeySource = undefined;
                this.ready = true;
                vscode.window.showErrorMessage(formatCredentialLoadError(error));
            });
    }

    private loadFromCliConfig(): string {
        const cliConfigPath = path.join(os.homedir(), WIX_CLI_API_KEY_PATH);
        try {
            if (fs.existsSync(cliConfigPath)) {
                const config = JSON.parse(fs.readFileSync(cliConfigPath, 'utf8'));
                if (config.token) {
                    this.apiKeySource = ApiKeyAuthSourceType.WixCli;
                    return config.token;
                }
            }
        } catch (error) {
            console.error('Failed to load API key from CLI config:', error);
        }
        this.apiKeySource = undefined;
        return '';
    }

    public updateApiKey(apiKey: string): void {
        const persistence = apiKey
            ? this.context.secrets.store('wixApiKey', apiKey)
            : this.context.secrets.delete('wixApiKey');
        Promise.resolve(persistence).catch((error) => {
            vscode.window.showErrorMessage(formatCredentialLoadError(error));
        });
        this.apiKey = apiKey;
        this.apiKeySource = apiKey ? ApiKeyAuthSourceType.SecretStore : undefined;
        this.ready = true;
    }

    public getApiKey(): string {
        return this.apiKey ?? '';
    }

    public getApiKeySource(): ApiKeyAuthSourceType | undefined {
        return this.apiKeySource;
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

    public load(): void {
        if (vscode.workspace.workspaceFolders) {
            for (let workspaceFolder of vscode.workspace.workspaceFolders) {
                const configFile = path.join(workspaceFolder.uri.fsPath, 'wix.config.json');
                try {
                    if (fs.existsSync(configFile)) {
                        const config = parseWixConfig(fs.readFileSync(configFile, 'utf8'), configFile);
                        this.siteId = config.siteId;
                        this.ready = true;
                        return;
                    }
                } catch (error) {
                    this.siteId = undefined;
                    this.ready = true;
                    vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
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
