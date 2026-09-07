import * as vscode from 'vscode';

export type AnalyticsData = Record<string, string | number | boolean | null | undefined>;
export type AnalyticsReporter = (event: string, data?: AnalyticsData) => void;

/**
 * Reports an analytics event through the Wix IDE Platform bridge. The bridge
 * derives the `extension` field from `context.extension`; the host (Studio 2)
 * maps `{ extension, event, data }` to its own BI events. Whether the bridge
 * command is registered is looked up once, via `vscode.commands.getCommands()`;
 * outside the Wix IDE it is absent, which is a normal situation, so events are
 * silently skipped there — this extension must keep working in plain VS Code.
 * A failure of an existing bridge command is still warned to the console.
 */
export function createAnalyticsReporter(context: vscode.ExtensionContext): AnalyticsReporter {
    // Resolved once per session. Outside the Wix IDE the bridge extension is not
    // installed, which is a normal situation: analytics are simply not reported.
    const bridgeAvailable = vscode.commands
        .getCommands(true)
        .then((commands) => commands.includes('wixIdePlatform.reportAnalyticsEvent'), () => false);

    return (event, data) => {
        Promise.resolve(bridgeAvailable)
            .then((available) => {
                if (!available) return;
                return vscode.commands.executeCommand('wixIdePlatform.reportAnalyticsEvent', context.extension, event, data);
            })
            .catch((error: unknown) => {
                console.warn(`[vscode-wix-data-view] analytics event "${event}" not reported:`, error);
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
