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