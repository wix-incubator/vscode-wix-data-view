import assert from 'assert';
import Module from 'module';

describe('WorkspaceWixConfigSiteIdSource', () => {
    it('reads the site ID from wix.config.json', () => {
        const { source } = createSource({ '/workspace/wix.config.json': '{"siteId":"legacy-site"}' });

        assert.equal(source.getSiteId(), 'legacy-site');
        assert.equal(source.isAvailable(), true);
        assert.equal(source.isReady(), true);
    });

    it('reads the site ID from .wix/app.config.json when wix.config.json is absent', () => {
        const { source } = createSource({ '/workspace/.wix/app.config.json': '{"siteId":"app-site"}' });

        assert.equal(source.getSiteId(), 'app-site');
        assert.equal(source.isAvailable(), true);
        assert.equal(source.isReady(), true);
    });

    it('prefers wix.config.json when both files have a site ID', () => {
        const { source } = createSource({
            '/workspace/wix.config.json': '{"siteId":"legacy-site"}',
            '/workspace/.wix/app.config.json': '{"siteId":"app-site"}',
        });

        assert.equal(source.getSiteId(), 'legacy-site');
    });

    it('checks app.config.json when wix.config.json has no site ID', () => {
        const { source } = createSource({
            '/workspace/wix.config.json': '{}',
            '/workspace/.wix/app.config.json': '{"siteId":"app-site"}',
        });

        assert.equal(source.getSiteId(), 'app-site');
    });

    it('checks later workspace folders for app.config.json', () => {
        const { source } = createSource({
            '/other/.wix/app.config.json': '{"siteId":"other-site"}',
        }, ['/workspace', '/other']);

        assert.equal(source.getSiteId(), 'other-site');
        assert.equal(source.isAvailable(), true);
    });

    it('reports the app.config.json path when its JSON is invalid', () => {
        const { source, errorMessages } = createSource({ '/workspace/.wix/app.config.json': '{' });

        assert.equal(source.getSiteId(), '');
        assert.equal(source.isReady(), true);
        assert.deepEqual(errorMessages, [
            'app.config.json could not be read. Check that the file contains valid JSON. File: /workspace/.wix/app.config.json',
        ]);
    });

    it('reports invalid wix.config.json instead of selecting a lower-priority app config', () => {
        const { source, errorMessages } = createSource({
            '/workspace/wix.config.json': '{',
            '/workspace/.wix/app.config.json': '{"siteId":"app-site"}',
        });

        assert.equal(source.getSiteId(), '');
        assert.equal(source.isReady(), true);
        assert.deepEqual(errorMessages, [
            'wix.config.json could not be read. Check that the file contains valid JSON. File: /workspace/wix.config.json',
        ]);
    });

    it('reports no configuration when neither file exists', () => {
        const { source } = createSource({});

        assert.equal(source.getSiteId(), '');
        assert.equal(source.isAvailable(), false);
        assert.equal(source.isReady(), true);
    });

    it('handles an empty workspace', () => {
        const { source } = createSource({}, []);

        assert.equal(source.getSiteId(), '');
        assert.equal(source.isAvailable(), false);
        assert.equal(source.isReady(), true);
    });

    it('clears the previous site ID when configuration is removed and reloaded', () => {
        const files = { '/workspace/.wix/app.config.json': '{"siteId":"app-site"}' } as Record<string, string>;
        const { source } = createSource(files);

        delete files['/workspace/.wix/app.config.json'];
        source.load();

        assert.equal(source.getSiteId(), '');
        assert.equal(source.isAvailable(), false);
    });
});

function createSource(files: Record<string, string>, folders = ['/workspace']) {
    const errorMessages: string[] = [];
    const vscodeStub = {
        workspace: { workspaceFolders: folders.map((fsPath) => ({ uri: { fsPath } })) },
        window: { showErrorMessage: (message: string) => errorMessages.push(message) },
    };
    const fsStub = {
        existsSync: (filePath: string) => Object.prototype.hasOwnProperty.call(files, filePath),
        readFileSync: (filePath: string) => files[filePath],
    };
    const modulePrototype = Module.prototype as any;
    const originalRequire = modulePrototype.require;
    modulePrototype.require = function (request: string) {
        if (request === 'vscode') {
            return vscodeStub;
        }
        if (request === 'fs') {
            return fsStub;
        }
        return originalRequire.call(this, request);
    };

    const sourcePath = require.resolve('../../src/auth/workspaceWixConfigSiteIdSource');
    try {
        delete require.cache[sourcePath];
        const { WorkspaceWixConfigSiteIdSource } = require(sourcePath) as typeof import('../../src/auth/workspaceWixConfigSiteIdSource');
        return { source: new WorkspaceWixConfigSiteIdSource({} as never), errorMessages };
    } finally {
        delete require.cache[sourcePath];
        modulePrototype.require = originalRequire;
    }
}
