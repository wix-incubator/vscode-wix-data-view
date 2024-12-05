
export interface CredentialStrategy {
    initialize(): void;
    getApiKey(): string;
    getUserId(): string;
    getSiteId(): string;
    isReady(): boolean;
    onReady(callback: () => void): void;

    updateApiKey(apiKey: string): void;
    updateSiteId(siteId: string): void;
    updateUserId(userId: string): void;
}

export enum AuthSource {
    API_KEY = 'APIKey',
}

interface APIKey {
    type: 'APIKey';
    apiKey: string;
}

interface None {
    type: 'None';
}

export type ExtensionAuth = APIKey | None;

export function isAPIKey(auth: ExtensionAuth): auth is APIKey {
    return auth.type === 'APIKey';
}
