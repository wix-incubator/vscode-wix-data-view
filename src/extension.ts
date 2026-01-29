// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { DataCollectionNode, DataCollectionTree } from './dataTree';
import { DefaultWixDataCollectionProvider, WixDataCollectionProvider } from './wix/dataCollectionProvider';
import { ConfigurationPanel } from './panels/configurationPanel';
import { WixCredentialManager } from './auth/credentialManager';
import { runQuery, showQueryEditor } from './queryEditor';

export async function activate(context: vscode.ExtensionContext) {
	const outputChannel = vscode.window.createOutputChannel('Wix Data View');
	const credentialManager = new WixCredentialManager(context);
	const collectionProvider = new DefaultWixDataCollectionProvider(credentialManager, outputChannel);
	const dataCollectionTree = new DataCollectionTree(collectionProvider);

	vscode.window.createTreeView('vscode-wix-data-view.collection-tree', { 
		treeDataProvider: dataCollectionTree,
		showCollapseAll: true,
	});

	dataCollectionTree.refresh();

	if (vscode.window.registerWebviewPanelSerializer) {
		vscode.window.registerWebviewPanelSerializer('vscode-wix-data-view.configuration-view', {
			async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, state: any) {
				webviewPanel.webview.options = {
					enableScripts: true,
					localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'assets')],
				};
				
				ConfigurationPanel.revive(webviewPanel, context.extensionUri, credentialManager);

				dataCollectionTree.refresh(); // Trick to refresh the tree view
			}
		});
	}


	// Listen for workspace folder changes
	context.subscriptions.push(
		vscode.workspace.onDidChangeWorkspaceFolders(() => {
			credentialManager.runSuggestions();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-wix-data-view.refresh-collections', () => {
			dataCollectionTree.refresh();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-wix-data-view.configure-credentials', async () => {
			ConfigurationPanel.show(context.extensionUri, credentialManager);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-wix-data-view.open-collection', async (node: DataCollectionNode) => {
			//CollectionViewPanel.show(node.collection!, context.extensionUri, credentialManager);
			await showQueryEditor(context, node.collection?._id);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-wix-data-view.new-query', async () => {
			await showQueryEditor(context);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-wix-data-view.run-query', async () => {
			await runQuery(context, credentialManager, outputChannel);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-wix-data-view.copy-id', async (node: DataCollectionNode) => {
			dataCollectionTree.copyId(node);
		})
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
