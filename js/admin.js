// Main Admin Dashboard Implementation
document.addEventListener('DOMContentLoaded', function() {
    // Initialize authentication
    const authManager = new AuthManager();
    
    // UI Elements
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Dashboard elements
    const totalFunds = document.getElementById('totalFunds');
    const totalAllocated = document.getElementById('totalAllocated');
    const totalRemaining = document.getElementById('totalRemaining');
    const recentPurchases = document.getElementById('recentPurchases');
    const subAdminStatus = document.getElementById('subAdminStatus');
    
    // Sub Admin management
    const addSubAdminForm = document.getElementById('addSubAdminForm');
    const subAdminsList = document.getElementById('subAdminsList');
    
    // Items management
    const addItemForm = document.getElementById('addItemForm');
    const itemsList = document.getElementById('itemsList');
    
    // Purchases
    const purchasesList = document.getElementById('purchasesList');
    const exportPurchasesBtn = document.getElementById('exportPurchasesBtn');
    
    // Budget management
    const setBudgetForm = document.getElementById('setBudgetForm');
    const budgetUsage = document.getElementById('budgetUsage');

    // State
    let currentSection = 'dashboard';
    let dashboardData = {
        totalBudget: 0,
        subAdmins: {},
        items: {},
        purchases: []
    };

    // Navigation
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const section = this.dataset.section;
            if (section) {
                switchSection(section);
            }
        });
    });

    function switchSection(sectionName) {
        // Update navigation
        navItems.forEach(item => {
            if (item.dataset.section === sectionName) {
                item.classList.add('bg-blue-600', 'text-white');
                item.classList.remove('hover:bg-gray-700');
            } else {
                item.classList.remove('bg-blue-600', 'text-white');
                item.classList.add('hover:bg-gray-700');
            }
        });

        // Update sections
        sections.forEach(section => {
            if (section.id === sectionName) {
                section.classList.remove('hidden');
            } else {
                section.classList.add('hidden');
            }
        });

        currentSection = sectionName;
        
        // Load section-specific data
        loadSectionData(sectionName);
    }

    async function loadSectionData(sectionName) {
        switch (sectionName) {
            case 'dashboard':
                await loadDashboardData();
                break;
            case 'subadmins':
                await loadSubAdmins();
                break;
            case 'purchases':
                await loadPurchases();
                break;
            case 'items':
                await loadItems();
                break;
            case 'budget':
                await loadBudgetData();
                break;
        }
    }

    // Dashboard functions
    async function loadDashboardData() {
        try {
            // Load budget info
            const budgetSnapshot = await database.ref('budget/total').once('value');
            dashboardData.totalBudget = budgetSnapshot.val() || 0;

            // Load sub admins
            const usersSnapshot = await database.ref('users').orderByChild('role').equalTo('subadmin').once('value');
            dashboardData.subAdmins = usersSnapshot.val() || {};

            // Calculate totals
            const allocated = Object.values(dashboardData.subAdmins).reduce((sum, user) => sum + (user.allocatedBudget || 0), 0);
            const remaining = dashboardData.totalBudget - allocated;

            // Update dashboard display
            totalFunds.textContent = formatCurrency(dashboardData.totalBudget);
            totalAllocated.textContent = formatCurrency(allocated);
            totalRemaining.textContent = formatCurrency(remaining);

            // Load recent purchases
            await loadRecentPurchases();
            
            // Update sub admin status
            updateSubAdminStatus();

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            showMessage('Error loading dashboard data.', 'error');
        }
    }

    async function loadRecentPurchases() {
        try {
            const purchasesSnapshot = await database.ref('purchases').limitToLast(5).once('value');
            const allPurchases = [];

            purchasesSnapshot.forEach(userSnapshot => {
                userSnapshot.forEach(purchaseSnapshot => {
                    const purchase = purchaseSnapshot.val();
                    if (purchase.timestamp) {
                        allPurchases.push({
                            ...purchase,
                            id: purchaseSnapshot.key,
                            userId: userSnapshot.key
                        });
                    }
                });
            });

            // Sort by timestamp (most recent first)
            allPurchases.sort((a, b) => b.timestamp - a.timestamp);
            
            if (allPurchases.length === 0) {
                recentPurchases.innerHTML = '<p class="text-gray-500">No recent purchases</p>';
                return;
            }

            const purchasesHTML = allPurchases.slice(0, 5).map(purchase => `
                <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                        <p class="font-medium text-gray-800">${purchase.userEmail}</p>
                        <p class="text-sm text-gray-600">${formatDate(purchase.timestamp)}</p>
                    </div>
                    <p class="font-semibold text-blue-600">${formatCurrency(purchase.totalAmount)}</p>
                </div>
            `).join('');

            recentPurchases.innerHTML = purchasesHTML;

        } catch (error) {
            console.error('Error loading recent purchases:', error);
        }
    }

    function updateSubAdminStatus() {
        const subAdminArray = Object.entries(dashboardData.subAdmins);
        
        if (subAdminArray.length === 0) {
            subAdminStatus.innerHTML = '<p class="text-gray-500">No sub admins</p>';
            return;
        }

        const statusHTML = subAdminArray.map(([uid, user]) => {
            const usagePercent = ((user.usedBudget || 0) / (user.allocatedBudget || 1)) * 100;
            const statusColor = usagePercent >= 90 ? 'text-red-600' : usagePercent >= 80 ? 'text-yellow-600' : 'text-green-600';
            
            return `
                <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                        <p class="font-medium text-gray-800">${user.email}</p>
                        <p class="text-sm text-gray-600">Budget: ${formatCurrency(user.allocatedBudget || 0)}</p>
                    </div>
                    <p class="font-semibold ${statusColor}">${Math.round(usagePercent)}%</p>
                </div>
            `;
        }).join('');

        subAdminStatus.innerHTML = statusHTML;
    }

    // Sub Admin management
    addSubAdminForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = document.getElementById('subAdminEmail').value.trim();
        const password = document.getElementById('subAdminPassword').value;
        const budget = parseFloat(document.getElementById('subAdminBudget').value) || 0;

        if (!email || !password || budget <= 0) {
            showMessage('Please fill in all fields with valid values.', 'error');
            return;
        }

        try {
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creating...';

            await authManager.createSubAdmin(email, password, budget);
            showMessage('Sub admin created successfully!', 'success');
            
            // Reset form
            this.reset();
            
            // Reload sub admins list
            await loadSubAdmins();
            
        } catch (error) {
            console.error('Error creating sub admin:', error);
            showMessage(getErrorMessage(error.code || error.message), 'error');
        } finally {
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Add Sub Admin';
        }
    });

    async function loadSubAdmins() {
        try {
            const usersSnapshot = await database.ref('users').orderByChild('role').equalTo('subadmin').once('value');
            const subAdmins = usersSnapshot.val() || {};

            if (Object.keys(subAdmins).length === 0) {
                subAdminsList.innerHTML = '<p class="text-gray-500">No sub admins found</p>';
                return;
            }

            const subAdminsHTML = Object.entries(subAdmins).map(([uid, user]) => `
                <div class="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                    <div class="flex-1">
                        <h4 class="font-medium text-gray-800">${user.email}</h4>
                        <p class="text-sm text-gray-600">
                            Budget: ${formatCurrency(user.allocatedBudget || 0)} | 
                            Used: ${formatCurrency(user.usedBudget || 0)} | 
                            Remaining: ${formatCurrency((user.allocatedBudget || 0) - (user.usedBudget || 0))}
                        </p>
                        <p class="text-xs text-gray-500">Created: ${formatDate(user.createdAt)}</p>
                    </div>
                    <div class="flex space-x-2">
                        <button onclick="editSubAdminBudget('${uid}', ${user.allocatedBudget || 0})" 
                                class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors">
                            Edit Budget
                        </button>
                        <button onclick="deleteSubAdmin('${uid}', '${user.email}')" 
                                class="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors">
                            Delete
                        </button>
                    </div>
                </div>
            `).join('');

            subAdminsList.innerHTML = subAdminsHTML;

        } catch (error) {
            console.error('Error loading sub admins:', error);
            showMessage('Error loading sub admins.', 'error');
        }
    }

    // Items management
    addItemForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const name = document.getElementById('itemName').value.trim();
        const price = parseFloat(document.getElementById('itemPrice').value) || 0;

        if (!name || price <= 0) {
            showMessage('Please enter a valid item name and price.', 'error');
            return;
        }

        try {
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Adding...';

            // Add item to database
            await database.ref('items').push({
                name: name,
                price: price,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                createdBy: authManager.currentUser.uid
            });

            showMessage('Item added successfully!', 'success');
            
            // Reset form
            this.reset();
            
            // Reload items list
            await loadItems();
            
        } catch (error) {
            console.error('Error adding item:', error);
            showMessage('Error adding item. Please try again.', 'error');
        } finally {
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Add Item';
        }
    });

    async function loadItems() {
        try {
            const itemsSnapshot = await database.ref('items').once('value');
            const items = itemsSnapshot.val() || {};

            if (Object.keys(items).length === 0) {
                itemsList.innerHTML = '<p class="text-gray-500">No items found</p>';
                return;
            }

            const itemsHTML = Object.entries(items).map(([id, item]) => `
                <div class="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                    <div class="flex-1">
                        <h4 class="font-medium text-gray-800">${item.name}</h4>
                        <p class="text-sm text-gray-600">Price: ${formatCurrency(item.price)}</p>
                        <p class="text-xs text-gray-500">Created: ${formatDate(item.createdAt)}</p>
                    </div>
                    <div class="flex space-x-2">
                        <button onclick="editItem('${id}', '${item.name}', ${item.price})" 
                                class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors">
                            Edit
                        </button>
                        <button onclick="deleteItem('${id}', '${item.name}')" 
                                class="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors">
                            Delete
                        </button>
                    </div>
                </div>
            `).join('');

            itemsList.innerHTML = itemsHTML;

        } catch (error) {
            console.error('Error loading items:', error);
            showMessage('Error loading items.', 'error');
        }
    }

    // Purchases management
    async function loadPurchases() {
        try {
            const purchasesSnapshot = await database.ref('purchases').once('value');
            const allPurchases = [];

            purchasesSnapshot.forEach(userSnapshot => {
                userSnapshot.forEach(purchaseSnapshot => {
                    const purchase = purchaseSnapshot.val();
                    if (purchase.timestamp) {
                        allPurchases.push({
                            ...purchase,
                            id: purchaseSnapshot.key,
                            userId: userSnapshot.key
                        });
                    }
                });
            });

            // Sort by timestamp (most recent first)
            allPurchases.sort((a, b) => b.timestamp - a.timestamp);
            
            if (allPurchases.length === 0) {
                purchasesList.innerHTML = '<p class="text-gray-500">No purchases found</p>';
                return;
            }

            const purchasesHTML = allPurchases.map(purchase => `
                <div class="bg-gray-50 rounded-lg p-4 mb-4">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <h4 class="font-medium text-gray-800">${purchase.userEmail}</h4>
                            <p class="text-sm text-gray-600">${formatDate(purchase.timestamp)}</p>
                        </div>
                        <p class="font-semibold text-blue-600">${formatCurrency(purchase.totalAmount)}</p>
                    </div>
                    <div class="space-y-2">
                        ${purchase.items.map(item => `
                            <div class="flex justify-between text-sm">
                                <span>${item.name} (x${item.quantity})</span>
                                <span>${formatCurrency(item.price * item.quantity)}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');

            purchasesList.innerHTML = purchasesHTML;
            dashboardData.purchases = allPurchases;

        } catch (error) {
            console.error('Error loading purchases:', error);
            showMessage('Error loading purchases.', 'error');
        }
    }

    // Budget management
    setBudgetForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const totalBudget = parseFloat(document.getElementById('totalBudgetInput').value) || 0;

        if (totalBudget <= 0) {
            showMessage('Please enter a valid budget amount.', 'error');
            return;
        }

        try {
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Updating...';

            await database.ref('budget/total').set(totalBudget);
            showMessage('Total budget updated successfully!', 'success');
            
            // Reset form
            this.reset();
            
            // Reload budget data
            await loadBudgetData();
            
        } catch (error) {
            console.error('Error updating budget:', error);
            showMessage('Error updating budget. Please try again.', 'error');
        } finally {
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Update Budget';
        }
    });

    async function loadBudgetData() {
        try {
            const budgetSnapshot = await database.ref('budget/total').once('value');
            const totalBudget = budgetSnapshot.val() || 0;

            const usersSnapshot = await database.ref('users').orderByChild('role').equalTo('subadmin').once('value');
            const subAdmins = usersSnapshot.val() || {};

            if (Object.keys(subAdmins).length === 0) {
                budgetUsage.innerHTML = '<p class="text-gray-500">No budget allocations found</p>';
                return;
            }

            const budgetHTML = Object.entries(subAdmins).map(([uid, user]) => {
                const allocated = user.allocatedBudget || 0;
                const used = user.usedBudget || 0;
                const remaining = allocated - used;
                const usagePercent = (used / allocated) * 100;
                
                return `
                    <div class="bg-gray-50 rounded-lg p-4">
                        <div class="flex justify-between items-center mb-3">
                            <h4 class="font-medium text-gray-800">${user.email}</h4>
                            <span class="text-sm text-gray-600">${Math.round(usagePercent)}% used</span>
                        </div>
                        <div class="grid grid-cols-3 gap-4 text-sm mb-3">
                            <div class="text-center">
                                <p class="text-gray-600">Allocated</p>
                                <p class="font-semibold text-blue-600">${formatCurrency(allocated)}</p>
                            </div>
                            <div class="text-center">
                                <p class="text-gray-600">Used</p>
                                <p class="font-semibold text-red-600">${formatCurrency(used)}</p>
                            </div>
                            <div class="text-center">
                                <p class="text-gray-600">Remaining</p>
                                <p class="font-semibold text-green-600">${formatCurrency(remaining)}</p>
                            </div>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                            <div class="bg-blue-500 h-2 rounded-full transition-all duration-300" 
                                 style="width: ${Math.min(usagePercent, 100)}%"></div>
                        </div>
                    </div>
                `;
            }).join('');

            budgetUsage.innerHTML = budgetHTML;

        } catch (error) {
            console.error('Error loading budget data:', error);
            showMessage('Error loading budget data.', 'error');
        }
    }

    // Export functionality
    exportPurchasesBtn.addEventListener('click', function() {
        if (dashboardData.purchases.length === 0) {
            showMessage('No purchases to export.', 'error');
            return;
        }

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Title
            doc.setFontSize(20);
            doc.text('Purchase Report', 20, 20);
            
            // Date
            doc.setFontSize(12);
            doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 35);
            
            let yPosition = 50;
            
            dashboardData.purchases.forEach((purchase, index) => {
                if (yPosition > 250) {
                    doc.addPage();
                    yPosition = 20;
                }
                
                doc.setFontSize(14);
                doc.text(`${purchase.userEmail} - ${formatDate(purchase.timestamp)}`, 20, yPosition);
                yPosition += 10;
                
                doc.setFontSize(10);
                purchase.items.forEach(item => {
                    doc.text(`  ${item.name} (x${item.quantity}) - ${formatCurrency(item.price * item.quantity)}`, 25, yPosition);
                    yPosition += 7;
                });
                
                doc.setFontSize(12);
                doc.text(`Total: ${formatCurrency(purchase.totalAmount)}`, 20, yPosition);
                yPosition += 15;
            });
            
            doc.save('purchase-report.pdf');
            showMessage('Report exported successfully!', 'success');
            
        } catch (error) {
            console.error('Error exporting report:', error);
            showMessage('Error exporting report. Please try again.', 'error');
        }
    });

    // Logout
    logoutBtn.addEventListener('click', () => {
        authManager.logout();
    });

    // Global functions for item and sub-admin management
    window.editItem = async function(id, currentName, currentPrice) {
        const newName = prompt('Enter new item name:', currentName);
        if (!newName || newName.trim() === '') return;
        
        const newPrice = prompt('Enter new price:', currentPrice);
        if (!newPrice || isNaN(newPrice) || parseFloat(newPrice) <= 0) return;

        try {
            await database.ref('items/' + id).update({
                name: newName.trim(),
                price: parseFloat(newPrice)
            });
            showMessage('Item updated successfully!', 'success');
            await loadItems();
        } catch (error) {
            console.error('Error updating item:', error);
            showMessage('Error updating item.', 'error');
        }
    };

    window.deleteItem = async function(id, name) {
        if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

        try {
            await database.ref('items/' + id).remove();
            showMessage('Item deleted successfully!', 'success');
            await loadItems();
        } catch (error) {
            console.error('Error deleting item:', error);
            showMessage('Error deleting item.', 'error');
        }
    };

    window.editSubAdminBudget = async function(uid, currentBudget) {
        const newBudget = prompt('Enter new budget amount:', currentBudget);
        if (!newBudget || isNaN(newBudget) || parseFloat(newBudget) <= 0) return;

        try {
            await authManager.updateSubAdminBudget(uid, parseFloat(newBudget));
            showMessage('Budget updated successfully!', 'success');
            await loadSubAdmins();
        } catch (error) {
            console.error('Error updating budget:', error);
            showMessage('Error updating budget.', 'error');
        }
    };

    window.deleteSubAdmin = async function(uid, email) {
        if (!confirm(`Are you sure you want to delete sub admin "${email}"?`)) return;

        try {
            await authManager.deleteSubAdmin(uid);
            showMessage('Sub admin deleted successfully!', 'success');
            await loadSubAdmins();
        } catch (error) {
            console.error('Error deleting sub admin:', error);
            showMessage('Error deleting sub admin.', 'error');
        }
    };

    // Initialize dashboard when user is authenticated
    window.initializeDashboard = function() {
        loadDashboardData();
    };

    function showMessage(message, type = 'success') {
        const messageElement = document.getElementById(type + 'Message');
        if (messageElement) {
            messageElement.textContent = message;
            messageElement.classList.remove('hidden');
            
            setTimeout(() => {
                messageElement.classList.add('hidden');
            }, 5000);
        }
    }

    function getErrorMessage(errorCode) {
        switch (errorCode) {
            case 'auth/email-already-in-use':
                return 'Email address is already in use.';
            case 'auth/invalid-email':
                return 'Invalid email address.';
            case 'auth/weak-password':
                return 'Password should be at least 6 characters.';
            default:
                return errorCode || 'An error occurred. Please try again.';
        }
    }
});

