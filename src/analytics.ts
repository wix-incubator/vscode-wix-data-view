import * as vscode from 'vscode';

export type QueryOperation = 'query' | 'create_collection' | 'add_field' | 'update_field' | 'delete_field' | 'unknown';
export type AnalyticsData = {
    operation?: QueryOperation;
    status?: 'success' | 'failure';
    failureReason?: string;
    collectionName?: string;
    collectionId?: string;
    fieldName?: string;
};
export type AnalyticsReporter = (event: string, data?: AnalyticsData) => void;

/**
 * Reports an analytics event through the Wix IDE Platform bridge. The bridge
 * derives the `extension` field from `context.extension`; the host (Studio 2)
 * maps `{ extension, event, data }` to its own BI events. Only fixed metadata
 * is allowed in `data`; query text, code, and results must never be sent.
 * Collection and field metadata may be included. Failure reasons may be
 * included for failed runs. Outside the Wix IDE the bridge command does not
 * exist and the call rejects; that is a normal situation, so rejections are
 * swallowed and nothing is logged.
 */
export function createAnalyticsReporter(context: vscode.ExtensionContext): AnalyticsReporter {
    return (event, data) => {
        if (!vscode.workspace.getConfiguration('vscode-wix-data-view').get<boolean>('analytics.enabled', true)) {
            return;
        }
        try {
            Promise.resolve(
                vscode.commands.executeCommand('wixIdePlatform.reportAnalyticsEvent', context.extension, event, data)
            ).catch(() => {
                // Not running inside the Wix IDE, or the bridge rejected the event.
            });
        } catch {
            // The host may reject the command synchronously during shutdown.
        }
    };
}

const operationByPrefix: Record<string, QueryOperation> = {
    'query': 'query',
    'create-collection': 'create_collection',
    'add-field': 'add_field',
    'update-field': 'update_field',
    'delete-field': 'delete_field',
};

/**
 * Query documents are named `<prefix>.<random>.wdq.js` by queryEditor.ts; the
 * prefix says which operation the editor was opened for.
 */
export function queryOperationFromPath(filePath: string): QueryOperation {
    const fileName = filePath.split(/[\\/]/).pop() ?? '';
    const prefix = fileName.split('.')[0];
    return fileName.endsWith('.wdq.js') ? operationByPrefix[prefix] ?? 'unknown' : 'unknown';
}
