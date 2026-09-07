// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { DataCollectionNode, DataCollectionTree, NodeType } from './dataTree';
import { DefaultWixDataCollectionProvider, WixDataCollectionProvider } from './wix/dataCollectionProvider';
import { ConfigurationPanel } from './panels/configurationPanel';
import { WixCredentialManager } from './auth/credentialManager';
import { runQuery, showCreateCollectionEditor, showAddFieldEditor, showUpdateFieldEditor, showDeleteFieldEditor, showQueryEditor } from './queryEditor';
import { cleanupQueryFiles, ensureQueryWorkspace, isAutocompleteEnabled } from './runner/queryWorkspace';
import { createAnalyticsReporter } from './analytics';

function reportError(outputChannel: vscode.OutputChannel, action: string, e: any): void {
	const message = e?.message ?? String(e);
	outputChannel.appendLine(`Error: ${action} failed. ${message}`);
	vscode.window.showErrorMessage(`Failed to ${action}. ${message}`);
}

function collectionData(node?: DataCollectionNode) {
	return {
		collectionName: node?.collection?.displayName ?? node?.collection?._id,
		collectionId: node?.collection?._id,
	};
}

function fieldData(node?: DataCollectionNode) {
	return { ...collectionData(node), fieldName: node?.field?.key };
}

/** Wraps a command callback so an unexpected throw surfaces to the user instead of failing silently. */
function guarded<T extends (...args: any[]) => Promise<void> | void>(outputChannel: vscode.OutputChannel, action: string, fn: T): T {
	return (async (...args: any[]) => {
		try {
			await fn(...args);
		} catch (e) {
			reportError(outputChannel, action, e);
		}
	}) as T;
}

export async function activate(context: vscode.ExtensionContext) {
	const outputChannel = vscode.window.createOutputChannel('Wix Data View');
	context.subscriptions.push(outputChannel);

	const reportAnalytics = createAnalyticsReporter(context);

	try {
		if (isAutocompleteEnabled()) {
			await ensureQueryWorkspace(context);
		}
		await cleanupQueryFiles(); // start each session with a clean slate, even if disabled
	} catch (e) {
		reportError(outputChannel, 'set up the query workspace', e);
	}

	const credentialManager = new WixCredentialManager(context);
	const collectionProvider = new DefaultWixDataCollectionProvider(credentialManager, outputChannel);
	const dataCollectionTree = new DataCollectionTree(collectionProvider);
	context.subscriptions.push(dataCollectionTree);

	const treeView = vscode.window.createTreeView('vscode-wix-data-view.collection-tree', {
		treeDataProvider: dataCollectionTree,
		showCollapseAll: true,
	});
	context.subscriptions.push(treeView);

	const reportPanelOpened = () => {
		if (treeView.visible) reportAnalytics('panel_opened');
	};
	reportPanelOpened();
	context.subscriptions.push(treeView.onDidChangeVisibility(reportPanelOpened));

	context.subscriptions.push(treeView.onDidExpandElement(({ element }) => {
		if (element.type === NodeType.COLLECTION) {
			reportAnalytics('collection_click', collectionData(element));
		}
	}));

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
			reportAnalytics('refresh');
			dataCollectionTree.refresh();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-wix-data-view.configure-credentials', guarded(outputChannel, 'open credentials configuration', async () => {
			ConfigurationPanel.show(context.extensionUri, credentialManager);
		}))
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-wix-data-view.open-collection', guarded(outputChannel, 'open collection', async (node: DataCollectionNode) => {
			reportAnalytics('open_collection', collectionData(node));
			await showQueryEditor(context, node.collection?._id);
		}))
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-wix-data-view.new-query', guarded(outputChannel, 'open a new query', async () => {
			await showQueryEditor(context);
		}))
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-wix-data-view.create-collection', guarded(outputChannel, 'open the create-collection editor', async () => {
			reportAnalytics('add_collection');
			await showCreateCollectionEditor(context);
		}))
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-wix-data-view.add-field', guarded(outputChannel, 'open the add-field editor', async (node?: DataCollectionNode) => {
			reportAnalytics('add_field', collectionData(node));
			await showAddFieldEditor(context, node?.collection?._id);
		}))
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-wix-data-view.update-field', guarded(outputChannel, 'open the update-field editor', async (node?: DataCollectionNode) => {
			reportAnalytics('update_field', fieldData(node));
			await showUpdateFieldEditor(context, node?.collection?._id, node?.field);
		}))
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-wix-data-view.delete-field', guarded(outputChannel, 'open the delete-field editor', async (node?: DataCollectionNode) => {
			reportAnalytics('delete_field', fieldData(node));
			await showDeleteFieldEditor(context, node?.collection?._id, node?.field?.key);
		}))
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-wix-data-view.run-query', guarded(outputChannel, 'run the query', async () => {
			await runQuery(context, credentialManager, outputChannel);
		}))
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-wix-data-view.copy-collection-id', async (node: DataCollectionNode) => {
			reportAnalytics('copy_collection_id', collectionData(node));
			dataCollectionTree.copyCollectionId(node);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-wix-data-view.copy-field-id', async (node: DataCollectionNode) => {
			reportAnalytics('copy_field_id', fieldData(node));
			dataCollectionTree.copyFieldId(node);
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('vscode-wix-data-view.manage-in-dashboard', async (node: DataCollectionNode) => {
			reportAnalytics('manage_in_dashboard', collectionData(node));
			const siteId = credentialManager.getSiteId();
			const collectionId = node.collection?._id;
			if (siteId && collectionId) {
				const url = `https://manage.wix.com/dashboard/${siteId}/wix-cms/data/${collectionId}?referralInfo=wixDataView`;
				vscode.env.openExternal(vscode.Uri.parse(url));
			}
		})
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}
