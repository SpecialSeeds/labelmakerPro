// Inventory database management
class InventoryDatabase {
    constructor() {
        this.inventoryRef = db.collection('inventory');
        this.expiredRef = db.collection('expired_recalled');
    }

    // Add new inventory item
    async addInventoryItem(item) {
        try {
            console.log('Attempting to add inventory item:', item);
            
            // Validate required fields
            const requiredFields = ['brandName', 'genericName', 'ndc', 'shelfNumber'];
            const missingFields = requiredFields.filter(field => !item[field]);
            
            if (missingFields.length > 0) {
                throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
            }
            
            const itemData = {
                ...item,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            console.log('Adding item data to Firestore:', itemData);
            
            const docRef = await this.inventoryRef.add(itemData);
            console.log('Successfully added item with ID:', docRef.id);
            
            return { id: docRef.id, ...itemData };
        } catch (error) {
            console.error('Detailed error adding inventory item:', {
                error: error,
                code: error.code,
                message: error.message,
                stack: error.stack
            });
            
            // Provide more user-friendly error messages
            if (error.code === 'permission-denied') {
                throw new Error('Permission denied. Please check Firebase security rules.');
            } else if (error.code === 'unavailable') {
                throw new Error('Database unavailable. Please check your internet connection.');
            } else if (error.code === 'unauthenticated') {
                throw new Error('Authentication required. Please refresh the page.');
            } else {
                throw new Error(`Failed to save inventory item: ${error.message}`);
            }
        }
    }

    // Get all inventory items
    async getAllInventory(limit = 100, startAfter = null) {
        try {
            let query = this.inventoryRef
                .orderBy('brandName')
                .limit(limit);

            if (startAfter) {
                query = query.startAfter(startAfter);
            }

            const snapshot = await query.get();
            console.log(`Retrieved ${snapshot.docs.length} total inventory items`);
            
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


    // Get expired/recalled items (automatically detected from inventory)
    async getExpiredItems(limit = 10, startAfter = null) {
        try {
            // Get items where expiration date is past
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

            const expiredSnapshot = await query.get();
            
            // Also get explicitly recalled items
            const recalledQuery = this.expiredRef
                .orderBy('createdAt', 'desc')
                .limit(limit);

            const recalledSnapshot = await recalledQuery.get();

            const expiredItems = expiredSnapshot.docs.map(doc => ({ 
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

            // Combine and remove duplicates (in case an item is both expired and recalled)
            const allExpiredRecalled = [...expiredItems, ...recalledItems];
            const uniqueItems = allExpiredRecalled.filter((item, index, self) => 
                index === self.findIndex(t => t.ndc === item.ndc && t.lot === item.lot)
            );

            return uniqueItems.slice(0, limit);
        } catch (error) {
            console.error('Error getting expired items:', error);
            return [];
        }
    }

    // Update inventory item
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

    // Delete inventory item
    async deleteInventoryItem(id) {
        try {
            await this.inventoryRef.doc(id).delete();
            return true;
        } catch (error) {
            console.error('Error deleting inventory item:', error);
            throw error;
        }
    }

    // Report item as expired/recalled
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

// Initialize inventory database
let inventoryDB = null;

// Test Firebase connection and initialize
async function testFirebaseConnection() {
    try {
        console.log('Testing Firebase connection...');
        
        // Test if Firebase is properly initialized
        if (!firebase.apps.length) {
            console.error('Firebase not initialized');
            return false;
        }
        
        // Test Firestore connection
        await db.doc('test/connection').set({
            timestamp: new Date().toISOString(),
            test: true
        });
        
        // Clean up test document
        await db.doc('test/connection').delete();
        
        console.log('Firebase connection successful');
        return true;
    } catch (error) {
        console.error('Firebase connection failed:', {
            error: error,
            code: error.code,
            message: error.message
        });
        
        // Show user-friendly error
        if (error.code === 'permission-denied') {
            alert('Database permission denied. Please contact the administrator to update Firebase security rules.');
        } else {
            alert('Database connection failed. Please check your internet connection and try again.');
        }
        
        return false;
    }
}

// Initialize with connection test
async function initializeInventoryDB() {
    const connectionOK = await testFirebaseConnection();
    if (connectionOK) {
        inventoryDB = new InventoryDatabase();
        console.log('Inventory database initialized successfully');
    } else {
        console.error('Cannot initialize inventory database - connection failed');
    }
}

// Global variables for pagination
let currentInventoryItems = [];
let currentExpiredItems = [];
let lastInventoryDoc = null;
let lastExpiredDoc = null;

// Load inventory data when page loads
window.addEventListener('DOMContentLoaded', async () => {
    await initializeInventoryDB();
    if (inventoryDB) {
        await loadInventoryData();
        await loadExpiredData();
        
        // Check for newly expired items periodically
        setInterval(checkForNewlyExpiredItems, 60000); // Check every minute
    }
});

// Function to check for newly expired items and handle them automatically
async function checkForNewlyExpiredItems() {
    try {
        const currentDate = new Date().toISOString().split('T')[0];
        
        // Get items that expired today or recently
        const recentlyExpiredQuery = await inventoryDB.inventoryRef
            .where('expiration', '<=', currentDate)
            .where('expiration', '>', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0])
            .get();

        if (!recentlyExpiredQuery.empty) {
            const expiredItems = recentlyExpiredQuery.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log(`Found ${expiredItems.length} newly expired items`);
            
            // Optionally show notification to user
            if (expiredItems.length > 0) {
                const itemNames = expiredItems.map(item => item.brandName).join(', ');
                console.log(`Expired items detected: ${itemNames}`);
                
                // Refresh the expired items display
                await loadExpiredData();
            }
        }
    } catch (error) {
        console.error('Error checking for expired items:', error);
    }
}

// Load inventory items
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
        console.log('Loading inventory data...');
        const items = await inventoryDB.getAllInventory(50, lastInventoryDoc);
        console.log(`Loaded ${items.length} inventory items from database`);
        
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
            console.log('No inventory items found');
        } else {
            contentElement.style.display = 'block';
            console.log(`Displaying inventory section with ${currentInventoryItems.length} total items`);
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

// Display inventory items in table
function displayInventoryItems() {
    const tableBody = document.getElementById('inventory-table-body');
    tableBody.innerHTML = '';

    // Filter out expired items on the frontend
    const currentDate = new Date().toISOString().split('T')[0];
    const activeItems = currentInventoryItems.filter(item => {
        return !item.expiration || item.expiration > currentDate;
    });

    console.log(`Displaying ${activeItems.length} active items out of ${currentInventoryItems.length} total items`);

    activeItems.forEach(item => {
        const row = document.createElement('tr');
        
        // Determine stock status
        let stockClass = '';
        if (item.amount === 0) {
            stockClass = 'out-of-stock';
        } else if (item.amount < item.parLevel) {
            stockClass = 'low-stock';
        }

        row.className = stockClass;
        row.innerHTML = `
            <td>${item.brandName || ''}</td>
            <td>${item.genericName || ''}</td>
            <td>${item.shelfNumber || ''}</td>
            <td>${item.ndc || ''}</td>
            <td>${item.amount || 0}</td>
            <td>${item.parLevel || 0}</td>
            <td>${formatDate(item.expiration)}</td>
            <td>
                <span class="action-icon edit-icon" onclick="editInventoryItem('${item.id}')" title="Edit">✏️</span>
                <span class="action-icon delete-icon" onclick="deleteInventoryItem('${item.id}')" title="Delete">🗑️</span>
            </td>
        `;
        tableBody.appendChild(row);
    });

    // Update the info text to show filtered count
    const inventorySection = document.querySelector('.inventory-section h3');
    if (inventorySection) {
        inventorySection.innerHTML = `Inventory (table) - ${activeItems.length} active items`;
    }
}

// Display expired items in table
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
    // Redirect to edit page with item ID
    window.location.href = `add-stock.html?edit=${id}`;
}

async function deleteInventoryItem(id) {
    if (confirm('Are you sure you want to delete this inventory item?')) {
        try {
            await inventoryDB.deleteInventoryItem(id);
            await loadInventoryData(); // Refresh the data
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
                // For expired items, you might want to move them or just update status
                await inventoryDB.deleteInventoryItem(id);
            }
            await loadExpiredData(); // Refresh the data
            alert('Item removed successfully');
        } catch (error) {
            console.error('Error removing item:', error);
            alert('Error removing item: ' + error.message);
        }
    }
}

// Load more functions
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