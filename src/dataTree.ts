import * as path from 'path';
import * as vscode from 'vscode';
import _ from 'lodash';
import { collections } from '@wix/data';
import { WixDataCollectionProvider } from './wix/dataCollectionProvider';

enum NodeType {
    FIELD = 1,
    COLLECTION = 2,
    NAMESPACE = 3,
};

export class DataCollectionNode {

    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command,
        public readonly children?: DataCollectionNode[],
        public readonly type: NodeType = NodeType.COLLECTION,
        public readonly collection?: collections.DataCollection,
        public readonly field?: collections.Field
    ) {}
}

function determineCollectionNamespace(collection: collections.DataCollection): string {
    return collection.displayNamespace 
        ?? (collection._id?.includes('/') ? collection._id?.split('/')[0] : undefined)
        ?? 'NATIVE';
}

function fieldNodes(collection: collections.DataCollection): DataCollectionNode[] {
    const sortedFields = _.sortBy(collection.fields, f => f.key);
    return sortedFields.map((field: collections.Field) => 
        new DataCollectionNode(
            `${field.key}: ${field.type} ('${field.displayName}')`, 
            vscode.TreeItemCollapsibleState.None,
            undefined,
            undefined,
            NodeType.FIELD,
            undefined,
            field
        )
    );
}

export class DataCollectionTree implements vscode.TreeDataProvider<DataCollectionNode> {
    private readonly _onDidChangeTreeData: vscode.EventEmitter<DataCollectionNode[] | undefined> = new vscode.EventEmitter<DataCollectionNode[] | undefined>();
    private readonly dataSchemaProvider: WixDataCollectionProvider;
    private dataCollectionTree: DataCollectionNode[] = [];

    constructor(dataSchemaProvider: WixDataCollectionProvider) {
        this.dataSchemaProvider = dataSchemaProvider;
    }

    public async refresh(): Promise<void> {
        try {
            const dataCollections = await this.dataSchemaProvider.getCollections();

            const collectionsByNamespace = _.groupBy(dataCollections, determineCollectionNamespace);
            
            const nativeCollections = (collectionsByNamespace['NATIVE']??[]).map((collection: collections.DataCollection) => 
                new DataCollectionNode(
                    collection.displayName ?? '<UNNAMED>', 
                    vscode.TreeItemCollapsibleState.Collapsed, 
                    this.collectionCommand(collection), 
                    fieldNodes(collection),
                    NodeType.COLLECTION,
                    collection
                )
            );

            const driverCollections = _.map(_.toPairs(collectionsByNamespace).filter(([key, c]) => key !== 'NATIVE'), ([key, value]) => 
                new DataCollectionNode(
                    key, 
                    vscode.TreeItemCollapsibleState.Collapsed, 
                    undefined, 
                    value.map((collection: collections.DataCollection) =>
                        new DataCollectionNode(
                            collection.displayName ?? '<UNNAMED>', 
                            vscode.TreeItemCollapsibleState.Collapsed, 
                            this.collectionCommand(collection),
                            fieldNodes(collection),
                            NodeType.COLLECTION,
                            collection
                        )
                    ),
                    NodeType.NAMESPACE
                )
            );

            this.dataCollectionTree = [
                ...nativeCollections,
                ...driverCollections,
            ];

            this._onDidChangeTreeData.fire(undefined);
        } catch (e: any) {
            if (e.details?.applicationError?.code === 403) {
                vscode.window.showErrorMessage(`Failed to list Wix Data collections. Did you set your API key and chose the right site?`);
            } else {
                vscode.window.showErrorMessage(`Failed to list Wix Data collections. ${e.message.message ?? e.message}`);
            }
        }
    }

    onDidChangeTreeData?: vscode.Event<void | DataCollectionNode | DataCollectionNode[] | null | undefined> = this._onDidChangeTreeData.event;

    getTreeItem(element: DataCollectionNode): vscode.TreeItem | Thenable<vscode.TreeItem> {
        const treeItem = new vscode.TreeItem(element.label, element.collapsibleState);
        
        switch (element.type) {
            case NodeType.COLLECTION:
                treeItem.iconPath = iconPath('collections.svg');
                treeItem.contextValue = 'collection';
                treeItem.tooltip = element.collection?._id;
                break;
            case NodeType.FIELD:
                treeItem.iconPath = this.determineFieldIcon(element.field);
                treeItem.contextValue = 'field';
                treeItem.tooltip = element.field?.key;
                break;
            case NodeType.NAMESPACE:
                treeItem.iconPath = new vscode.ThemeIcon('database');
                treeItem.contextValue = 'namespace';
                break;
        }
        return treeItem;
    }

    getChildren(element?: DataCollectionNode | undefined): vscode.ProviderResult<DataCollectionNode[]> {
        if (element === undefined) {
            return this.dataCollectionTree;
        } else {
            return element.children;
        }
    }
    
    collectionCommand(collection: collections.DataCollection): vscode.Command {
        return {
            command: 'vscode-wix-data-view.open-collection',
            title: 'Open Collection',
            arguments: [collection],
        };
    }

    determineFieldIcon(element?: collections.Field): { light: string; dark: string } {
        if (element === undefined) {
            return iconPath("ic-type-unsupported.svg");
        }

        switch(element.type) {
            case collections.Type.TEXT:
                return iconPath("ic-type-text.svg");
            case collections.Type.NUMBER:
                return iconPath("ic-type-number.svg");
            case collections.Type.BOOLEAN:
                return iconPath("ic-type-boolean.svg");
            case collections.Type.DATE:
            case collections.Type.DATETIME:            
                return iconPath("ic-type-calendar.svg");
            case collections.Type.TIME:
            case collections.Type.LEGACY_TIME:
                return iconPath("ic-type-time.svg");
            case collections.Type.IMAGE:
            case collections.Type.LEGACY_IMAGE:
                return iconPath("ic-type-image.svg");
            case collections.Type.DOCUMENT:
                return iconPath("ic-type-document.svg");
            case collections.Type.RICH_TEXT:
                return iconPath("ic-type-rich-text.svg");
            case collections.Type.RICH_CONTENT:
                return iconPath("ic-type-rich-content.svg");
            case collections.Type.URL:
            case collections.Type.PAGE_LINK:
            case collections.Type.LEGACY_EXTERNAL_URL:
                return iconPath("ic-type-url.svg");
            case collections.Type.ARRAY_DOCUMENT:
                return iconPath("ic-type-document-array.svg");
            case collections.Type.ARRAY_STRING:
                return iconPath("ic-type-tags.svg");
            case collections.Type.REFERENCE:
                return iconPath("ic-type-reference.svg");
            case collections.Type.MULTI_REFERENCE:
                return iconPath("ic-type-reference-multi.svg");
            case collections.Type.ARRAY:
                return iconPath("ic-type-array.svg");
            case collections.Type.OBJECT:
                return iconPath("ic-type-object.svg");
            case collections.Type.AUDIO:
                return iconPath("ic-type-audio.svg");
            case collections.Type.LEGACY_EXTERNAL_VIDEO:
            case collections.Type.VIDEO:
                return iconPath("ic-type-video.svg");
            case collections.Type.LEGACY_COLOR:
                return iconPath("ic-type-color.svg");
            case collections.Type.MEDIA_GALLERY:
                return iconPath("ic-type-media-gallery.svg");
        }
        return iconPath("ic-type-unsupported.svg");
    }

    copyId(node: DataCollectionNode): void {
        vscode.env.clipboard.writeText(node.collection?._id ?? node.field?.key ?? '');
    }
}

const iconPath = (fileName: string) => ({
    light: path.join(__filename, '..', '..', 'assets', 'light', fileName),
    dark: path.join(__filename, '..', '..', 'assets', 'dark', fileName),
});
