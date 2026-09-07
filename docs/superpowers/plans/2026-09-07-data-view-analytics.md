# Wix Data View Analytics Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit one analytics event per observable Wix Data View trigger through the Wix IDE bridge command `wixIdePlatform.reportAnalyticsEvent`, as `{ extension: 'vscode-wix-data-view', event, data }`, so Studio 2 can map them to BI (src 79 evids 545 and 336). Silent no-op outside the Wix IDE.

**Architecture:** `src/analytics.ts` holds a reporter that wraps the bridge command with swallow-and-warn, plus a pure `queryOperationFromPath` helper. `activate` creates the reporter and calls it at each command handler; the `TreeView` returned by `createTreeView` is kept so `onDidChangeVisibility` → `panel_opened` and `onDidExpandElement` → `collection_click`. `runQuery` reports `query_run` and `query_finished` around the worker.

**Tech Stack:** TypeScript (tabs in `src/extension.ts`; four spaces in `src/queryEditor.ts`, `src/dataTree.ts`; single quotes; semicolons), VS Code extension API, webpack, mocha + `assert` with the repo's `Module.prototype.require` stub for `vscode`.

**Spec:** `docs/superpowers/specs/2026-09-07-data-view-analytics-design.md`

---

## Before you start

- Branch `analytics-events` in `/Users/nirsh/vscode-wix-data-view`. All commands run from the repo root.
- `yarn install` once if `node_modules` is missing (Node 20 works; `.nvmrc` may say otherwise).
- Unit tests: `yarn test-unit` (mocha, `test/**/*.spec.ts`, ts-node). Type check: `yarn compile-tests` (tsc to `out/`). Bundle: `yarn compile` (webpack). Do not run `yarn test` / `test-extension`; it downloads VS Code.
- Event names and the command id are inline string literals. No new npm dependencies.
- Commit messages: Conventional Commits, plain English.

## File structure

| File | Responsibility |
|---|---|
| `src/analytics.ts` (create) | `createAnalyticsReporter(context)`, `AnalyticsData`, `AnalyticsReporter`, `queryOperationFromPath(path)` |
| `test/unit/analytics.spec.ts` (create) | reporter + operation helper tests |
| `src/extension.ts` (modify) | reporter creation; tree-view events; per-command reports |
| `src/queryEditor.ts` (modify) | `runQuery` reports `query_run` / `query_finished` |
| `readme.md`, `README.md`, `changelog.md`, `CHANGELOG.md` (modify) | docs |

---

### Task 1: Reporter and operation helper

**Files:**
- Create: `src/analytics.ts`
- Test: `test/unit/analytics.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import assert from 'assert';
import Module from 'module';

type ExecuteCommand = (command: string, ...args: unknown[]) => Promise<unknown>;

function loadAnalyticsWithVscodeStub(executeCommand: ExecuteCommand) {
    const modulePrototype = Module.prototype as any;
    const originalRequire = modulePrototype.require;
    modulePrototype.require = function (request: string) {
        if (request === 'vscode') {
            return { commands: { executeCommand } };
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

    it('swallows a rejected command and warns', async () => {
        const warnings: unknown[][] = [];
        const originalWarn = console.warn;
        console.warn = (...args: unknown[]) => {
            warnings.push(args);
        };
        try {
            const { createAnalyticsReporter } = loadAnalyticsWithVscodeStub(async () => {
                throw new Error("command 'wixIdePlatform.reportAnalyticsEvent' not found");
            });

            assert.doesNotThrow(() => createAnalyticsReporter(context)('refresh'));
            await new Promise<void>((resolve) => setImmediate(resolve));

            assert.equal(warnings.length, 1);
            assert.equal(warnings[0][0], '[vscode-wix-data-view] analytics event "refresh" not reported:');
        } finally {
            console.warn = originalWarn;
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `yarn test-unit`
Expected: FAIL — `Cannot find module '../../src/analytics'`.

- [ ] **Step 3: Implement**

```ts
import * as vscode from 'vscode';

export type AnalyticsData = Record<string, string | number | boolean | null | undefined>;
export type AnalyticsReporter = (event: string, data?: AnalyticsData) => void;

/**
 * Reports an analytics event through the Wix IDE Platform bridge. The bridge
 * derives the `extension` field from `context.extension`; the host (Studio 2)
 * maps `{ extension, event, data }` to its own BI events. Outside the Wix IDE
 * the command does not exist and the event is skipped — this extension must
 * keep working in plain VS Code.
 */
export function createAnalyticsReporter(context: vscode.ExtensionContext): AnalyticsReporter {
    return (event, data) => {
        Promise.resolve(
            vscode.commands.executeCommand('wixIdePlatform.reportAnalyticsEvent', context.extension, event, data)
        ).catch((error: unknown) => {
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `yarn test-unit`
Expected: PASS, including the pre-existing suites.

- [ ] **Step 5: Commit**

```bash
git add src/analytics.ts test/unit/analytics.spec.ts
git commit -m "feat: add analytics reporter over the Wix IDE bridge command"
```

---

### Task 2: Tree and command events in `activate`

**Files:**
- Modify: `src/extension.ts`

No unit harness for `activate` (it needs the real `vscode` module); the change is one call per handler. Type check with `yarn compile-tests`, bundle with `yarn compile`.

- [ ] **Step 1: Import and create the reporter**

After the `queryWorkspace` import:

```ts
import { createAnalyticsReporter } from './analytics';
```

In `activate`, right after `context.subscriptions.push(outputChannel);`:

```ts
	const reportAnalytics = createAnalyticsReporter(context);
```

- [ ] **Step 2: Keep the tree view and report visibility and expansion**

Replace the `createTreeView` push with:

```ts
	const treeView = vscode.window.createTreeView('vscode-wix-data-view.collection-tree', {
		treeDataProvider: dataCollectionTree,
		showCollapseAll: true,
	});
	context.subscriptions.push(treeView);

	const reportPanelOpened = () => {
		if (treeView.visible) reportAnalytics('panel_opened');
	};
	reportPanelOpened();
	context.subscriptions.push(treeView.onDidChangeVisibility(reportPanelOpened));

	context.subscriptions.push(treeView.onDidExpandElement(({ element }) => {
		if (element.type === NodeType.COLLECTION) {
			reportAnalytics('collection_click', collectionData(element));
		}
	}));
```

Add `NodeType` to the import from `./dataTree` (`import { DataCollectionNode, DataCollectionTree, NodeType } from './dataTree';` — confirm `NodeType` is exported there; if it is not, export it). Add these two helpers above `activate`, next to `reportError`:

```ts
function collectionData(node?: DataCollectionNode) {
	return {
		collectionName: node?.collection?.displayName ?? node?.collection?._id,
		collectionId: node?.collection?._id,
	};
}

function fieldData(node?: DataCollectionNode) {
	return { ...collectionData(node), fieldName: node?.field?.key };
}
```

- [ ] **Step 3: Report at each command handler**

First statement inside each handler:

| command | first line |
|---|---|
| `refresh-collections` | `reportAnalytics('refresh');` |
| `open-collection` | `reportAnalytics('open_collection', collectionData(node));` |
| `create-collection` | `reportAnalytics('add_collection');` |
| `add-field` | `reportAnalytics('add_field', collectionData(node));` |
| `update-field` | `reportAnalytics('update_field', fieldData(node));` |
| `delete-field` | `reportAnalytics('delete_field', fieldData(node));` |
| `copy-collection-id` | `reportAnalytics('copy_collection_id', collectionData(node));` |
| `copy-field-id` | `reportAnalytics('copy_field_id', fieldData(node));` |
| `manage-in-dashboard` | `reportAnalytics('manage_in_dashboard', collectionData(node));` |

`configure-credentials`, `new-query` and `run-query` get no report here (`run-query` reports inside `runQuery`, Task 3).

- [ ] **Step 4: Type check and bundle**

Run: `yarn compile-tests && yarn compile`
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add src/extension.ts src/dataTree.ts
git commit -m "feat: report Data View tree and command analytics events"
```

---

### Task 3: Query run events

**Files:**
- Modify: `src/queryEditor.ts` (`runQuery`, ~line 145)

- [ ] **Step 1: Thread the reporter in**

Change the signature and import:

```ts
import { queryOperationFromPath, type AnalyticsReporter } from './analytics';

export async function runQuery(
    context: vscode.ExtensionContext,
    credentialManager: WixCredentialManager,
    outputChannel: vscode.OutputChannel,
    reportAnalytics: AnalyticsReporter
) {
```

Update the caller in `src/extension.ts` (`run-query` handler): `await runQuery(context, credentialManager, outputChannel, reportAnalytics);`.

- [ ] **Step 2: Report around the worker**

After `const query = editor.document.getText();`:

```ts
    const queryInfo = {
        operation: queryOperationFromPath(editor.document.uri.path),
        queryLength: query.length,
    };
    reportAnalytics('query_run', queryInfo);
```

In the `message` handler, inside the `result.result` branch before `showResult`:

```ts
            reportAnalytics('query_finished', { ...queryInfo, status: 'success' });
```

and inside the `result.error` branch before the `outputChannel.appendLine`:

```ts
            reportAnalytics('query_finished', { ...queryInfo, status: 'failure', failureReason: String(result.error) });
```

- [ ] **Step 3: Type check and bundle**

Run: `yarn compile-tests && yarn compile && yarn test-unit`
Expected: all succeed.

- [ ] **Step 4: Commit**

```bash
git add src/queryEditor.ts src/extension.ts
git commit -m "feat: report query run and finish analytics events"
```

---

### Task 4: Docs

**Files:**
- Modify: `readme.md`, `README.md` (identical content — apply the same edit to both), `changelog.md`, `CHANGELOG.md` (same)

- [ ] **Step 1: README section** (append at the end of both files):

````markdown
## Analytics events

Inside the Wix IDE the extension reports host-agnostic analytics events through the Wix IDE Platform bridge (`wixIdePlatform.reportAnalyticsEvent`); the host maps them to its own BI. Outside the Wix IDE the command does not exist and nothing is sent. No query text leaves the editor — only its length and the operation it was opened for.

| Event | Data | When |
|---|---|---|
| `panel_opened` | — | Collections view becomes visible |
| `collection_click` | `collectionName`, `collectionId` | a collection row is expanded |
| `add_collection`, `refresh` | — | toolbar buttons |
| `open_collection`, `copy_collection_id`, `manage_in_dashboard`, `add_field` | `collectionName`, `collectionId` | collection context menu / inline icon |
| `copy_field_id`, `update_field`, `delete_field` | + `fieldName` | field context menu |
| `query_run` | `operation`, `queryLength` | Run Query clicked |
| `query_finished` | + `status` (`success` \| `failure`), `failureReason` | worker result or error |
````

- [ ] **Step 2: Changelog** — add at the end of both changelog files:

```markdown
## [0.0.11]
- Report analytics events to the Wix IDE Platform bridge when running inside the Wix IDE
```

(Do not bump `package.json` version; release process owns that.)

- [ ] **Step 3: Commit**

```bash
git add readme.md README.md changelog.md CHANGELOG.md
git commit -m "docs: describe analytics events"
```

---

### Task 5: Manual verification

- [ ] Plain VS Code (F5 / Extension Development Host): open the Wix Data view, expand a collection, run a query. No user-visible errors; the Debug Console shows `analytics event "…" not reported` warnings once per event.
- [ ] Wix IDE playground (`wix-ide-platform`): install this build into the container's extensions dir in place of `wix.vscode-wix-data-view-0.0.10`, reload, and walk the toolbar, a collection expand, each context-menu item and a query run; rows appear in the "Analytics Events" panel with `extension: vscode-wix-data-view`.

---

## Self-review

**Spec coverage**: reporter + `operation` helper → Task 1; `panel_opened`, `collection_click`, all nine command events → Task 2; `query_run` / `query_finished` → Task 3; docs → Task 4; manual → Task 5.

**Placeholders**: none. Task 2 has one verify-then-act instruction (`NodeType` export).

**Type consistency**: `AnalyticsReporter` / `AnalyticsData` / `queryOperationFromPath` from Task 1 used in Tasks 2–3; `collectionData` / `fieldData` defined and used in Task 2; `runQuery` signature change in Task 3 matched by the `extension.ts` call site.
