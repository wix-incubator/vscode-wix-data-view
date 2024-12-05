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
                case 'saveConfiguration':
                    wixCredentialManager.updateApiKey(message.apiKey);
                    wixCredentialManager.updateSiteId(message.siteId);
                    vscode.commands.executeCommand('vscode-wix-data-view.refresh-collections');
                    vscode.window.showInformationMessage('Configuration saved');
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
        const apiKey = auth.type === 'APIKey' ? auth.apiKey : '';
        const siteId = this.wixCredentialManager.getSiteId();

        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8"/>
                <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
                <link href="${styleUri}" rel="stylesheet"/>
                <title>Wix Data Configuration</title>
            </head>
            <body>
                <h1>Wix Data Configuration</h1>
                
                <p>
                Enter your Wix API Key and Site ID to start using the extension.
                You can learn about creating 
                <a href="https://support.wix.com/en/article/about-wix-api-keys">API keys here</a>.
                This key should have at least List Sites and Wix Data permissions.
                </p>

                <form>
                    <div>
                        <label for="apiKey">API Key</label>
                        <input type="text" id="apiKey" name="apiKey" value="${apiKey}"/>
                    </div>
                    <div>
                        <label for="siteId">Site ID</label>
                        <input type="text" id="siteId" name="siteId" value="${siteId}"/>
                    </div>
                    <div>
                        <button id="save">Save Configuration</button>
                    </div>
                </form>

                <script src="${scriptUri}"></script>
            </body>
            </html>
        `;
    }

}
