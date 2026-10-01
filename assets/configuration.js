(function () {
    const vscode = acquireVsCodeApi();
    const apiKeyForm = document.getElementById('apiKeyForm');
    const siteIdForm = document.getElementById('siteIdForm');

    apiKeyForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const apiKey = document.getElementById('apiKey').value;
        vscode.postMessage({
            command: 'saveApiKey',
            apiKey,
        });
    });

    siteIdForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const siteId = document.getElementById('siteId').value;
        vscode.postMessage({
            command: 'saveSiteId',
            siteId,
        });
    });
})();

