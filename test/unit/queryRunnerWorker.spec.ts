import worker from 'node:worker_threads';
import assert from 'assert';

describe('queryRunnerWorker', async () => {
    it('should execute code and respond with results', async () => {
        const queryRunnerWorker = createWorker();
        
        const resultPromise = new Promise((resolve) => {
            queryRunnerWorker.on('message', (result) => {
                resolve(result);
            });
        });

        queryRunnerWorker.postMessage("2+5");

        const result = await resultPromise;
        assert.deepStrictEqual(result, { result: "7" });

        queryRunnerWorker.terminate();
    });

    it('should execute code and respond with results in a promise', async () => {
        const queryRunnerWorker = createWorker();
        
        const resultPromise = new Promise((resolve) => {
            queryRunnerWorker.on('message', (result) => {
                resolve(result);
            });
        });

        queryRunnerWorker.postMessage("new Promise((resolve) => resolve(3+5))");

        const result = await resultPromise;
        assert.deepStrictEqual(result, { result: "8" });

        queryRunnerWorker.terminate();
    });

    it('should log console.log messages', async () => {
        const queryRunnerWorker = createWorker();

        const resultPromise = new Promise((resolve) => {
            queryRunnerWorker.on('message', (result) => {
                resolve(result);
            });
        });

        queryRunnerWorker.postMessage("console.log('Hello, World!')");

        const result = await resultPromise;
        assert.deepStrictEqual(result, { log: "Hello, World!" });

        queryRunnerWorker.terminate();
    });

    it('should log console.warn messages', async () => {
        const queryRunnerWorker = createWorker();

        const resultPromise = new Promise((resolve) => {
            queryRunnerWorker.on('message', (result) => {
                resolve(result);
            });
        });

        queryRunnerWorker.postMessage("console.warn('Warning!')");

        const result = await resultPromise;
        assert.deepStrictEqual(result, { warn: "Warning!" });

        queryRunnerWorker.terminate();
    });

    it('should log console.error messages', async () => {
        const queryRunnerWorker = createWorker();

        const resultPromise = new Promise((resolve) => {
            queryRunnerWorker.on('message', (result) => {
                resolve(result);
            });
        });

        queryRunnerWorker.postMessage("console.error('Error!')");

        const result = await resultPromise;
        assert.deepStrictEqual(result, { error: "Error!" });

        queryRunnerWorker.terminate();
    });

    it('should report a thrown error as a single message with result and error', async () => {
        const queryRunnerWorker = createWorker();

        const messages: any[] = [];
        queryRunnerWorker.on('message', (result) => {
            messages.push(result);
        });

        queryRunnerWorker.postMessage("throw Object.assign(new Error('boom'), { code: 403 })");

        await new Promise((resolve) => setTimeout(resolve, 300));

        assert.strictEqual(messages.length, 1);
        assert.deepStrictEqual(Object.keys(messages[0]).sort(), ['error', 'result']);
        assert.strictEqual(messages[0].error, 'boom');
        assert.ok(messages[0].result.includes('403'));

        queryRunnerWorker.terminate();
    });

    it('should serialize a circular error without crashing', async () => {
        const queryRunnerWorker = createWorker();

        const messages: any[] = [];
        let workerError: Error | undefined;
        queryRunnerWorker.on('message', (result) => {
            messages.push(result);
        });
        queryRunnerWorker.on('error', (error) => {
            workerError = error;
        });

        queryRunnerWorker.postMessage("const a = {}; a.self = a; const e = new Error('circ'); e.runtimeError = a; throw e");

        await new Promise((resolve) => setTimeout(resolve, 300));

        assert.strictEqual(messages.length, 1);
        assert.strictEqual(messages[0].error, 'circ');
        assert.ok(typeof messages[0].result === 'string' && messages[0].result.length > 0);
        assert.strictEqual(workerError, undefined);

        queryRunnerWorker.terminate();
    });
});

function createWorker() {
    const siteId = '7da4a102-f6f2-4f77-906f-f745b8599da8';
    return new worker.Worker(
        './dist/queryRunnerWorker.js',
        {
            workerData: { auth: { type: 'APIKey', apiKey: 'none' }, siteId }
        }
    );
}