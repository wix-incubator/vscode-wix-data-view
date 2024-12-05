import { parentPort, workerData } from "worker_threads";
import util from 'util';
import { createClient } from '@wix/sdk';
import * as wixDataItemsSdk from '@wix/wix-data-items-sdk';
import { toWixSdkAuth } from "../auth/wixSdkAuth";
import * as wixDataSdk from '@wix/data';


const wixClient = createClient({
  modules: { 
    wixDataItemsSdk,
    collections: wixDataSdk.collections,
    indexes: wixDataSdk.indexes
  },
  auth: toWixSdkAuth(workerData.auth, workerData.siteId)
});

const wixData = wixClient.wixDataItemsSdk;
const collections = wixClient.collections;
const indexes = wixClient.indexes;

const _oldLog = console.log;
const _oldWarn = console.warn;
const _oldError = console.error;

console.log = function (...args: any[]) {
  const formatted = args.map((arg) => util.format(arg)).join(' ');
  _oldLog(formatted);
  parentPort?.postMessage({ log: formatted });
};

console.warn = function (...args: any[]) {
  const formatted = args.map((arg) => util.format(arg)).join(' ');
  _oldWarn(formatted);
  parentPort?.postMessage({ warn: formatted });
};

console.error = function (...args: any[]) {
  const formatted = args.map((arg) => util.format(arg)).join(' ');
  _oldError(formatted);
  parentPort?.postMessage({ error: formatted });
};

parentPort?.on("message", async (query) => {
    // Do the query here
    try {
      const script = query;
      const result = eval(script);

      if (result instanceof Promise) {
        parentPort?.postMessage({ result: JSON.stringify(await result, null, 2) });
      } else {
        parentPort?.postMessage({ result: JSON.stringify(result, null, 2) });
      }
    } catch (e: any) {
      parentPort?.postMessage({ result: JSON.stringify(e, null, 2) });
      parentPort?.postMessage({ error: JSON.stringify(e) });
    }
});
