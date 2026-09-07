import * as vscode from 'vscode';

export type AnalyticsData = Record<string, string | number | boolean | null | undefined>;
export type AnalyticsReporter = (event: string, data?: AnalyticsData) => void;

/**
 * Reports an analytics event through the Wix IDE Platform bridge. The bridge
 * derives the `extension` field from `context.extension`; the host (Studio 2)
 * maps `{ extension, event, data }` to its own BI events. Whether the bridge
 * command is registered is looked up via `vscode.commands.getCommands()` on
 * each report until it is found — outside the Wix IDE it stays absent, which
 * is a normal situation, so events are silently skipped there and this
 * extension keeps working in plain VS Code; inside the Wix IDE the bridge may
 * activate after this extension, so the lookup is repeated until it appears,
 * then remembered for the rest of the session. A failure of an existing
 * bridge command is still warned to the console.
 */
export function createAnalyticsReporter(context: vscode.ExtensionContext): AnalyticsReporter {
    // Outside the Wix IDE the bridge extension is not installed, which is a
    // normal situation: analytics are simply not reported. Inside the Wix IDE
    // the bridge may activate after this extension, so an absent command is
    // looked up again on the next report; a found command is remembered.
    let bridgeAvailable = false;
    const isBridgeAvailable = (): Promise<boolean> => {
        if (bridgeAvailable) return Promise.resolve(true);
        return Promise.resolve(vscode.commands.getCommands(true)).then(
            (commands) => (bridgeAvailable = commands.includes('wixIdePlatform.reportAnalyticsEvent')),
            () => false
        );
    };

    return (event, data) => {
        isBridgeAvailable()
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
