# Wix Data Viewer

This extension lets you view the structure of a Wix site database, as well as run queries against it.

![Wix Data View screenshot](docs/screenshot1.png)

## Configuration

The extension will auto-configure if:
* Wix CLI is installed on the system
* plugin is running in online IDE hosted by Wix

Alternatively, it's possible to manually configure the IDE:
1. Open configuration panel
2. Enter your API Key
3. Enter Site ID

You can open the configuration screen by clicking the gear icon above the collection tree.

![Configure Wix Data View](docs/configuration.png)

Go to your Wix Account Settings and choose API Keys in the left panel.

![API Keys](docs/api-keys.png)

Click Generate API Key and select the following permissions:
* Get Sites List
* Wix Data (from All site permissions section)

Click Generate Key. Use the key in the configuration.

Next, go to the dashboard of a site you want to connect to.

The URL should look similar to:
> https://manage.wix.com/dashboard/ff1e47ad-6562-40cc-9284-07901522f0e1/home

You can copy the Site ID from the URL. In this example the Site ID is ff1e47ad-6562-40cc-9284-07901522f0e1.

## Usage

The Plugin allows calling some of Wix Data APIs. The following APIs are supported:
* [Wix Data Items](https://dev.wix.com/docs/velo/api-reference/wix-data/introduction)
* [Collections](https://dev.wix.com/docs/sdk/backend-modules/data/collections/introduction)
* [Indexes](https://dev.wix.com/docs/sdk/backend-modules/data/indexes/introduction)
* [Backups](https://dev.wix.com/docs/api-reference/business-solutions/cms/operations/backups/introduction)
* [Data Movement Jobs](https://dev.wix.com/docs/api-reference/business-solutions/cms/operations/data-movement-jobs/introduction)

It will run queries like:

```javascript
wixData.query("Items").find()
```

```javascript
collections.listDataCollections()
```

```javascript
indexes.listIndexes('Items')
```

```javascript
backups.listBackups()
```

```javascript
movementJobs.queryJobs({})
```

To run the query, execute 'Wix Data: Write Query' command. This opens the query editor. Execute the query by clicking the triangle icon.

![Run Query](/docs/run-query.png)

## Analytics events

Inside the Wix IDE the extension reports host-agnostic analytics events through the Wix IDE Platform bridge (`wixIdePlatform.reportAnalyticsEvent`); the host maps them to its own BI. Outside the Wix IDE the command does not exist and nothing is sent. `query_run` and `query_finished` include the query text.

| Event | Data | When |
|---|---|---|
| `panel_opened` | — | Collections view becomes visible |
| `collection_click` | `collectionName`, `collectionId` | a collection row is expanded |
| `add_collection`, `refresh` | — | toolbar buttons |
| `open_collection` | `collectionName`, `collectionId` | collection context menu |
| `run_query` | `collectionName`, `collectionId` | inline Run Query icon on a collection row |
| `copy_collection_id`, `manage_in_dashboard`, `add_field` | `collectionName`, `collectionId` | collection context menu / inline icon |
| `copy_field_id`, `update_field`, `delete_field` | + `fieldName` | field context menu |
| `query_run` | `operation`, `query`, `queryLength` | Run Query clicked |
| `query_finished` | + `status` (`success` \| `failure`), `failureReason` | worker result or error |
