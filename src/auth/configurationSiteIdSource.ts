import * as vscode from 'vscode';

const SITE_ID_CONFIG_KEY = 'wixSiteId';

export class ConfigurationSiteIdSource {
    private readonly context: vscode.ExtensionContext;
    private siteId?: string;
    private ready: boolean = false;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.load();
    }

    private load(): void {
        this.siteId = this.context.globalState.get(SITE_ID_CONFIG_KEY) ?? '';
        this.ready = true;
    }

    public updateSiteId(siteId: string) {
        this.context.globalState.update(SITE_ID_CONFIG_KEY, siteId);
        this.siteId = siteId;
    }

    public getSiteId(): string {
        return this.siteId ?? '';
    }

    public isReady(): boolean {
        return this.ready;
    }
}
