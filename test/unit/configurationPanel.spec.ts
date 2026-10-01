import assert from 'assert';
import fs from 'fs';
import Module from 'module';
import path from 'path';
import vm from 'vm';

describe('ConfigurationPanel', () => {
    it('shows automatic sources without prefilling them as manual credentials', () => {
        const { webview } = createPanel();

        assert.match(webview.html, /Wix CLI API key is in use/);
        assert.match(webview.html, /Workspace Site ID is in use/);
        assert.match(webview.html, /workspace-site/);
        assert.match(webview.html, /id="apiKey"[^>]*value=""/);
        assert.match(webview.html, /id="siteId"[^>]*value=""/);
        assert.doesNotMatch(webview.html, /cli-key/);
    });

    it('saving an API key leaves the workspace site ID unpinned', async () => {
        const { receiveMessage, apiKeyUpdates, siteIdUpdates, webview } = createPanel();

        await receiveMessage({ command: 'saveApiKey', apiKey: 'manual-key', siteId: 'workspace-site' });

        assert.deepEqual(apiKeyUpdates, ['manual-key']);
        assert.deepEqual(siteIdUpdates, []);
        assert.match(webview.html, /Saved API key is in use/);
        assert.match(webview.html, /Workspace Site ID is in use/);
    });

    it('saving and clearing a site ID leaves the CLI API key untouched and updates its source display', async () => {
        const { receiveMessage, apiKeyUpdates, siteIdUpdates, webview } = createPanel();

        await receiveMessage({ command: 'saveSiteId', siteId: 'manual-site', apiKey: 'cli-key' });

        assert.deepEqual(apiKeyUpdates, []);
        assert.deepEqual(siteIdUpdates, ['manual-site']);
        assert.match(webview.html, /Saved Site ID is in use/);
        assert.match(webview.html, /id="siteId"[^>]*value="manual-site"/);
        assert.match(webview.html, /Wix CLI API key is in use/);

        await receiveMessage({ command: 'saveSiteId', siteId: '' });

        assert.deepEqual(siteIdUpdates, ['manual-site', '']);
        assert.match(webview.html, /Workspace Site ID is in use/);
        assert.match(webview.html, /id="siteId"[^>]*value=""/);
    });

    it('each form sends only its own credential and prevents page navigation', () => {
        const listeners: Record<string, (event: { preventDefault(): void }) => void> = {};
        const messages: unknown[] = [];
        const inputs: Record<string, { value: string }> = {
            apiKey: { value: 'manual-key' },
            siteId: { value: 'manual-site' },
        };
        vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../assets/configuration.js'), 'utf8'), {
            acquireVsCodeApi: () => ({ postMessage: (message: unknown) => messages.push(message) }),
            document: {
                getElementById: (id: string) => inputs[id] ?? {
                    addEventListener: (_event: string, listener: typeof listeners[string]) => {
                        listeners[id] = listener;
                    },
                },
            },
        });
        let prevented = 0;
        const event = { preventDefault: () => { prevented++; } };
        listeners.apiKeyForm(event);
        listeners.siteIdForm(event);

        assert.equal(prevented, 2);
        assert.deepEqual(JSON.parse(JSON.stringify(messages)), [
            { command: 'saveApiKey', apiKey: 'manual-key' },
            { command: 'saveSiteId', siteId: 'manual-site' },
        ]);
    });
});

function createPanel() {
    const apiKeyUpdates: string[] = [];
    const siteIdUpdates: string[] = [];
    let savedApiKey = '';
    let savedSiteId = '';
    let receiveMessage!: (message: unknown) => Promise<void>;
    const webview = {
        html: '',
        cspSource: 'test-source',
        asWebviewUri: (uri: string) => uri,
        onDidReceiveMessage: (handler: typeof receiveMessage) => { receiveMessage = handler; },
    };
    const panel = { webview, onDidDispose: () => undefined };
    const manager = {
        getAuth: () => ({ type: 'APIKey', apiKey: savedApiKey || 'cli-key' }),
        getSiteId: () => savedSiteId || 'workspace-site',
        getSavedSiteId: () => savedSiteId,
        isUsingWixCliApiKey: () => !savedApiKey,
        isUsingWorkspaceSiteId: () => !savedSiteId,
        updateApiKey: (value: string) => { apiKeyUpdates.push(value); savedApiKey = value; },
        updateSiteId: (value: string) => { siteIdUpdates.push(value); savedSiteId = value; },
    };
    const vscodeStub = {
        window: {
            createWebviewPanel: () => panel,
            showInformationMessage: () => Promise.resolve(undefined),
        },
        commands: { executeCommand: () => Promise.resolve() },
        Uri: { joinPath: (...segments: string[]) => segments.join('/') },
    };
    const modulePrototype = Module.prototype as any;
    const originalRequire = modulePrototype.require;
    const panelPath = require.resolve('../../src/panels/configurationPanel');
    const cachedModule = require.cache[panelPath];
    modulePrototype.require = function (request: string) {
        return request === 'vscode' ? vscodeStub : originalRequire.call(this, request);
    };

    try {
        delete require.cache[panelPath];
        const { ConfigurationPanel } = require(panelPath) as typeof import('../../src/panels/configurationPanel');
        new ConfigurationPanel('/extension' as never, 1, manager as never);
        return { webview, receiveMessage, apiKeyUpdates, siteIdUpdates };
    } finally {
        modulePrototype.require = originalRequire;
        if (cachedModule) {
            require.cache[panelPath] = cachedModule;
        } else {
            delete require.cache[panelPath];
        }
    }
}
