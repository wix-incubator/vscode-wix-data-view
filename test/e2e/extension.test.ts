import * as assert from 'assert';
import * as vscode from 'vscode';

import { collections } from '@wix/data';
import { DataCollectionTree } from '../../src/dataTree';

const s = suite('Wix Data Viewer', async () => {

	test('Should execute code', async () => {
		console.log('Docs');
		console.log(vscode.workspace.textDocuments);

		await vscode.commands.executeCommand('vscode-wix-data-view.new-query');

		const editor = vscode.window.activeTextEditor;
		
		await editor?.edit((editBuilder) => {
			editBuilder.insert(new vscode.Position(0, 0), '7+8\n');
		});

		await vscode.commands.executeCommand('vscode-wix-data-view.run-query');

		await new Promise((resolve) => setTimeout(resolve, 2000));

		const resultEditor = vscode.window.visibleTextEditors.find((editor) => {
			return editor.document.uri.path.includes('result');
		});

		assert.equal(resultEditor?.document.getText(), '15');
	});

	test('Should correctly build Wix Data collection tree', async () => {
		const collectionProvider = {
			getCollections: async (): Promise<collections.DataCollection[]> => {
				return [{
					_id: 'c1',
					displayName: 'Collection 1',
					fields: [
						{ key: 'field1', type: collections.Type.TEXT, displayName: 'Text Field' },
						{ key: 'field2', type: collections.Type.NUMBER, displayName: 'Number Field' },
						{ key: 'field3', type: collections.Type.DATE, displayName: 'Date Field' },
						{ key: 'field4', type: collections.Type.BOOLEAN, displayName: 'Boolean Field' },
						{ key: 'field5', type: collections.Type.OBJECT, displayName: 'Object Field' },
					]
				}, {
					_id: 'N/c2',
					displayName: 'Collection 2',
					displayNamespace: 'N',
					fields: [
						{ key: 'field1', type: collections.Type.TEXT, displayName: 'Text Field' },
						{ key: 'field2', type: collections.Type.NUMBER, displayName: 'Number Field' },
					]
				}];
			}
		};

		const dataCollectionTree = new DataCollectionTree(collectionProvider);
		await dataCollectionTree.refresh();

		const root = await dataCollectionTree.getChildren();

		assert.ok(root);
		assert.equal(root.length, 2);

		const collection1 = root[0];
		assert.equal(collection1.label, 'Collection 1');
		assert.equal(collection1.children?.length, 5);

		const field1 = collection1.children?.[0];
		assert.ok(field1);
		assert.equal(field1.label, 'field1: TEXT (\'Text Field\')');
		assert.equal(field1.type, 1);
		assert.equal(field1.field?.key, 'field1');
		assert.ok(field1.children === undefined);

		const namespaceRoot = root[1];
		assert.equal(namespaceRoot.label, 'N');
		assert.equal(namespaceRoot.children?.length, 1);
		
		const collection2 = namespaceRoot.children?.[0];
		assert.ok(collection2);
		assert.equal(collection2.label, 'Collection 2');
		assert.equal(collection2.children?.length, 2);

		assert.equal(collection2.children?.[1].label, 'field2: NUMBER (\'Number Field\')');

		const collection1Item = await dataCollectionTree.getTreeItem(collection1);
		assert.equal(collection1Item.label, 'Collection 1');
		assert.equal(collection1Item.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);

		const namespaceRootItem = await dataCollectionTree.getTreeItem(namespaceRoot);
		assert.equal(namespaceRootItem.label, 'N');
		assert.equal(namespaceRootItem.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);

		const collection2Item = await dataCollectionTree.getTreeItem(collection2);
		assert.equal(collection2Item.label, 'Collection 2');
		assert.equal(collection2Item.collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);

		const field1Item = await dataCollectionTree.getTreeItem(field1);
		assert.equal(field1Item.label, 'field1: TEXT (\'Text Field\')');
		assert.equal(field1Item.collapsibleState, vscode.TreeItemCollapsibleState.None);

		// Test copying IDs
		dataCollectionTree.copyId(collection1);
		
		const c1clipboard = await vscode.env.clipboard.readText();
		assert.equal(c1clipboard, 'c1');

		dataCollectionTree.copyId(field1);

		const f1clipboard = await vscode.env.clipboard.readText();
		assert.equal(f1clipboard, 'field1');
	});
});



export async function run(): Promise<void> {
	s.run();	
}