import worker from 'node:worker_threads';
import * as vscode from 'vscode';
import { WixCredentialManager } from './auth/credentialManager';

export async function showQueryEditor(context: vscode.ExtensionContext, collection?: string) {
    const rnd = Math.random().toString(36).substring(2);
    const documentUri = vscode.Uri.from({
        path: `query.${rnd}.wdq.js`,
        scheme: 'untitled',
    });

    const document = await vscode.workspace.openTextDocument(documentUri);
    const editor = await vscode.window.showTextDocument(document);

    await editor.edit((editBuilder) => {
        if (collection) {
            editBuilder.insert(new vscode.Position(0, 0), `wixData.query('${collection}').find()`);
        }
    });

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