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
    
    // Main Account Balance elements
    const mainAccountBalanceEl = document.getElementById('mainAccountBalance');
    const lastBalanceUpdateEl = document.getElementById('lastBalanceUpdate');
    const refreshBalanceBtn = document.getElementById('refreshBalanceBtn');
    const updateBalanceBtn = document.getElementById('updateBalanceBtn');
    
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
                await loadMainAccountBalance();
                break;
            case 'purchases':
                await loadPurchases();
                break;
            case 'items':
                await loadItems();
                await loadSubAdminsDropdown();
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

            // Load sub admins and their allocations
            const usersSnapshot = await database.ref('users').orderByChild('role').equalTo('subadmin').once('value');
            dashboardData.subAdmins = usersSnapshot.val() || {};

            // Load all allocations
            const allocationsSnapshot = await database.ref('budget_allocations').once('value');
            const allocations = allocationsSnapshot.val() || {};

            // Calculate totals from allocations
            let totalAllocated = 0;
            Object.values(allocations).forEach(userAllocations => {
                Object.values(userAllocations).forEach(allocation => {
                    if (allocation.type === 'reversal') {
                        totalAllocated -= allocation.amount;
                    } else {
                        totalAllocated += allocation.amount;
                    }
                });
            });

            const remaining = dashboardData.totalBudget - totalAllocated;

            // Update dashboard display
            totalFunds.textContent = formatCurrency(dashboardData.totalBudget);
            totalAllocated.textContent = formatCurrency(totalAllocated);
            totalRemaining.textContent = formatCurrency(remaining);

            // Load recent purchases
            await loadRecentPurchases();
            
            // Update sub admin status with allocation data
            updateSubAdminStatusWithAllocations(allocations);

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

    function updateSubAdminStatusWithAllocations(allocations) {
        const subAdminArray = Object.entries(dashboardData.subAdmins);
        
        if (subAdminArray.length === 0) {
            subAdminStatus.innerHTML = '<p class="text-gray-500">No sub admins</p>';
            return;
        }

        const statusHTML = subAdminArray.map(([uid, user]) => {
            const userAllocations = allocations[uid] || {};
            const totalAllocated = Object.values(userAllocations).reduce((sum, allocation) => {
                if (allocation.type === 'reversal') {
                    return sum - allocation.amount;
                }
                return sum + allocation.amount;
            }, 0);

            // Calculate actual used budget by considering returns
            const actualUsedBudget = (user.usedBudget || 0) - (user.returnedBudget || 0);
            
            // Calculate usage percentage based on actual used budget
            const usagePercent = ((actualUsedBudget) / (totalAllocated || 1)) * 100;
            const statusColor = usagePercent >= 90 ? 'text-red-600' : usagePercent >= 80 ? 'text-yellow-600' : 'text-green-600';
            
            return `
                <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                        <p class="font-medium text-gray-800">${user.email}</p>
                        <p class="text-sm text-gray-600">Total Budget: ${formatCurrency(totalAllocated)}</p>
                        <p class="text-sm text-gray-600">Used: ${formatCurrency(actualUsedBudget)}</p>
                        <p class="text-sm text-gray-600">Returns: ${formatCurrency(user.returnedBudget || 0)}</p>
                    </div>
                    <p class="font-semibold ${statusColor}">${Math.round(usagePercent)}%</p>
                </div>
            `;
        }).join('');

        subAdminStatus.innerHTML = statusHTML;
    }

    // Main Account Balance functions
    async function loadMainAccountBalance() {
        try {
            // Get total budget and allocations data
            const [budgetSnapshot, allocationsSnapshot] = await Promise.all([
                database.ref('budget/total').once('value'),
                database.ref('budget_allocations').once('value')
            ]);

            const totalBudget = budgetSnapshot.val() || 0;
            const allocations = allocationsSnapshot.val() || {};

            // Calculate total allocated to sub-admins (same logic as in loadBudgetData)
            let totalAllocated = 0;
            Object.values(allocations).forEach(userAllocations => {
                Object.values(userAllocations).forEach(allocation => {
                    if (allocation.type === 'reversal') {
                        totalAllocated -= allocation.amount;
                    } else {
                        totalAllocated += allocation.amount;
                    }
                });
            });

            // Calculate remaining balance
            const remainingBalance = totalBudget - totalAllocated;

            // Update the display
            mainAccountBalanceEl.textContent = formatCurrency(remainingBalance);
            lastBalanceUpdateEl.textContent = new Date().toLocaleString();

        } catch (error) {
            console.error('Error loading main account balance:', error);
            showMessage('Could not load main account balance.', 'error');
            mainAccountBalanceEl.textContent = '$?.??';
            lastBalanceUpdateEl.textContent = 'Error';
        }
    }

    refreshBalanceBtn.addEventListener('click', async () => {
        refreshBalanceBtn.disabled = true;
        refreshBalanceBtn.textContent = 'Refreshing...';
        try {
            await loadMainAccountBalance();
            showMessage('Balance refreshed successfully.', 'success');
        } catch (error) {
            showMessage('Failed to refresh balance.', 'error');
        } finally {
            refreshBalanceBtn.disabled = false;
            refreshBalanceBtn.textContent = 'Refresh Balance';
        }
    });

    updateBalanceBtn.addEventListener('click', async () => {
        const newBalanceStr = prompt('Enter amount to add to total budget:');
        if (newBalanceStr === null || newBalanceStr.trim() === '') {
            return; // User cancelled or entered nothing
        }

        const amountToAdd = parseFloat(newBalanceStr);
        if (isNaN(amountToAdd) || amountToAdd <= 0) {
            showMessage('Please enter a valid positive number.', 'error');
            return;
        }

        updateBalanceBtn.disabled = true;
        updateBalanceBtn.textContent = 'Updating...';

        try {
            // Get current total budget
            const budgetSnapshot = await database.ref('budget/total').once('value');
            const currentTotal = budgetSnapshot.val() || 0;
            const newTotal = currentTotal + amountToAdd;

            // Add new budget addition record
            const budgetAdditionRef = database.ref('budget/additions').push();
            await budgetAdditionRef.set({
                amount: amountToAdd,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                adminId: authManager.currentUser.uid,
                adminEmail: authManager.currentUser.email
            });

            // Update total budget
            await database.ref('budget/total').set(newTotal);

            showMessage(`Successfully added ${formatCurrency(amountToAdd)} to total budget.`, 'success');
            await loadMainAccountBalance(); // Reload to show the new balance
            await loadBudgetData(); // Reload the budget overview section as well
        } catch (error) {
            console.error('Error updating budget:', error);
            showMessage('Failed to update budget.', 'error');
        } finally {
            updateBalanceBtn.disabled = false;
            updateBalanceBtn.textContent = 'Update Balance';
        }
    });

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

            // Load budget allocations for all sub-admins
            const allocationsSnapshot = await database.ref('budget_allocations').once('value');
            const allocations = allocationsSnapshot.val() || {};

            const subAdminsHTML = Object.entries(subAdmins).map(([uid, user]) => {
                // Calculate total allocated budget from allocations
                const userAllocations = allocations[uid] || {};
                const totalAllocated = Object.values(userAllocations).reduce((sum, allocation) => {
                    if (allocation.type === 'reversal') {
                        return sum - allocation.amount;
                    }
                    return sum + allocation.amount;
                }, 0);
                
                return `
                <div class="flex flex-col p-4 bg-gray-50 rounded-lg mb-4">
                    <div class="flex justify-between items-center mb-4">
                        <div>
                            <p class="font-medium text-gray-800">${user.email}</p>
                            <p class="text-sm text-gray-600">Total Budget: ${formatCurrency(totalAllocated)}</p>
                            <p class="text-sm text-gray-600">Used: ${formatCurrency(user.usedBudget || 0)}</p>
                        </div>
                        <div class="flex gap-2">
                            <button 
                                onclick="window.addBudget('${uid}', '${user.email}')"
                                class="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors">
                                Add Budget
                            </button>
                        </div>
                    </div>
                    <div class="mt-2">
                        <p class="font-medium text-gray-700 mb-2">Budget Allocation History</p>
                        <div class="max-h-40 overflow-y-auto">
                            ${generateAllocationHistory(userAllocations, uid, user.email)}
                        </div>
                    </div>
                </div>
            `}).join('');

            subAdminsList.innerHTML = subAdminsHTML;
        } catch (error) {
            console.error('Error loading sub admins:', error);
            showMessage('Error loading sub admins', 'error');
        }
    }

    function generateAllocationHistory(allocations, subAdminUid, subAdminEmail) {
        if (!allocations || Object.keys(allocations).length === 0) {
            return '<p class="text-gray-500 text-sm">No allocation history</p>';
        }

        const historyArray = Object.entries(allocations)
            .map(([id, allocation]) => ({
                ...allocation,
                id
            }))
            .sort((a, b) => b.timestamp - a.timestamp);

        return historyArray.map(allocation => `
            <div class="text-sm p-2 border-b border-gray-200 last:border-0">
                <div class="flex justify-between items-center">
                    <span class="font-medium ${allocation.type === 'reversal' ? 'text-red-600' : 'text-green-600'}">
                        ${allocation.type === 'reversal' ? '-' : '+'}${formatCurrency(allocation.amount)}
                    </span>
                    <div class="flex items-center gap-2">
                        <span class="text-gray-500">${formatDate(allocation.timestamp)}</span>
                        ${allocation.type !== 'reversal' ? `
                            <button 
                                onclick="window.reverseAllocation('${allocation.id}', ${allocation.amount}, '${subAdminUid}', '${subAdminEmail}')"
                                class="text-red-600 hover:text-red-800 text-xs bg-red-100 px-2 py-1 rounded"
                                title="Reverse this allocation">
                                Reverse
                            </button>
                        ` : ''}
                    </div>
                </div>
                <p class="text-gray-600 text-xs">
                    ${allocation.type === 'reversal' 
                        ? `Reversed by: ${allocation.adminEmail} (Original allocation: ${formatDate(allocation.originalAllocationTime)})`
                        : `Allocated by: ${allocation.adminEmail}`}
                </p>
            </div>
        `).join('');
    }

    // Items management
    addItemForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const name = document.getElementById('itemName').value.trim();
        const assignedSubAdmin = document.getElementById('assignedSubAdmin').value;

        if (!name || !assignedSubAdmin) {
            showMessage('Please enter item name and select a sub admin.', 'error');
            return;
        }

        try {
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Adding...';

            // Add item to database with required fields
            await database.ref('items').push({
                name: name,
                assignedTo: assignedSubAdmin,
                status: 'pending_price',
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                createdBy: authManager.currentUser.uid,
                price: null // Optional field
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

            // Get sub-admin details for display
            const usersSnapshot = await database.ref('users').orderByChild('role').equalTo('subadmin').once('value');
            const subAdmins = usersSnapshot.val() || {};

            const itemsHTML = Object.entries(items).map(([id, item]) => `
                <div class="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                    <div class="flex-1">
                        <h4 class="font-medium text-gray-800">${item.name}</h4>
                        <p class="text-sm text-gray-600">
                            Price: ${item.price ? formatCurrency(item.price) : '<span class="text-orange-500">Pending price from sub-admin</span>'}
                        </p>
                        <p class="text-xs text-gray-500">
                            Assigned to: ${subAdmins[item.assignedTo]?.email || 'Unknown'}
                            <br>Created: ${formatDate(item.createdAt)}
                        </p>
                    </div>
                    <div class="flex space-x-2">
                        <button onclick="reassignItem('${id}', '${item.name}', '${item.assignedTo}')" 
                                class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors">
                            Reassign
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

    // Load sub-admins into the dropdown when the items section is shown
    async function loadSubAdminsDropdown() {
        try {
            const usersSnapshot = await database.ref('users').orderByChild('role').equalTo('subadmin').once('value');
            const subAdmins = usersSnapshot.val() || {};
            
            const dropdown = document.getElementById('assignedSubAdmin');
            const options = Object.entries(subAdmins).map(([uid, user]) => 
                `<option value="${uid}">${user.email}</option>`
            ).join('');
            
            dropdown.innerHTML = '<option value="">Assign to Sub Admin...</option>' + options;
        } catch (error) {
            console.error('Error loading sub admins for dropdown:', error);
            showMessage('Error loading sub admins.', 'error');
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
        
        const amount = parseFloat(document.getElementById('totalBudgetInput').value);
        if (!amount || amount <= 0) {
            showMessage('Please enter a valid amount.', 'error');
            return;
        }

        try {
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Adding...';

            // Get current total budget
            const budgetSnapshot = await database.ref('budget/total').once('value');
            const currentTotal = budgetSnapshot.val() || 0;
            const newTotal = currentTotal + amount;

            // Add new budget addition record
            const budgetAdditionRef = database.ref('budget/additions').push();
            await budgetAdditionRef.set({
                amount: amount,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                adminId: authManager.currentUser.uid,
                adminEmail: authManager.currentUser.email
            });

            // Update total budget
            await database.ref('budget/total').set(newTotal);

            showMessage(`Successfully added ${formatCurrency(amount)} to total budget.`, 'success');
            
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
            submitBtn.textContent = 'Add to Total Budget';
        }
    });

    async function loadBudgetData() {
        try {
            // Get total budget and additions history
            const [budgetSnapshot, additionsSnapshot, usersSnapshot, allocationsSnapshot] = await Promise.all([
                database.ref('budget/total').once('value'),
                database.ref('budget/additions').once('value'),
                database.ref('users').orderByChild('role').equalTo('subadmin').once('value'),
                database.ref('budget_allocations').once('value')
            ]);

            const totalBudget = budgetSnapshot.val() || 0;
            const additions = additionsSnapshot.val() || {};
            const subAdmins = usersSnapshot.val() || {};
            const allocations = allocationsSnapshot.val() || {};

            // Calculate total allocated to sub-admins
            let totalAllocated = 0;
            Object.values(allocations).forEach(userAllocations => {
                Object.values(userAllocations).forEach(allocation => {
                    if (allocation.type === 'reversal') {
                        totalAllocated -= allocation.amount;
                    } else {
                        totalAllocated += allocation.amount;
                    }
                });
            });

            // Update budget overview
            document.getElementById('totalFundsAdded').textContent = formatCurrency(totalBudget);
            document.getElementById('totalAllocatedToSubAdmins').textContent = formatCurrency(totalAllocated);
            document.getElementById('availableForAllocation').textContent = formatCurrency(totalBudget - totalAllocated);

            // Update budget addition history
            const budgetAdditionHistory = document.getElementById('budgetAdditionHistory');
            if (Object.keys(additions).length === 0) {
                budgetAdditionHistory.innerHTML = '<p class="text-gray-500">No budget additions yet</p>';
            } else {
                const historyHTML = Object.entries(additions)
                    .map(([id, addition]) => ({
                        ...addition,
                        id
                    }))
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .map(addition => `
                        <div class="border-b border-gray-200 pb-2 last:border-0">
                            <div class="flex justify-between items-center">
                                <span class="font-medium text-green-600">+${formatCurrency(addition.amount)}</span>
                                <span class="text-gray-500 text-sm">${formatDate(addition.timestamp)}</span>
                            </div>
                            <p class="text-gray-600 text-sm">Added by: ${addition.adminEmail}</p>
                        </div>
                    `).join('');
                budgetAdditionHistory.innerHTML = historyHTML;
            }

            // Update sub-admin budget usage display
            if (Object.keys(subAdmins).length === 0) {
                budgetUsage.innerHTML = '<p class="text-gray-500">No budget allocations found</p>';
                return;
            }

            const budgetHTML = Object.entries(subAdmins).map(([uid, user]) => {
                const userAllocations = allocations[uid] || {};
                const totalAllocatedToUser = Object.values(userAllocations).reduce((sum, allocation) => {
                    if (allocation.type === 'reversal') {
                        return sum - allocation.amount;
                    }
                    return sum + allocation.amount;
                }, 0);
                
                const used = user.usedBudget || 0;
                const remaining = totalAllocatedToUser - used;
                const usagePercent = totalAllocatedToUser > 0 ? (used / totalAllocatedToUser) * 100 : 0;
                
                return `
                    <div class="bg-gray-50 rounded-lg p-4">
                        <div class="flex justify-between items-center mb-3">
                            <h4 class="font-medium text-gray-800">${user.email}</h4>
                            <span class="text-sm text-gray-600">${Math.round(usagePercent)}% used</span>
                        </div>
                        <div class="grid grid-cols-3 gap-4 text-sm mb-3">
                            <div class="text-center">
                                <p class="text-gray-600">Allocated</p>
                                <p class="font-semibold text-blue-600">${formatCurrency(totalAllocatedToUser)}</p>
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

    // Add reassign functionality
    window.reassignItem = async function(id, name, currentAssignedTo) {
        try {
            const usersSnapshot = await database.ref('users').orderByChild('role').equalTo('subadmin').once('value');
            const subAdmins = usersSnapshot.val() || {};
            
            const options = Object.entries(subAdmins)
                .map(([uid, user]) => `<option value="${uid}" ${uid === currentAssignedTo ? 'selected' : ''}>${user.email}</option>`)
                .join('');
            
            const newAssignedTo = prompt(`Select new sub-admin for "${name}":`, currentAssignedTo);
            if (!newAssignedTo || newAssignedTo === currentAssignedTo) return;

            await database.ref('items/' + id).update({
                assignedTo: newAssignedTo,
                price: null,
                status: 'pending_price'
            });
            
            showMessage('Item reassigned successfully!', 'success');
            await loadItems();
        } catch (error) {
            console.error('Error reassigning item:', error);
            showMessage('Error reassigning item.', 'error');
        }
    };

    // Add the reverseAllocation function to the window object
    window.reverseAllocation = async function(allocationId, amount, subAdminUid, subAdminEmail) {
        if (!confirm(`Are you sure you want to reverse the allocation of ${formatCurrency(amount)} from ${subAdminEmail}?`)) {
            return;
        }

        try {
            const currentUser = firebase.auth().currentUser;
            if (!currentUser) {
                throw new Error('No authenticated admin user found');
            }
            
            // First verify the original allocation exists
            const originalAllocationSnapshot = await database.ref(`budget_allocations/${subAdminUid}/${allocationId}`).once('value');
            const originalAllocation = originalAllocationSnapshot.val();
            
            if (!originalAllocation) {
                throw new Error('Original allocation not found');
            }

            if (originalAllocation.type === 'reversal') {
                throw new Error('Cannot reverse a reversal');
            }
            
            // Get sub-admin's current used budget
            const userSnapshot = await database.ref(`users/${subAdminUid}`).once('value');
            const userData = userSnapshot.val();
            
            if (!userData) {
                throw new Error('Sub-admin user data not found');
            }

            const usedBudget = userData.usedBudget || 0;

            // Get all allocations to calculate total allocated budget
            const allocationsSnapshot = await database.ref(`budget_allocations/${subAdminUid}`).once('value');
            const allocations = allocationsSnapshot.val() || {};
            
            // Calculate total allocated budget including all allocations and reversals
            const totalAllocated = Object.values(allocations).reduce((sum, alloc) => {
                if (alloc.type === 'reversal') {
                    return sum - alloc.amount;
                }
                return sum + alloc.amount;
            }, 0);

            // Check if reversal would make budget negative
            if (totalAllocated - amount < usedBudget) {
                const errorMsg = `Cannot reverse allocation. Sub-admin has already used ${formatCurrency(usedBudget)} of their budget. Available to reverse: ${formatCurrency(totalAllocated - usedBudget)}`;
                showMessage(errorMsg, 'error');
                console.error('Reversal validation failed:', {
                    totalAllocated,
                    amount,
                    usedBudget,
                    availableToReverse: totalAllocated - usedBudget
                });
                return;
            }

            // Create reversal data
            const reversalData = {
                amount: amount,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                adminId: currentUser.uid,
                adminEmail: currentUser.email,
                type: 'reversal',
                originalAllocationId: allocationId,
                originalAllocationTime: originalAllocation.timestamp,
                subAdminUid: subAdminUid,
                subAdminEmail: subAdminEmail,
                notes: `Reversal of ${formatCurrency(amount)} allocated on ${formatDate(originalAllocation.timestamp)}`
            };

            console.log('Creating reversal with data:', reversalData);
            
            // Create a new reversal reference
            const reversalRef = database.ref(`budget_allocations/${subAdminUid}`).push();
            
            // Simply set the reversal data
            await reversalRef.set(reversalData);

            showMessage('Budget allocation reversed successfully!', 'success');
            await loadSubAdmins(); // Reload the list
            
        } catch (error) {
            console.error('Detailed error in reverseAllocation:', {
                error,
                allocationId,
                amount,
                subAdminUid,
                subAdminEmail,
                stack: error.stack,
                message: error.message
            });
            
            let errorMessage = 'Error reversing allocation. ';
            if (error.message) {
                errorMessage += error.message;
            }
            
            showMessage(errorMessage, 'error');
        }
    };

    // Add the addBudget function to the window object
    window.addBudget = async function(subAdminUid, subAdminEmail) {
        // Create modal for budget input
        const modalHTML = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                <div class="bg-white rounded-lg p-6 w-full max-w-md">
                    <h3 class="text-lg font-semibold text-gray-800 mb-4">Add Budget for ${subAdminEmail}</h3>
                    <form id="addBudgetForm" class="space-y-4">
                        <div>
                            <label class="block text-gray-700 text-sm font-medium mb-2">Amount to Add</label>
                            <input type="number" id="budgetAmount" required min="0.01" step="0.01"
                                   class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                        </div>
                        <div class="flex justify-end gap-3">
                            <button type="button" onclick="document.getElementById('budgetAllocationModal').remove()"
                                    class="px-4 py-2 text-gray-600 hover:text-gray-800">
                                Cancel
                            </button>
                            <button type="submit"
                                    class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                                Add Budget
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Create modal element
        const modalElement = document.createElement('div');
        modalElement.id = 'budgetAllocationModal';
        modalElement.innerHTML = modalHTML;
        document.body.appendChild(modalElement);

        // Handle form submission
        document.getElementById('addBudgetForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const amount = parseFloat(document.getElementById('budgetAmount').value);
            if (!amount || amount <= 0) {
                showMessage('Please enter a valid amount.', 'error');
                return;
            }

            try {
                const submitBtn = e.target.querySelector('button[type="submit"]');
                submitBtn.disabled = true;
                submitBtn.textContent = 'Adding...';

                // Get current total budget and allocated amounts
                const [budgetSnapshot, allocationsSnapshot] = await Promise.all([
                    database.ref('budget/total').once('value'),
                    database.ref('budget_allocations').once('value')
                ]);

                const totalBudget = budgetSnapshot.val() || 0;
                const allocations = allocationsSnapshot.val() || {};

                // Calculate total allocated to all sub-admins
                let totalAllocated = 0;
                Object.values(allocations).forEach(userAllocations => {
                    Object.values(userAllocations).forEach(allocation => {
                        if (allocation.type === 'reversal') {
                            totalAllocated -= allocation.amount;
                        } else {
                            totalAllocated += allocation.amount;
                        }
                    });
                });

                // Check if enough budget is available
                if (totalAllocated + amount > totalBudget) {
                    showMessage(`Insufficient funds. Available for allocation: ${formatCurrency(totalBudget - totalAllocated)}`, 'error');
                    return;
                }

                // Create allocation record
                const allocationData = {
                    amount: amount,
                    timestamp: firebase.database.ServerValue.TIMESTAMP,
                    adminId: firebase.auth().currentUser.uid,
                    adminEmail: firebase.auth().currentUser.email,
                    type: 'allocation',
                    subAdminUid: subAdminUid,
                    subAdminEmail: subAdminEmail
                };

                // Add allocation to database
                await database.ref(`budget_allocations/${subAdminUid}`).push(allocationData);

                showMessage(`Successfully allocated ${formatCurrency(amount)} to ${subAdminEmail}`, 'success');
                modalElement.remove();
                
                // Reload data
                await Promise.all([
                    loadSubAdmins(),
                    loadBudgetData()
                ]);

            } catch (error) {
                console.error('Error allocating budget:', error);
                showMessage('Error allocating budget. Please try again.', 'error');
            }
        });
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

