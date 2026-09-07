# Wix Data View analytics events — design

**Date:** 2026-09-07
**Author:** Nir Sharav
**Status:** Draft
**Depends on:** Wix IDE Platform PR #246 (bridge command `wixIdePlatform.reportAnalyticsEvent`, merged 2026-09-06)

## Problem

The Studio 2 Wix Data View BI plan (`bo.wix.com/stash/wix-data-view`, Figma 8, src 79 + src 83) defines the BI coverage for this extension's sidebar: entrance, toolbar, collection and field context menus, the query runner, and the CMS-affecting operations. The extension emits nothing today.

Inside the Wix IDE, extensions cannot send BI. They emit host-agnostic **analytics events** through the bridge extension's command; the host (Studio 2) maps `{ extension, event, data }` to BI. This extension also ships to the public marketplace and runs in plain VS Code, where the bridge does not exist, so every emission must be a silent no-op there.

## Goal

Emit one analytics event per trigger the extension can observe, with `extension: 'vscode-wix-data-view'` (derived by the bridge from `package.json` `name`) and `data` keys named after the BI plan fields, so Studio 2 can map them to evids 545 and 336. No BI knowledge in the extension. Zero behavior change outside the Wix IDE.

## Where the BI plan and this extension differ

The plan describes CMS dialogs; this extension has none. Add Field / Update Field / Delete Field / Create Collection open a **query editor pre-filled with an SDK call** (`collections.createDataCollectionField(...)` etc.) that the user runs with Run Query. "Open Collection" opens a query editor with `wixData.query('<id>').find()`, not the CMS collection view. Consequences:

- **CMS-owned events (83:103, 83:362, 83:300, 83:101, 83:55)** are not fired by this extension: there is no CMS dialog to pass `origin=data_view_panel` into. The closest signal is the query run outcome (below), which carries the `operation` the query file was opened for. Studio may derive completion from `query_finished` with `status=success` or leave those evids to the CMS surfaces.
- **`open_collection` vs `run_query`**: the context-menu "Open Collection" and the inline row icon are the same command (`vscode-wix-data-view.open-collection`), so they cannot be told apart. One event, `open_collection`, covers both. Splitting them needs a second command id in the manifest (not done; see Non-goals).
- **`collapse_all`** is VS Code's built-in view action (`showCollapseAll: true`); there is no hook. Not emitted.
- **79:536** activity-bar click is a workbench event. The extension emits `panel_opened` on tree-view visibility as the adjacent signal.
- **79:336 `query_json`**: the plan wants the full query. The query is the user's code in an editor and can hold secrets; the extension sends `queryLength` and the derived `operation` instead of the code. If Studio needs the text, that is a deliberate opt-in change.

## Event catalogue

All with `extension: 'vscode-wix-data-view'`. `collectionName` is the collection's `displayName` (falls back to `_id`); `collectionId` is `_id`; `fieldName` is the field `key`.

| `event` | `data` | Fires when | Where | BI |
|---|---|---|---|---|
| `panel_opened` | — | Collections tree view becomes visible | `treeView.onDidChangeVisibility` + initial | 536 adjacent |
| `collection_click` | `collectionName`, `collectionId` | a collection row is expanded | `treeView.onDidExpandElement` (collection nodes only) | 545 `collection_click` |
| `add_collection` | — | toolbar "+" (Create Collection) | command `create-collection` | 545 `add_collection` |
| `refresh` | — | toolbar Refresh | command `refresh-collections` | 545 `refresh` |
| `copy_collection_id` | `collectionName`, `collectionId` | context menu | command `copy-collection-id` | 545 |
| `open_collection` | `collectionName`, `collectionId` | context menu "Open Collection" or inline icon | command `open-collection` | 545 `open_collection` / `run_query` |
| `manage_in_dashboard` | `collectionName`, `collectionId` | context menu | command `manage-in-dashboard` | 545 |
| `add_field` | `collectionName`, `collectionId` | context menu (opens the SDK editor) | command `add-field` | 545 `add_field` |
| `copy_field_id` | `collectionName`, `collectionId`, `fieldName` | field context menu | command `copy-field-id` | 545 |
| `update_field` | `collectionName`, `collectionId`, `fieldName` | field context menu | command `update-field` | 545 |
| `delete_field` | `collectionName`, `collectionId`, `fieldName` | field context menu | command `delete-field` | 545 `delete_field` |
| `query_run` | `operation`, `queryLength` | Run clicked in the query runner | `runQuery` start | 336 `action=run` |
| `query_finished` | `operation`, `queryLength`, `status` (`success` \| `failure`), `failureReason?` | worker returns a result or an error | `runQuery` worker `message` | 336 `action=finish` |

`operation` is derived from the query document's file name prefix (`query.<rand>.wdq.js`, `create-collection.…`, `add-field.…`, `update-field.…`, `delete-field.…`): one of `query`, `create_collection`, `add_field`, `update_field`, `delete_field`, or `unknown` for other documents.

## Decisions

- **Reporter** `src/analytics.ts`: `createAnalyticsReporter(context)` → `(event, data?) => void`, calls `vscode.commands.executeCommand('wixIdePlatform.reportAnalyticsEvent', context.extension, event, data)` and swallows rejections with a `console.warn`. No dependency on any Wix IDE package; the command id is a string literal. Same shape as the CLI extension's reporter in `wix-ide-platform`.
- **Report at the command handler**, before the action runs, so cancelled or failing actions still count as intent (matches the plan's "records the intent" wording).
- **Tree events via `TreeView`**, not the provider: `createTreeView` returns the view; the extension keeps it to subscribe to `onDidChangeVisibility` and `onDidExpandElement`.
- **No new commands or manifest changes** (see `open_collection` above). Keeps the marketplace package identical for non-Wix users.
- **Code style**: mirror each file (tabs in `extension.ts`, four spaces in `dataTree.ts` / `queryEditor.ts`; single quotes; semicolons). Event names are inline string literals.

## Non-goals

- Firing CMS-owned src 83 events or passing `origin` into CMS dialogs (no dialogs exist).
- Distinguishing inline "View Collection" from the context-menu entry.
- `collapse_all`.
- Sending the query text.
- The Studio 2 mapping (`onAnalyticsEvent` → `studio2DataViewInteractionSrc79Evid545` / `runDataQueryViaCodeSrc79Evid336`), which lives in the Studio 2 repo.

## Error handling

The reporter never throws or rejects into extension code. Outside the Wix IDE the command is missing and the promise rejects; the reporter warns once per event to the console and continues. Inside the Wix IDE a malformed payload is rejected by the bridge and logged in its output channel.

## Testing

Unit tests use the repo's mocha + `assert` setup with the existing `Module.prototype.require` stub for `vscode` (see `test/unit/credentialSources.spec.ts`).

- `test/unit/analytics.spec.ts`: reporter passes `(command id, context.extension, event, data)` to `executeCommand`; undefined `data` passed through; rejected command is swallowed and warned.
- `test/unit/queryOperation.spec.ts`: `queryOperationFromPath` maps each prefix, ignores the random suffix and directories, returns `unknown` otherwise.
- Manual: in the Wix IDE playground, walk the toolbar, a collection expand, each context-menu item, and a query run; events appear in the playground's Analytics Events panel. In plain VS Code (F5): no errors, console warns "not reported".

## Documentation

`readme.md` (mirrored to `README.md`, both exist): section "Analytics events" with the catalogue and the sentence that events are only delivered inside the Wix IDE. `changelog.md` / `CHANGELOG.md`: entry under a new `[0.0.11]` heading.
