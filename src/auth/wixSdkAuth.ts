import { ApiKeyStrategy } from '@wix/sdk';
import { ExtensionAuth, isAPIKey } from './api';


export function toWixSdkAuth(auth: ExtensionAuth, siteId: string) {
    if (isAPIKey(auth)) {
        return ApiKeyStrategy({
            apiKey: auth.apiKey,
            siteId: siteId
        });
    } else {
        console.error('No known authentication provided');
    }
}
