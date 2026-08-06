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
		assert.equal(field1.collection?._id, 'c1');
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
		dataCollectionTree.copyCollectionId(collection1);

		const c1clipboard = await vscode.env.clipboard.readText();
		assert.equal(c1clipboard, 'c1');

		dataCollectionTree.copyFieldId(field1);

		const f1clipboard = await vscode.env.clipboard.readText();
		assert.equal(f1clipboard, 'field1');
	});

	test('Should assign an icon to every Wix Data field type', () => {
		const dataCollectionTree = new DataCollectionTree({ getCollections: async () => [] });
		const expectedIcons: Record<string, string> = {
			TEXT: 'ic-type-text.svg',
			NUMBER: 'ic-type-number.svg',
			DATE: 'ic-type-calendar.svg',
			DATETIME: 'ic-type-calendar.svg',
			IMAGE: 'ic-type-image.svg',
			BOOLEAN: 'ic-type-boolean.svg',
			DOCUMENT: 'ic-type-document.svg',
			URL: 'ic-type-url.svg',
			RICH_TEXT: 'ic-type-richtext.svg',
			VIDEO: 'ic-type-video.svg',
			ANY: 'ic-type-custom.svg',
			ARRAY_STRING: 'ic-type-tags.svg',
			ARRAY_DOCUMENT: 'ic-type-document-array.svg',
			AUDIO: 'ic-type-audio.svg',
			TIME: 'ic-type-time.svg',
			LANGUAGE: 'ic-type-language.svg',
			EMAIL: 'ic-type-text.svg',
			RICH_CONTENT: 'ic-type-rich-content.svg',
			MEDIA_GALLERY: 'ic-type-media-gallery.svg',
			ADDRESS: 'ic-type-address.svg',
			PAGE_LINK: 'ic-type-url.svg',
			SLUG: 'ic-type-url.svg',
			REFERENCE: 'ic-type-reference.svg',
			MULTI_REFERENCE: 'ic-type-reference-multi.svg',
			OBJECT: 'ic-type-object.svg',
			ARRAY: 'ic-type-array.svg',
			LEGACY_TIME: 'ic-type-time.svg',
			LEGACY_BOOK: 'ic-type-document.svg',
			LEGACY_EXTERNAL_URL: 'ic-type-url.svg',
			LEGACY_BROKEN_REFERENCE: 'ic-type-reference.svg',
			LEGACY_IMAGE: 'ic-type-image.svg',
			SECURED_MEDIA: 'ic-type-image.svg',
			MEDIA_IMAGE: 'ic-type-image.svg',
			MEDIA_VECTOR_ART: 'ic-type-media-vector-art.svg',
			LEGACY_COLOR: 'ic-type-color.svg',
			LEGACY_EXTERNAL_VIDEO: 'ic-type-video.svg',
		};

		for (const [type, icon] of Object.entries(expectedIcons)) {
			const fieldIcon = dataCollectionTree.determineFieldIcon({ type: type as collections.Type });
			assert.equal(fieldIcon.light.endsWith(`/light/${icon}`), true, `${type} should use ${icon}`);
			assert.equal(fieldIcon.dark.endsWith(`/dark/${icon}`), true, `${type} should use ${icon}`);
		}
	});

	test('Should open add field editor for selected collection', async () => {
		const node = {
			collection: {
				_id: 'Books',
			},
		};

		await vscode.commands.executeCommand('vscode-wix-data-view.add-field', node);

		const editor = vscode.window.activeTextEditor;
		assert.ok(editor);
		assert.equal(
			editor?.document.getText(),
			`collections.createDataCollectionField('Books', {
    field: {
        key: '<choose a key>',
        displayName: '<choose a display name>',
        type: 'TEXT'
    }
})`
		);
	});

	test('Should open update field editor for selected field', async () => {
		const node = {
			collection: {
				_id: 'Books',
			},
			field: {
				key: 'author',
				type: collections.Type.TEXT,
				displayName: 'Author',
			},
		};

		await vscode.commands.executeCommand('vscode-wix-data-view.update-field', node);

		const editor = vscode.window.activeTextEditor;
		assert.ok(editor);
		assert.equal(
			editor?.document.getText(),
			`collections.updateDataCollectionField('Books', {
    field: ${JSON.stringify({ key: 'author', type: 'TEXT', displayName: 'Author' }, null, 4)}
})`
		);
	});

	test('Should open create collection editor', async () => {
		await vscode.commands.executeCommand('vscode-wix-data-view.create-collection');

		const editor = vscode.window.activeTextEditor;
		assert.ok(editor);
		assert.equal(
			editor?.document.getText(),
			`collections.createDataCollection({
    _id: '<id>',
    displayName: '<displayName>',
    fields: [
        {
            key: 'title',
            displayName: 'Title',
            type: 'TEXT'
        }
    ],
    permissions: {
        insert: 'ADMIN',
        update: 'ADMIN',
        remove: 'ADMIN',
        read: 'ADMIN'
    }
})`
		);
	});

	test('Should open delete field editor for selected field', async () => {
		const node = {
			collection: {
				_id: 'Books',
			},
			field: {
				key: 'author',
			},
		};

		await vscode.commands.executeCommand('vscode-wix-data-view.delete-field', node);

		const editor = vscode.window.activeTextEditor;
		assert.ok(editor);
		assert.equal(
			editor?.document.getText(),
			`collections.deleteDataCollectionField('Books', {
    fieldKey: 'author'
})`
		);
	});
});



export async function run(): Promise<void> {
	s.run();	
}
