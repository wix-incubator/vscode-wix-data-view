(function () {
    const vscode = acquireVsCodeApi();
    const collectionView = document.getElementById('collection-view');

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.command) {
            case 'updateCollectionView':
                const { items, schema } = message;
                
                collectionView.innerHTML = '';
                items.forEach(item => {
                    const collectionElement = document.createElement('div');
                    collectionElement.classList.add('collection-item');
                    collectionElement.innerHTML = 
                        "<div>" + item._id + "</div><div>" + item.data[schema.displayField] + "</div>";
                    const itemJsonElement = document.createElement('pre');
                    itemJsonElement.innerText = JSON.stringify(item.data, null, 2);
                    collectionElement.appendChild(itemJsonElement);
                    collectionView.appendChild(collectionElement);
                    
                    collectionElement.addEventListener('click', () => {
                        itemJsonElement.style.display = itemJsonElement.style.display === 'none' 
                        ? 'block' 
                        : 'none';
                    });
                });
                break;
        }
    });
})();