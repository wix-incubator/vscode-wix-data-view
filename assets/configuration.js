(function () {
    const vscode = acquireVsCodeApi();
    const saveButton = document.getElementById('save');

    saveButton.addEventListener('click', () => {
        const apiKey = document.getElementById('apiKey').value;
        const siteId = document.getElementById('siteId').value;
        vscode.postMessage({
            command: 'saveConfiguration',
            apiKey, 
            siteId
        });
    });
})();


