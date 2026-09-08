# Analytics events

Inside the Wix IDE the extension reports host-agnostic analytics events through the Wix IDE Platform bridge (`wixIdePlatform.reportAnalyticsEvent`); the host maps them to its own BI. Outside the Wix IDE the command does not exist and nothing is sent. Analytics may include collection and field identifiers plus failure reasons; no query text, code, or results are sent. Set `vscode-wix-data-view.analytics.enabled` to `false` to disable reporting.

| Event | Data | When |
|---|---|---|
| `panel_opened` | — | Collections view becomes visible |
| `collection_click` | `collectionName`, `collectionId` | a collection row is expanded |
| `add_collection`, `refresh` | — | toolbar buttons |
| `open_collection`, `run_query` | `collectionName`, `collectionId` | collection context menu / inline icon |
| `copy_collection_id`, `manage_in_dashboard`, `add_field` | `collectionName`, `collectionId` | collection context menu / inline icon |
| `copy_field_id`, `update_field`, `delete_field` | `collectionName`, `collectionId`, `fieldName` | field context menu |
| `query_run` | `operation` | Run Query clicked |
| `query_finished` | `operation`, `status` (`success` \| `failure`), optionally `failureReason` | worker result or error |
