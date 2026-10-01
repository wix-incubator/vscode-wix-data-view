import assert from 'assert';
import Module from 'module';

describe('WixCredentialManager site ID selection', () => {
    it('uses the workspace site ID automatically when the saved site ID is empty', () => {
        const { manager, prompts } = createManager('', 'workspace-site');

        assert.equal(manager.getSiteId(), 'workspace-site');
        assert.equal(manager.getSavedSiteId(), '');
        assert.equal(manager.isUsingWorkspaceSiteId(), true);
        assert.deepEqual(prompts, []);
    });

    it('uses the workspace site ID when no site ID has been saved', () => {
        const { manager, prompts } = createManager(undefined, 'workspace-site');

        assert.equal(manager.getSiteId(), 'workspace-site');
        assert.deepEqual(prompts, []);
    });

    it('keeps a nonempty saved site ID and offers to switch to the workspace site', () => {
        const { manager, prompts } = createManager('saved-site', 'workspace-site');

        assert.equal(manager.getSiteId(), 'saved-site');
        assert.equal(manager.getSavedSiteId(), 'saved-site');
        assert.equal(manager.isUsingWorkspaceSiteId(), false);
        assert.equal(prompts.length, 1);
    });

    it('falls back to the workspace site when the saved site ID is cleared', () => {
        const { manager, updates } = createManager('saved-site', 'workspace-site');

        manager.updateSiteId('');

        assert.equal(manager.getSiteId(), 'workspace-site');
        assert.deepEqual(updates, [['wixSiteId', '']]);
    });

    it('returns an empty site ID when neither source has one', () => {
        const { manager, prompts } = createManager('');

        assert.equal(manager.getSiteId(), '');
        assert.equal(manager.isUsingWorkspaceSiteId(), false);
        assert.deepEqual(prompts, []);
    });

    it('does not suggest switching to a workspace config with no site ID', () => {
        const { manager, prompts } = createManager('saved-site', '');

        assert.equal(manager.getSiteId(), 'saved-site');
        assert.deepEqual(prompts, []);
    });
});

function createManager(savedSiteId?: string, workspaceSiteId?: string) {
    const prompts: string[] = [];
    const updates: unknown[][] = [];
    const vscodeStub = {
        workspace: { workspaceFolders: [{ uri: { fsPath: '/workspace' } }] },
        window: {
            showInformationMessage: (message: string) => {
                prompts.push(message);
                return Promise.resolve(undefined);
            },
            showErrorMessage: (message: string) => assert.fail(message),
        },
    };
    const fsStub = {
        existsSync: (filePath: string) => workspaceSiteId !== undefined && filePath === '/workspace/.wix/app.config.json',
        readFileSync: () => JSON.stringify({ siteId: workspaceSiteId }),
    };
    const modulePrototype = Module.prototype as any;
    const originalRequire = modulePrototype.require;
    const modulePaths = [
        '../../src/auth/credentialManager',
        '../../src/auth/apiKeyAuthSource',
        '../../src/auth/configurationSiteIdSource',
        '../../src/auth/workspaceWixConfigSiteIdSource',
    ].map((modulePath) => require.resolve(modulePath));
    const cachedModules = modulePaths.map((modulePath) => require.cache[modulePath]);

    modulePrototype.require = function (request: string) {
        if (request === 'vscode') {
            return vscodeStub;
        }
        if (request === 'fs') {
            return fsStub;
        }
        return originalRequire.call(this, request);
    };

    try {
        for (const modulePath of modulePaths) {
            delete require.cache[modulePath];
        }
        const { WixCredentialManager } = require(modulePaths[0]) as typeof import('../../src/auth/credentialManager');
        const manager = new WixCredentialManager({
            secrets: { get: () => Promise.resolve('stored-key') },
            globalState: {
                get: () => savedSiteId,
                update: (...args: unknown[]) => {
                    updates.push(args);
                    return Promise.resolve();
                },
            },
        } as never);

        return { manager, prompts, updates };
    } finally {
        modulePrototype.require = originalRequire;
        modulePaths.forEach((modulePath, index) => {
            if (cachedModules[index]) {
                require.cache[modulePath] = cachedModules[index];
            } else {
                delete require.cache[modulePath];
            }
        });
    }
}
