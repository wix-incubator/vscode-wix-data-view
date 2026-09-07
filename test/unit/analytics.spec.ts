import assert from 'assert';
import Module from 'module';

type ExecuteCommand = (command: string, ...args: unknown[]) => Promise<unknown>;

function loadAnalyticsWithVscodeStub(executeCommand: ExecuteCommand) {
    const modulePrototype = Module.prototype as any;
    const originalRequire = modulePrototype.require;
    modulePrototype.require = function (request: string) {
        if (request === 'vscode') {
            return {
                commands: {
                    executeCommand,
                },
            };
        }
        return originalRequire.call(this, request);
    };
    try {
        delete require.cache[require.resolve('../../src/analytics')];
        return require('../../src/analytics') as typeof import('../../src/analytics');
    } finally {
        modulePrototype.require = originalRequire;
    }
}

const context = {
    extension: { packageJSON: { name: 'vscode-wix-data-view' } },
} as never;

describe('createAnalyticsReporter', () => {
    it('executes the bridge command with the extension, event and data', async () => {
        const calls: unknown[][] = [];
        const { createAnalyticsReporter } = loadAnalyticsWithVscodeStub(async (...args) => {
            calls.push(args);
        });

        createAnalyticsReporter(context)('collection_click', { collectionName: 'Blog', collectionId: 'blog' });
        await new Promise<void>((resolve) => setImmediate(resolve));

        assert.deepEqual(calls, [[
            'wixIdePlatform.reportAnalyticsEvent',
            (context as any).extension,
            'collection_click',
            { collectionName: 'Blog', collectionId: 'blog' },
        ]]);
    });

    it('passes undefined data through when omitted', async () => {
        const calls: unknown[][] = [];
        const { createAnalyticsReporter } = loadAnalyticsWithVscodeStub(async (...args) => {
            calls.push(args);
        });

        createAnalyticsReporter(context)('panel_opened');
        await new Promise<void>((resolve) => setImmediate(resolve));

        assert.deepEqual(calls[0].slice(2), ['panel_opened', undefined]);
    });

    it('swallows a rejected command without logging', async () => {
        const originalWarn = console.warn;
        const originalError = console.error;
        const warnings: unknown[][] = [];
        const errors: unknown[][] = [];
        console.warn = (...args: unknown[]) => {
            warnings.push(args);
        };
        console.error = (...args: unknown[]) => {
            errors.push(args);
        };

        let unhandledRejectionFired = false;
        const onUnhandledRejection = () => {
            unhandledRejectionFired = true;
        };
        process.on('unhandledRejection', onUnhandledRejection);

        try {
            const { createAnalyticsReporter } = loadAnalyticsWithVscodeStub(async () => {
                throw new Error("command 'wixIdePlatform.reportAnalyticsEvent' not found");
            });

            const report = createAnalyticsReporter(context);
            assert.doesNotThrow(() => report('refresh'));
            await new Promise<void>((resolve) => setImmediate(resolve));

            assert.equal(warnings.length, 0);
            assert.equal(errors.length, 0);
            assert.equal(unhandledRejectionFired, false);
        } finally {
            process.removeListener('unhandledRejection', onUnhandledRejection);
            console.warn = originalWarn;
            console.error = originalError;
        }
    });
});

describe('queryOperationFromPath', () => {
    const { queryOperationFromPath } = loadAnalyticsWithVscodeStub(async () => undefined);

    it('maps each query file prefix to an operation', () => {
        assert.equal(queryOperationFromPath('/ws/.wix-data-view/query.k3j9x.wdq.js'), 'query');
        assert.equal(queryOperationFromPath('create-collection.abc.wdq.js'), 'create_collection');
        assert.equal(queryOperationFromPath('/tmp/add-field.1.wdq.js'), 'add_field');
        assert.equal(queryOperationFromPath('update-field.zz.wdq.js'), 'update_field');
        assert.equal(queryOperationFromPath('delete-field.zz.wdq.js'), 'delete_field');
    });

    it('returns unknown for other documents', () => {
        assert.equal(queryOperationFromPath('/ws/src/index.js'), 'unknown');
        assert.equal(queryOperationFromPath('notes.wdq.js'), 'unknown');
        assert.equal(queryOperationFromPath(''), 'unknown');
    });
});
