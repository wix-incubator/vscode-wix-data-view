import assert from 'assert';
import Module from 'module';
import { formatCredentialLoadError, parseWixConfig } from '../../src/auth/credentialErrors';

describe('credential source errors', () => {
    it('reports which wix.config.json is invalid', () => {
        assert.throws(
            () => parseWixConfig('{', '/workspace/wix.config.json'),
            /wix\.config\.json could not be read\. Check that the file contains valid JSON/
        );
    });

    it('explains how to recover when credentials cannot be loaded', () => {
        assert.equal(
            formatCredentialLoadError(new Error('secret store unavailable')),
            'Unable to read stored credentials. Please reopen VS Code and try again.'
        );
    });
});

describe('APIKeyAuthSource', () => {
    it('handles a rejected SecretStorage thenable and shows a useful error', async () => {
        const errorMessages: string[] = [];
        const vscodeStub = {
            window: {
                showErrorMessage: (message: string) => {
                    errorMessages.push(message);
                },
            },
        };
        const modulePrototype = Module.prototype as any;
        const originalRequire = modulePrototype.require;
        modulePrototype.require = function (request: string) {
            if (request === 'vscode') {
                return vscodeStub;
            }
            return originalRequire.call(this, request);
        };

        try {
            const { APIKeyAuthSource } = require('../../src/auth/credentialSources') as typeof import('../../src/auth/credentialSources');
            const source = new APIKeyAuthSource({
                secrets: {
                    get: () => ({
                        then: (_resolve: (value: string | undefined) => void, reject: (reason: Error) => void) => {
                            reject(new Error('secret store unavailable'));
                        },
                    }),
                },
            } as never);

            await new Promise<void>((resolve) => setImmediate(resolve));

            assert.equal(source.isReady(), true);
            assert.equal(source.getApiKey(), '');
            assert.deepEqual(errorMessages, [
                'Unable to read stored credentials. Please reopen VS Code and try again.',
            ]);
        } finally {
            modulePrototype.require = originalRequire;
        }
    });

    it('uses a stored secret when one is available', async () => {
        const { source } = await createSource({ storedApiKey: 'stored-key' });

        assert.equal(source.isReady(), true);
        assert.equal(source.getApiKey(), 'stored-key');
        assert.equal(source.getApiKeySource(), 'SecretStore');
    });

    it('falls back to the Wix CLI token when no stored secret exists', async () => {
        const { source } = await createSource({ cliApiKey: 'cli-key' });

        assert.equal(source.isReady(), true);
        assert.equal(source.getApiKey(), 'cli-key');
        assert.equal(source.getApiKeySource(), 'WixCli');
    });

    it('reports no credentials when neither source is available', async () => {
        const { source } = await createSource();

        assert.equal(source.isReady(), true);
        assert.equal(source.getApiKey(), '');
        assert.equal(source.getApiKeySource(), undefined);
    });

    it('uses a manually updated API key immediately', async () => {
        const { source, storedApiKey } = await createSource();

        source.updateApiKey('manual-key');

        assert.equal(source.getApiKey(), 'manual-key');
        assert.equal(source.getApiKeySource(), 'SecretStore');
        assert.deepEqual(storedApiKey, ['manual-key']);
    });

    it('removes the persisted API key when cleared', async () => {
        const { source, deletedApiKeys } = await createSource({ storedApiKey: 'stored-key' });

        source.updateApiKey('');

        assert.equal(source.getApiKey(), '');
        assert.equal(source.getApiKeySource(), undefined);
        assert.deepEqual(deletedApiKeys, ['wixApiKey']);
    });
});

async function createSource(options: { storedApiKey?: string; cliApiKey?: string } = {}) {
    const storedApiKey: string[] = [];
    const deletedApiKeys: string[] = [];
    const modulePrototype = Module.prototype as any;
    const originalRequire = modulePrototype.require;
    const vscodeStub = { window: { showErrorMessage: () => undefined } };
    const fsStub = {
        existsSync: () => options.cliApiKey !== undefined,
        readFileSync: () => JSON.stringify({ token: options.cliApiKey }),
    };
    const osStub = { homedir: () => '/home/test' };

    modulePrototype.require = function (request: string) {
        if (request === 'vscode') {
            return vscodeStub;
        }
        if (request === 'fs') {
            return fsStub;
        }
        if (request === 'os') {
            return osStub;
        }
        return originalRequire.call(this, request);
    };

    try {
        delete require.cache[require.resolve('../../src/auth/credentialSources')];
        const { APIKeyAuthSource } = require('../../src/auth/credentialSources') as typeof import('../../src/auth/credentialSources');
        const source = new APIKeyAuthSource({
            secrets: {
                get: () => Promise.resolve(options.storedApiKey),
                store: (key: string, value: string) => {
                    storedApiKey.push(value);
                    return Promise.resolve();
                },
                delete: (key: string) => {
                    deletedApiKeys.push(key);
                    return Promise.resolve();
                },
            },
        } as never);

        await new Promise<void>((resolve) => setImmediate(resolve));
        return { source, storedApiKey, deletedApiKeys };
    } finally {
        modulePrototype.require = originalRequire;
    }
}
