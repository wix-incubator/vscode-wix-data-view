export function parseWixConfig(content: string, configPath: string): { siteId?: string } {
    try {
        return JSON.parse(content) as { siteId?: string };
    } catch {
        throw new Error(`wix.config.json could not be read. Check that the file contains valid JSON. File: ${configPath}`);
    }
}

export function formatCredentialLoadError(_error: unknown): string {
    return 'Unable to read stored credentials. Please reopen VS Code and try again.';
}
