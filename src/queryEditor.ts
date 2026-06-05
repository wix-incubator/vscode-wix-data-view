import worker from 'node:worker_threads';
import * as vscode from 'vscode';
import { collections } from '@wix/data';
import { pick } from 'lodash';
import { WixCredentialManager } from './auth/credentialManager';
import { ensureQueryWorkspace, isAutocompleteEnabled } from './runner/queryWorkspace';

function randomSuffix(): string {
    return Math.random().toString(36).substring(2);
}

/** Legacy mode: open the query as an in-memory untitled document (no auto-complete). */
async function showUntitledEditor(filePrefix: string, initialContent?: string) {
    const documentUri = vscode.Uri.from({
        path: `${filePrefix}.${randomSuffix()}.wdq.js`,
        scheme: 'untitled',
    });

    const document = await vscode.workspace.openTextDocument(documentUri);
    const editor = await vscode.window.showTextDocument(document);

    if (initialContent) {
        await editor.edit((editBuilder) => {
            editBuilder.insert(new vscode.Position(0, 0), initialContent);
        });
    }

    return editor;
}

/** Auto-complete mode: write the query to a real file in the managed workspace. */
async function showQueryFile(context: vscode.ExtensionContext, filePrefix: string, initialContent?: string) {
    const dir = await ensureQueryWorkspace(context);

    // No open workspace folder means there's no project root to host the file,
    // so auto-complete is impossible — fall back to the legacy untitled editor.
    if (!dir) {
        return showUntitledEditor(filePrefix, initialContent);
    }

    const fileUri = vscode.Uri.joinPath(dir, `${filePrefix}.${randomSuffix()}.wdq.js`);

    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(initialContent ?? '', 'utf8'));

    const document = await vscode.workspace.openTextDocument(fileUri);
    return vscode.window.showTextDocument(document);
}

/** Opens a query document using the mode selected by the user's settings. */
async function openQueryDocument(context: vscode.ExtensionContext, filePrefix: string, initialContent?: string) {
    return isAutocompleteEnabled()
        ? showQueryFile(context, filePrefix, initialContent)
        : showUntitledEditor(filePrefix, initialContent);
}

export async function showQueryEditor(context: vscode.ExtensionContext, collection?: string) {
    await openQueryDocument(
        context,
        'query',
        collection ? `wixData.query('${collection}').find()` : undefined
    );
}

export async function showCreateCollectionEditor(context: vscode.ExtensionContext) {
    await openQueryDocument(
        context,
        'create-collection',
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
}

export async function showAddFieldEditor(context: vscode.ExtensionContext, collection?: string) {
    await openQueryDocument(
        context,
        'add-field',
        collection
            ? `collections.createDataCollectionField('${collection}', {
    field: {
        key: '<choose a key>',
        displayName: '<choose a display name>',
        type: 'TEXT'
    }
})`
            : undefined
    );
}

export async function showUpdateFieldEditor(context: vscode.ExtensionContext, collection?: string, field?: collections.Field) {
    await openQueryDocument(
        context,
        'update-field',
        collection && field
            ? `collections.updateDataCollectionField('${collection}', {
    field: ${JSON.stringify(pick(field, 'key', 'type', 'displayName', 'description', 'required'), null, 4)}
})`
            : undefined
    );
}

export async function showDeleteFieldEditor(context: vscode.ExtensionContext, collection?: string, fieldKey?: string) {
    await openQueryDocument(
        context,
        'delete-field',
        collection && fieldKey
            ? `collections.deleteDataCollectionField('${collection}', {
    fieldKey: '${fieldKey}'
})`
            : undefined
    );
}

export async function showResult(context: vscode.ExtensionContext, result: string) {
    const documentUri = vscode.Uri.from({
        path: 'result.json',
        scheme: 'untitled',
    });

    const document = await vscode.workspace.openTextDocument(documentUri);
    const editor = await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);

    await editor.edit((editBuilder) => {
        editBuilder.replace(
            new vscode.Range(document.lineAt(0).range.start, document.lineAt(document.lineCount - 1).range.end),
            result
        );
    });
}

export async function runQuery(context: vscode.ExtensionContext, credentialManager: WixCredentialManager, outputChannel: vscode.OutputChannel) {
    const editor = vscode.window.activeTextEditor;

    if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }

    const query = editor.document.getText();

    const queryRunnerWorker = new worker.Worker(
        new URL(context.extensionUri + '/dist/queryRunnerWorker.js'),
        {
            workerData: {
                auth: credentialManager.getAuth(),
                siteId: credentialManager.getSiteId(),
            }
        }
    );

    queryRunnerWorker.on('message', (result) => {
        if (result.result) {
            showResult(context, result.result);
            queryRunnerWorker.terminate();
        } else if (result.log) {
            outputChannel.appendLine('Log: ' + result.log);
        } else if (result.warn) {
            outputChannel.appendLine('Warning: ' + result.warn);
        } else if (result.error) {
            outputChannel.appendLine('Error: ' + result.error);
            vscode.window.showErrorMessage('Error: ' + result.error);
        }
    });

    queryRunnerWorker.postMessage(query);
}
