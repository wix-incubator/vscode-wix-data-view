import { createClient } from '@wix/sdk';
import { items } from '@wix/data';
import { WixCredentialManager } from '../auth/credentialManager';
import { toWixSdkAuth } from '../auth/wixSdkAuth';

export class WixDataItemProvider {
    private readonly wixCredentialManager: WixCredentialManager;

    constructor(wixCredentialManager: WixCredentialManager) {
        this.wixCredentialManager = wixCredentialManager;
    }

    async getItems(collectionId: string): Promise<items.WixDataResult> {
        const wixClient = createClient({
            auth: toWixSdkAuth(
                this.wixCredentialManager.getAuth()!, 
                this.wixCredentialManager.getSiteId()
            ),
            modules: { items }
        });

        const listItemsResponse = await wixClient.items.query(collectionId).find();

        return listItemsResponse;
    }
}
