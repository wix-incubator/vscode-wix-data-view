import * as vscode from 'vscode';
import { WixCredentialManager } from '../auth/credentialManager';

export class ConfigurationPanel {
    public static currentPanel?: ConfigurationPanel;
    private panel: vscode.WebviewPanel;
    private readonly wixCredentialManager: WixCredentialManager;

    constructor(extensionUri: vscode.Uri, column: vscode.ViewColumn, wixCredentialManager: WixCredentialManager, existing?: vscode.WebviewPanel) {
        this.wixCredentialManager = wixCredentialManager;

        const panel = existing ?? vscode.window.createWebviewPanel(
            'vscode-wix-data-view.configuration-view',
            'Wix Data Configuration',
            column,
            {
                enableScripts: true,
            }
        );

        this.panel = panel;

        panel.webview.html = this.getWebviewContent(extensionUri);

        panel.onDidDispose(() => {
            ConfigurationPanel.currentPanel = undefined;
        });

        panel.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'saveApiKey':
                    wixCredentialManager.updateApiKey(message.apiKey);
                    panel.webview.html = this.getWebviewContent(extensionUri);
                    vscode.commands.executeCommand('vscode-wix-data-view.refresh-collections');
                    vscode.window.showInformationMessage('API key saved');
                    break;
                case 'saveSiteId':
                    wixCredentialManager.updateSiteId(message.siteId);
                    panel.webview.html = this.getWebviewContent(extensionUri);
                    vscode.commands.executeCommand('vscode-wix-data-view.refresh-collections');
                    vscode.window.showInformationMessage('Site ID saved');
                    break;
            }
        });

    }

    public static show(extensionUri: vscode.Uri, wixCredentialManager: WixCredentialManager) {
        const column = vscode.window.activeTextEditor 
            ? vscode.window.activeTextEditor.viewColumn 
            : undefined;

        if (ConfigurationPanel.currentPanel) {
            ConfigurationPanel.currentPanel.panel.reveal(column);
        } else {
            ConfigurationPanel.currentPanel = new ConfigurationPanel(
                extensionUri, 
                column ?? vscode.ViewColumn.One, 
                wixCredentialManager
            );
        }
    }

    public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, wixCredentialManager: WixCredentialManager) {
        ConfigurationPanel.currentPanel = new ConfigurationPanel(
            extensionUri, 
            panel.viewColumn ?? vscode.ViewColumn.One, 
            wixCredentialManager,
            panel
        );        
    }

    public getWebviewContent(extensionUri: vscode.Uri): string {
        const scriptUri = this.panel.webview.asWebviewUri(
            vscode.Uri.joinPath(extensionUri, 'assets', 'configuration.js')
        );
        const styleUri = this.panel.webview.asWebviewUri(
            vscode.Uri.joinPath(extensionUri, 'assets', 'main.css')
        );

        const auth = this.wixCredentialManager.getAuth();
        const apiKey = auth.type === 'APIKey' && !this.wixCredentialManager.isUsingWixCliApiKey() ? auth.apiKey : '';
        const siteId = this.wixCredentialManager.getSavedSiteId();
        const credentialStatus = this.getCredentialStatus();
        const nonce = this.getNonce();
        const csp = [
            `default-src 'none'`,
            `style-src ${this.panel.webview.cspSource}`,
            `script-src 'nonce-${nonce}'`,
        ].join('; ');

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8"/>
                <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                <meta http-equiv="Content-Security-Policy" content="${csp}"/>
                <link href="${styleUri}" rel="stylesheet"/>
                <title>Wix Data Configuration</title>
            </head>
            <body class="configuration-page">
                <main class="configuration-content">
                    <header class="configuration-header">
                        <h1>Wix Data Configuration</h1>
                        <p>Connect to Wix Data with an API key and a Site ID.</p>
                    </header>

                    <section class="configuration-section" aria-labelledby="apiKeyHeading">
                        <h2 id="apiKeyHeading">API Key</h2>
                        <p class="section-description">
                            Your key needs List Sites and Wix Data permissions.
                            <a href="https://support.wix.com/en/article/about-wix-api-keys">Learn how to create an API key</a>.
                        </p>
                        ${credentialStatus.apiKey}
                        <form id="apiKeyForm">
                            <label for="apiKey">API key</label>
                            <input type="password" id="apiKey" name="apiKey" value="${this.escapeAttribute(apiKey)}" aria-describedby="apiKeyHelp"/>
                            <p class="field-help" id="apiKeyHelp">Leave empty and save to use the Wix CLI API key, if available.</p>
                            <button type="submit">Save API Key</button>
                        </form>
                    </section>

                    <section class="configuration-section" aria-labelledby="siteIdHeading">
                        <h2 id="siteIdHeading">Site ID</h2>
                        <p class="section-description">Choose the site whose collections you want to work with.</p>
                        ${credentialStatus.siteId}
                        <form id="siteIdForm">
                            <label for="siteId">Site ID</label>
                            <input type="text" id="siteId" name="siteId" value="${this.escapeAttribute(siteId)}" aria-describedby="siteIdHelp" spellcheck="false"/>
                            <p class="field-help" id="siteIdHelp">A saved Site ID applies across workspaces. Leave empty and save to use the current workspace configuration.</p>
                            <button type="submit">Save Site ID</button>
                        </form>
                    </section>
                </main>

                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>
        `;
    }

    private getCredentialStatus(): { apiKey: string; siteId: string } {
        const apiKeyStatus = this.wixCredentialManager.isUsingWixCliApiKey()
            ? `
                <div class="credential-status credential-status--active">
                    <strong>Wix CLI API key is in use.</strong>
                    <span>No manual API key is saved.</span>
                </div>
            `
            : `
            <div class="credential-status">
                <strong>${this.wixCredentialManager.getAuth().type === 'APIKey' ? 'Saved API key is in use.' : 'No API key is available.'}</strong>
            </div>
        `;
        const siteId = this.wixCredentialManager.getSiteId();
        const siteIdStatus = this.wixCredentialManager.isUsingWorkspaceSiteId()
            ? `
                <div class="credential-status credential-status--active">
                    <strong>Workspace Site ID is in use.</strong>
                    <span>${this.escapeAttribute(siteId)}</span>
                    <span>No manual Site ID is saved. The site follows the current workspace configuration.</span>
                </div>
            `
            : `
                <div class="credential-status">
                    <strong>${siteId ? 'Saved Site ID is in use.' : 'No Site ID is available.'}</strong>
                    ${siteId ? `<span>${this.escapeAttribute(siteId)}</span>` : ''}
                </div>
            `;

        return { apiKey: apiKeyStatus, siteId: siteIdStatus };
    }

    private getNonce(): string {
        let nonce = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            nonce += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return nonce;
    }

    private escapeAttribute(value: string): string {
        return value
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

}
