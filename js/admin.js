// Main Admin Dashboard Implementation
document.addEventListener('DOMContentLoaded', function() {
    // Initialize authentication
    const authManager = new AuthManager();
    
    // UI Elements
    const loginSection = document.getElementById('loginSection');
    const mainContent = document.getElementById('mainContent');
    const loginForm = document.getElementById('loginForm');
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const loginBtn = document.getElementById('loginBtn');
    const loginErrorMessage = document.getElementById('loginErrorMessage');
    const loginLoadingMessage = document.getElementById('loginLoadingMessage');
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

    // Initialize Firebase Auth
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                // Get user data
                const userSnapshot = await database.ref('users/' + user.uid).once('value');
                const userData = userSnapshot.val();
                
                // Check if user is an admin
                if (userData && userData.role === 'admin') {
                    // Hide login, show main content
                    loginSection.classList.add('hidden');
                    mainContent.classList.remove('hidden');
                    // Initialize dashboard
                    loadDashboardData();
                } else {
                    console.error('User is not an admin');
                    showLoginError('Access denied. This interface is for admins only.');
                    auth.signOut();
                }
            } catch (error) {
                console.error('Error initializing admin:', error);
                showLoginError('Error initializing interface. Please try again.');
            }
        } else {
            // Show login, hide main content
            loginSection.classList.remove('hidden');
            mainContent.classList.add('hidden');
        }
    });

    // Handle login form submission
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = loginEmail.value.trim();
        const password = loginPassword.value;

        if (!email || !password) {
            showLoginError('Please fill in all fields.');
            return;
        }

        try {
            showLoginLoading(true);
            hideLoginMessages();

            // Sign in with Firebase Auth
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Check user role
            const userSnapshot = await database.ref('users/' + user.uid).once('value');
            const userData = userSnapshot.val();

            if (!userData || userData.role !== 'admin') {
                throw new Error('Access denied. This interface is for admins only.');
            }

        } catch (error) {
            console.error('Login error:', error);
            showLoginError(getLoginErrorMessage(error.code || error.message));
            if (auth.currentUser) {
                auth.signOut();
            }
        } finally {
            showLoginLoading(false);
        }
    });

    function showLoginError(message) {
        loginErrorMessage.textContent = message;
        loginErrorMessage.classList.remove('hidden');
    }

    function hideLoginMessages() {
        loginErrorMessage.classList.add('hidden');
    }

    function showLoginLoading(show) {
        if (show) {
            loginLoadingMessage.classList.remove('hidden');
            loginBtn.disabled = true;
            loginBtn.textContent = 'Processing...';
        } else {
            loginLoadingMessage.classList.add('hidden');
            loginBtn.disabled = false;
            loginBtn.textContent = 'Sign In';
        }
    }

    function getLoginErrorMessage(errorCode) {
        switch (errorCode) {
            case 'auth/user-not-found':
                return 'No account found with this email address.';
            case 'auth/wrong-password':
                return 'Incorrect password.';
            case 'auth/invalid-email':
                return 'Invalid email address.';
            case 'auth/user-disabled':
                return 'This account has been disabled.';
            case 'auth/too-many-requests':
                return 'Too many failed attempts. Please try again later.';
            default:
                return errorCode || 'An error occurred. Please try again.';
        }
    }

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
                    totalAllocated += allocation.amount;
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
            const usagePercent = ((user.usedBudget || 0) / (totalAllocated || 1)) * 100;
            const statusColor = usagePercent >= 90 ? 'text-red-600' : usagePercent >= 80 ? 'text-yellow-600' : 'text-green-600';
            
            return `
                <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                        <p class="font-medium text-gray-800">${user.email}</p>
                        <p class="text-sm text-gray-600">Total Budget: ${formatCurrency(totalAllocated)}</p>
                        <p class="text-sm text-gray-600">Used: ${formatCurrency(user.usedBudget || 0)}</p>
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
        const assignedTo = document.getElementById('assignedSubAdmin').value;

        if (!name) {
            showMessage('Please enter an item name.', 'error');
            return;
        }

        if (!assignedTo) {
            showMessage('Please select a sub-admin to assign this item to.', 'error');
            return;
        }

        try {
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Adding...';

            // Create new item
            const itemRef = database.ref('items').push();
            const itemId = itemRef.key;

            // Create the item with required fields
            await itemRef.set({
                name: name,
                price: 0, // Initial price will be 0
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                createdBy: auth.currentUser.uid
            });

            // Create the item assignment
            await database.ref(`items_assignments/${assignedTo}/${itemId}`).set({
                assigned: true,
                assignedAt: firebase.database.ServerValue.TIMESTAMP,
                assignedBy: auth.currentUser.uid
            });

            // Add a notification for the sub-admin
            const notificationRef = database.ref(`notifications/${assignedTo}`).push();
            await notificationRef.set({
                type: 'new_item',
                itemId: itemId,
                itemName: name,
                status: 'unread',
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });

            showMessage('Item added successfully!', 'success');
            
            // Reset form
            this.reset();
            
            // Reload items list
            await loadItems();
            
        } catch (error) {
            console.error('Error adding item:', error);
            showMessage('Error adding item: ' + error.message, 'error');
        } finally {
            const submitBtn = e.target.querySelector('button[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Add Item';
        }
    });

    async function loadItems() {
        try {
            // Check if itemsList element exists
            if (!itemsList) {
                console.error('Items list element not found');
                showMessage('Error: Items list element not found', 'error');
                return;
            }

            // Show loading state
            itemsList.innerHTML = '<div class="text-center py-4">Loading items...</div>';

            // Load items
            const itemsSnapshot = await database.ref('items').once('value');
            const items = itemsSnapshot.val() || {};
            
            // Clear existing items list
            itemsList.innerHTML = '';
            
            // Create items table
            const table = document.createElement('table');
            table.className = 'min-w-full divide-y divide-gray-200';
            
            // Add table header
            const thead = document.createElement('thead');
            thead.className = 'bg-gray-50';
            thead.innerHTML = `
                <tr>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
            `;
            table.appendChild(thead);
            
            // Add table body
            const tbody = document.createElement('tbody');
            tbody.className = 'bg-white divide-y divide-gray-200';
            
            try {
                // Get all sub-admins for assignment dropdown
                const subAdminsSnapshot = await database.ref('users').orderByChild('role').equalTo('subadmin').once('value');
                const subAdmins = subAdminsSnapshot.val() || {};
                
                // Get all item assignments
                const assignmentsSnapshot = await database.ref('items_assignments').once('value');
                const assignments = assignmentsSnapshot.val() || {};
                
                // Create rows for each item
                Object.entries(items).forEach(([itemId, item]) => {
                    const tr = document.createElement('tr');
                    
                    // Get current assignments for this item
                    const itemAssignments = Object.entries(assignments).reduce((acc, [subAdminId, subAdminAssignments]) => {
                        if (subAdminAssignments[itemId]?.assigned) {
                            acc.push(subAdminId);
                        }
                        return acc;
                    }, []);
                    
                    tr.innerHTML = `
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="text-sm font-medium text-gray-900">${item.name}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <div class="text-sm text-gray-900">${formatCurrency(item.price)}</div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                            <select class="item-assignment-select" data-item-id="${itemId}" multiple>
                                ${Object.entries(subAdmins).map(([subAdminId, subAdmin]) => `
                                    <option value="${subAdminId}" ${itemAssignments.includes(subAdminId) ? 'selected' : ''}>
                                        ${subAdmin.email}
                                    </option>
                                `).join('')}
                            </select>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button class="text-red-600 hover:text-red-900 delete-item-btn" data-item-id="${itemId}">Delete</button>
                        </td>
                    `;
                    
                    tbody.appendChild(tr);
                });
            } catch (error) {
                console.error('Error loading sub-admins or assignments:', error);
                showMessage('Error loading sub-admins or assignments: ' + error.message, 'error');
                return;
            }
            
            table.appendChild(tbody);
            itemsList.appendChild(table);
            
            // Add event listeners for assignment changes
            document.querySelectorAll('.item-assignment-select').forEach(select => {
                select.addEventListener('change', async function() {
                    const itemId = this.dataset.itemId;
                    const selectedSubAdmins = Array.from(this.selectedOptions).map(option => option.value);
                    
                    try {
                        // Get all sub-admins
                        const updates = {};
                        
                        // First, set all assignments for this item to false
                        Object.keys(subAdmins).forEach(subAdminId => {
                            updates[`items_assignments/${subAdminId}/${itemId}/assigned`] = false;
                        });
                        
                        // Then set selected assignments to true
                        selectedSubAdmins.forEach(subAdminId => {
                            updates[`items_assignments/${subAdminId}/${itemId}/assigned`] = true;
                        });
                        
                        // Update the database
                        await database.ref().update(updates);
                        
                        showMessage('Item assignments updated successfully');
                    } catch (error) {
                        console.error('Error updating item assignments:', error);
                        showMessage('Error updating item assignments: ' + error.message, 'error');
                    }
                });
            });
            
            // Add event listeners for delete buttons
            document.querySelectorAll('.delete-item-btn').forEach(button => {
                button.addEventListener('click', async function() {
                    const itemId = this.dataset.itemId;
                    if (confirm('Are you sure you want to delete this item? This action cannot be undone.')) {
                        try {
                            // Delete item and all its assignments
                            const updates = {
                                [`items/${itemId}`]: null
                            };
                            
                            // Remove all assignments for this item
                            Object.keys(subAdmins).forEach(subAdminId => {
                                updates[`items_assignments/${subAdminId}/${itemId}`] = null;
                            });
                            
                            await database.ref().update(updates);
                            
                            showMessage('Item deleted successfully');
                            loadItems(); // Reload the items list
                        } catch (error) {
                            console.error('Error deleting item:', error);
                            showMessage('Error deleting item: ' + error.message, 'error');
                        }
                    }
                });
            });

            // Show empty state if no items
            if (Object.keys(items).length === 0) {
                itemsList.innerHTML = '<div class="text-center py-4 text-gray-500">No items found</div>';
            }
            
        } catch (error) {
            console.error('Error loading items:', error);
            showMessage('Error loading items: ' + error.message, 'error');
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

    window.deleteItem = async function(itemId, itemName) {
        if (!confirm(`Are you sure you want to delete "${itemName}"?`)) return;

        try {
            await database.ref(`items/${itemId}`).remove();
            showMessage('Item deleted successfully!', 'success');
            await loadItems();
        } catch (error) {
            console.error('Error deleting item:', error);
            showMessage('Error deleting item. Please try again.', 'error');
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
    window.reassignItem = async function(itemId, itemName, currentAssignedTo) {
        try {
            const newAssignedTo = prompt('Enter the UID of the sub-admin to reassign this item to:');
            if (!newAssignedTo) return;

            // Check if the new assignee exists and is a sub-admin
            const userSnapshot = await database.ref(`users/${newAssignedTo}`).once('value');
            const userData = userSnapshot.val();
            
            if (!userData || userData.role !== 'subadmin') {
                showMessage('Invalid sub-admin UID. Please try again.', 'error');
                return;
            }

            // Update item assignment
            await database.ref(`items/${itemId}`).update({
                assignedTo: newAssignedTo,
                reassignedAt: firebase.database.ServerValue.TIMESTAMP,
                reassignedBy: auth.currentUser.uid
            });

            // Add notifications
            const notifications = {};
            // Notification for new assignee
            notifications[`notifications/${newAssignedTo}/${database.ref().push().key}`] = {
                type: 'item_assigned',
                itemId: itemId,
                itemName: itemName,
                status: 'unread',
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };
            // Notification for previous assignee
            notifications[`notifications/${currentAssignedTo}/${database.ref().push().key}`] = {
                type: 'item_unassigned',
                itemId: itemId,
                itemName: itemName,
                status: 'unread',
                timestamp: firebase.database.ServerValue.TIMESTAMP
            };

            await database.ref().update(notifications);

            showMessage('Item reassigned successfully!', 'success');
            await loadItems();
        } catch (error) {
            console.error('Error reassigning item:', error);
            showMessage('Error reassigning item. Please try again.', 'error');
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

