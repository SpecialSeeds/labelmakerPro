class InventoryDatabase {
    constructor() {
        this.inventoryRef = db.collection('inventory');
        this.expiredRef = db.collection('expired_recalled');
    }

    async addInventoryItem(item) {
        try {
            const docRef = await this.inventoryRef.add({
                ...item,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            return { id: docRef.id, ...item };
        } catch (error) {
            console.error('Error adding inventory item:', error);
            throw error;
        }
    }

    async getAllInventory(limit = 10, startAfter = null) {
        try {
            let query = this.inventoryRef
                .orderBy('brandName')
                .limit(limit);

            if (startAfter) {
                query = query.startAfter(startAfter);
            }

            const snapshot = await query.get();
            return snapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data(),
                docRef: doc  // Store doc reference for pagination
            }));
        } catch (error) {
            console.error('Error getting inventory:', error);
            return [];
        }
    }

    async getExpiredItems(limit = 10, startAfter = null) {
        try {
            const currentDate = new Date();
            currentDate.setHours(0, 0, 0, 0);
            const currentDateStr = currentDate.toISOString().split('T')[0];

            let query = this.inventoryRef
                .where('expiration', '<=', currentDateStr)
                .orderBy('expiration')
                .limit(limit);

            if (startAfter) {
                query = query.startAfter(startAfter);
            }

            const snapshot = await query.get();

            const recalledQuery = this.expiredRef
                .orderBy('createdAt', 'desc')
                .limit(limit);

            const recalledSnapshot = await recalledQuery.get();

            const expiredItems = snapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data(),
                type: 'expired',
                docRef: doc
            }));

            const recalledItems = recalledSnapshot.docs.map(doc => ({ 
                id: doc.id, 
                ...doc.data(),
                type: 'recalled',
                docRef: doc
            }));

            return [...expiredItems, ...recalledItems];
        } catch (error) {
            console.error('Error getting expired items:', error);
            return [];
        }
    }


    async updateInventoryItem(id, updates) {
        try {
            await this.inventoryRef.doc(id).update({
                ...updates,
                updatedAt: new Date().toISOString()
            });
            return true;
        } catch (error) {
            console.error('Error updating inventory item:', error);
            throw error;
        }
    }


    async deleteInventoryItem(id) {
        try {
            await this.inventoryRef.doc(id).delete();
            return true;
        } catch (error) {
            console.error('Error deleting inventory item:', error);
            throw error;
        }
    }


    async reportExpiredRecalled(item) {
        try {
            const docRef = await this.expiredRef.add({
                ...item,
                reportedAt: new Date().toISOString(),
                status: 'reported'
            });
            return { id: docRef.id, ...item };
        } catch (error) {
            console.error('Error reporting expired/recalled item:', error);
            throw error;
        }
    }

    // Search inventory
    async searchInventory(searchTerm) {
        try {
            const snapshot = await this.inventoryRef.get();
            const allItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            return allItems.filter(item => 
                item.brandName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.genericName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.ndc.includes(searchTerm)
            );
        } catch (error) {
            console.error('Error searching inventory:', error);
            return [];
        }
    }
}


const inventoryDB = new InventoryDatabase();


let currentInventoryItems = [];
let currentExpiredItems = [];
let lastInventoryDoc = null;
let lastExpiredDoc = null;

window.addEventListener('DOMContentLoaded', async () => {
    await loadInventoryData();
    await loadExpiredData();
});

async function loadInventoryData(loadMore = false) {
    const loadingElement = document.getElementById('inventory-loading');
    const contentElement = document.getElementById('inventory-content');
    const noDataElement = document.getElementById('inventory-no-data');
    
    if (!loadMore) {
        loadingElement.style.display = 'block';
        contentElement.style.display = 'none';
        noDataElement.style.display = 'none';
        currentInventoryItems = [];
        lastInventoryDoc = null;
    }

    try {
        const items = await inventoryDB.getAllInventory(10, lastInventoryDoc);
        
        if (!loadMore) {
            currentInventoryItems = items;
        } else {
            currentInventoryItems = [...currentInventoryItems, ...items];
        }

        if (items.length > 0) {
            lastInventoryDoc = items[items.length - 1].docRef;
        }

        displayInventoryItems();
        
        loadingElement.style.display = 'none';
        if (currentInventoryItems.length === 0) {
            noDataElement.style.display = 'block';
        } else {
            contentElement.style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading inventory:', error);
        loadingElement.style.display = 'none';
        noDataElement.style.display = 'block';
    }
}

// Load expired items
async function loadExpiredData(loadMore = false) {
    const loadingElement = document.getElementById('expired-loading');
    const contentElement = document.getElementById('expired-content');
    const noDataElement = document.getElementById('expired-no-data');
    
    if (!loadMore) {
        loadingElement.style.display = 'block';
        contentElement.style.display = 'none';
        noDataElement.style.display = 'none';
        currentExpiredItems = [];
        lastExpiredDoc = null;
    }

    try {
        const items = await inventoryDB.getExpiredItems(10, lastExpiredDoc);
        
        if (!loadMore) {
            currentExpiredItems = items;
        } else {
            currentExpiredItems = [...currentExpiredItems, ...items];
        }

        if (items.length > 0) {
            lastExpiredDoc = items[items.length - 1].docRef;
        }

        displayExpiredItems();
        
        loadingElement.style.display = 'none';
        if (currentExpiredItems.length === 0) {
            noDataElement.style.display = 'block';
        } else {
            contentElement.style.display = 'block';
        }
    } catch (error) {
        console.error('Error loading expired items:', error);
        loadingElement.style.display = 'none';
        noDataElement.style.display = 'block';
    }
}

function displayInventoryItems() {
    const tableBody = document.getElementById('inventory-table-body');
    tableBody.innerHTML = '';

    currentInventoryItems.forEach(item => {
        const row = document.createElement('tr');
        
        // Determine stock status
        let stockClass = '';
        if (item.amount === 0) {
            stockClass = 'out-of-stock';
        } else if (item.amount < item.parLevel) {
            stockClass = 'low-stock';
        }

        const currentDate = new Date().toISOString().split('T')[0];
        const isExpired = item.expiration <= currentDate;

        row.className = stockClass;
        row.innerHTML = `
            <td class="${isExpired ? 'expired-item' : ''}">${item.brandName || ''}</td>
            <td class="${isExpired ? 'expired-item' : ''}">${item.genericName || ''}</td>
            <td>${item.shelfNumber || ''}</td>
            <td>${item.ndc || ''}</td>
            <td>${item.amount || 0}</td>
            <td>${item.parLevel || 0}</td>
            <td class="${isExpired ? 'expired-item' : ''}">${formatDate(item.expiration)}</td>
            <td>
                <span class="action-icon edit-icon" onclick="editInventoryItem('${item.id}')" title="Edit">✏️</span>
                <span class="action-icon delete-icon" onclick="deleteInventoryItem('${item.id}')" title="Delete">🗑️</span>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function displayExpiredItems() {
    const tableBody = document.getElementById('expired-table-body');
    tableBody.innerHTML = '';

    currentExpiredItems.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="expired-item">${item.brandName || ''}</td>
            <td>${item.shelfNumber || ''}</td>
            <td>${item.ndc || ''}</td>
            <td>${item.lot || ''}</td>
            <td class="expired-item">${formatDate(item.expiration)}</td>
            <td>
                <span class="action-icon delete-icon" onclick="removeExpiredItem('${item.id}', '${item.type}')" title="Remove">🗑️</span>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// Helper functions
function formatDate(dateString) {
    if (!dateString) return '';
    try {
        return new Date(dateString).toLocaleDateString('en-US');
    } catch (error) {
        return dateString;
    }
}

// Action functions
async function editInventoryItem(id) {
    window.location.href = `add-stock.html?edit=${id}`;
}

async function deleteInventoryItem(id) {
    if (confirm('Are you sure you want to delete this inventory item?')) {
        try {
            await inventoryDB.deleteInventoryItem(id);
            await loadInventoryData(); 
            alert('Item deleted successfully');
        } catch (error) {
            console.error('Error deleting item:', error);
            alert('Error deleting item: ' + error.message);
        }
    }
}

async function removeExpiredItem(id, type) {
    if (confirm('Are you sure you want to remove this expired/recalled item?')) {
        try {
            if (type === 'recalled') {
                await inventoryDB.expiredRef.doc(id).delete();
            } else {

                await inventoryDB.deleteInventoryItem(id);
            }
            await loadExpiredData(); 
            alert('Item removed successfully');
        } catch (error) {
            console.error('Error removing item:', error);
            alert('Error removing item: ' + error.message);
        }
    }
}

async function loadMoreInventory() {
    await loadInventoryData(true);
}

async function loadMoreExpired() {
    await loadExpiredData(true);
}

// Refresh inventory
async function refreshInventory() {
    await loadInventoryData();
    await loadExpiredData();
}