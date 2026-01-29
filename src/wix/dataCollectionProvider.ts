import * as vscode from 'vscode';
import { createClient } from '@wix/sdk';
import { collections } from '@wix/data';
import { WixCredentialManager } from '../auth/credentialManager';
import { toWixSdkAuth } from '../auth/wixSdkAuth';


export interface WixDataCollectionProvider {
    getCollections(): Promise<collections.DataCollection[]>;
}

export class DefaultWixDataCollectionProvider implements WixDataCollectionProvider {
    constructor(
        private readonly wixCredentialManager: WixCredentialManager, 
        private readonly outputChannel: vscode.OutputChannel
    ) {}

    public async getCollections(): Promise<collections.DataCollection[]> {
        const wixAuthToken = await this.wixCredentialManager.waitForAuth();

        const auth = toWixSdkAuth(
            wixAuthToken, 
            this.wixCredentialManager.getSiteId()
        );

        const wixClient = createClient({
            auth,
            modules: { collections }
        });

        try {
            const listDataCollectionsResponse = await wixClient.collections.listDataCollections({
                paging: {
                    limit: 1000,
                    offset: 0
                }
            });
            return listDataCollectionsResponse.collections ?? [];
        } catch (e) {
            this.outputChannel.appendLine(`Error fetching Wix Data collections: ${e}. Have you configured your API key and site ID?`);
            vscode.window.showErrorMessage(`Error fetching Wix Data collections: ${e}. Have you configured your API key and site ID?`);
            return [];
        }
        
    }
}
