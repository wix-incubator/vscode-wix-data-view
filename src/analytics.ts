import * as vscode from 'vscode';

export type AnalyticsData = Record<string, string | number | boolean | null | undefined>;
export type AnalyticsReporter = (event: string, data?: AnalyticsData) => void;

/**
 * Reports an analytics event through the Wix IDE Platform bridge. The bridge
 * derives the `extension` field from `context.extension`; the host (Studio 2)
 * maps `{ extension, event, data }` to its own BI events. Outside the Wix IDE
 * the bridge command does not exist and the call rejects; that is a normal
 * situation, so rejections are swallowed and nothing is logged — the bridge
 * itself logs rejected payloads in its output channel.
 */
export function createAnalyticsReporter(context: vscode.ExtensionContext): AnalyticsReporter {
    return (event, data) => {
        Promise.resolve(
            vscode.commands.executeCommand('wixIdePlatform.reportAnalyticsEvent', context.extension, event, data)
        ).catch(() => {
            // Not running inside the Wix IDE, or the bridge rejected the event.
        });
    };
}

export type QueryOperation = 'query' | 'create_collection' | 'add_field' | 'update_field' | 'delete_field' | 'unknown';

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
