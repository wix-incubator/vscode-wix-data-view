import * as vscode from 'vscode';
import _ from 'lodash';

import { 
    APIKeyAuthSource, 
    ConfigurationSiteIdSource, 
    WorkspaceWixConfigSiteIdSource,
} from './credentialSources';
import { AuthSource, ExtensionAuth } from './api';


const CREDENTIAL_WAIT_TIMEOUT = 10000;

export class WixCredentialManager {
    private readonly context: vscode.ExtensionContext;
    private readonly apiKeyAuthSource: APIKeyAuthSource;
    private readonly configurationSiteIdSource: ConfigurationSiteIdSource;
    private readonly workspaceWixConfigSiteIdSource: WorkspaceWixConfigSiteIdSource;
    private readonly authSourceSetting: AuthSource;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.authSourceSetting = this.loadAuthSourceSetting();
        this.apiKeyAuthSource = new APIKeyAuthSource(context);
        this.configurationSiteIdSource = new ConfigurationSiteIdSource(context);
        this.workspaceWixConfigSiteIdSource = new WorkspaceWixConfigSiteIdSource(context);

        this.runSuggestions();
    }

    private loadAuthSourceSetting(): AuthSource {
        return AuthSource.API_KEY;
    }

    public getAuthSource(): AuthSource {
        return this.authSourceSetting;
    }

    private runSuggestions(): void {
        const siteId = this.getSiteId();

        console.log('Is SiteID available: ', this.workspaceWixConfigSiteIdSource.isAvailable(), ', current: ', siteId);

        if ((!siteId || siteId === '') && this.workspaceWixConfigSiteIdSource.isAvailable()) {
            vscode.window.showInformationMessage('Do you want to switch Wix Data View plugin to show data from site referred to by a current project?', 'Yes', 'No')
                .then((selection) => {
                    if (selection === 'Yes') {
                        this.updateSiteId(this.workspaceWixConfigSiteIdSource.getSiteId());
                        vscode.commands.executeCommand('vscode-wix-data-view.refresh-collections');
                    }
                });
        }
    }

    private getApiKey(): string | undefined {
        return this.apiKeyAuthSource.getApiKey();
    }

    public updateApiKey(apiKey: string): void {
        if (this.authSourceSetting === AuthSource.API_KEY) {
            this.apiKeyAuthSource.updateApiKey(apiKey);
        }
    }

    public updateSiteId(siteId: string): void {
        this.configurationSiteIdSource.updateSiteId(siteId);
    }

    public getSiteId(): string {
        return this.configurationSiteIdSource.getSiteId();
    }

    public getAuth(): ExtensionAuth {
        if (this.authSourceSetting === AuthSource.API_KEY && this.getApiKey()) {
            return { type: 'APIKey', apiKey: this.getApiKey()! };
        } else {
            return { type: 'None' };
        }
    }

    public async waitForAuth(): Promise<ExtensionAuth> {
        await this.waitUntilTrue(() => this.apiKeyAuthSource.isReady());
        return this.getAuth();
    }

    private waitUntilTrue(predicate: () => boolean): Promise<void> {
        let leftToWait = CREDENTIAL_WAIT_TIMEOUT;
        return new Promise((resolve, reject) => {
            const interval = setInterval(() => {
                if (predicate()) {
                    clearInterval(interval);
                    resolve();
                } else {
                    leftToWait -= 100;
                    if (leftToWait <= 0) {
                        clearInterval(interval);
                        reject(new Error('Timeout waiting for auth'));
                    }
                }
            }, 100);
        });
    }
}
