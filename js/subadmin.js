// Sub Admin Module
class SubAdminDashboard {
    constructor() {
        this.cart = [];
        this.userData = null;
        this.listeners = [];
        this.userRole = null;
        this.init();
    }

    init() {
        // Check if user is sub admin
        auth.onAuthStateChanged(async (user) => {
            if (user) {
                try {
                    // Wait for role to be loaded
                    let retryCount = 0;
                    let role = null;
                    
                    while (!role && retryCount < 3) {
                        role = await authManager.getUserRole(user.uid);
                        if (!role) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            retryCount++;
                        }
                    }
                    
                    if (role !== 'sub_admin') {
                        console.warn('User does not have sub_admin role:', role);
                        window.location.href = 'login.html';
                        return;
                    }
                    
                    // Store the role locally
                    this.userRole = role;
                    this.setupDashboard(user);
                } catch (error) {
                    console.error('Error during initialization:', error);
                    window.location.href = 'login.html';
                }
            } else {
                window.location.href = 'login.html';
            }
        });

        this.setupEventListeners();
        this.loadCart();
    }

    setupDashboard(user) {
        // Update user info
        document.getElementById('userEmail').textContent = user.email;

        // Load user data and setup real-time listeners
        this.loadUserData(user.uid);
        this.setupRealtimeListeners(user.uid);
        this.loadSuggestedItems();
        this.loadPurchaseHistory(user.uid);
    }

    setupEventListeners() {
        // Add item form
        document.getElementById('addItemForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addItemToCart();
        });

        // Cart toggle
        document.getElementById('cartToggle').addEventListener('click', () => {
            this.openCart();
        });

        document.getElementById('closeCart').addEventListener('click', () => {
            this.closeCart();
        });

        document.getElementById('cartOverlay').addEventListener('click', () => {
            this.closeCart();
        });

        // Cart actions
        document.getElementById('submitPurchase').addEventListener('click', () => {
            this.submitPurchase();
        });

        document.getElementById('clearCart').addEventListener('click', () => {
            this.clearCart();
        });

        // Return funds
        document.getElementById('returnFunds').addEventListener('click', () => {
            this.returnFunds();
        });

        // Refresh history
        document.getElementById('refreshHistory').addEventListener('click', () => {
            this.loadPurchaseHistory(auth.currentUser.uid);
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', async () => {
            const result = await authManager.logout();
            if (result.success) {
                window.location.href = 'login.html';
            }
        });

        // Toast close
        document.getElementById('closeToast').addEventListener('click', () => {
            this.hideToast();
        });
    }

    async loadUserData(uid) {
        try {
            const snapshot = await dbRefs.users.child(uid).once('value');
            this.userData = snapshot.val();
            
            if (this.userData) {
                this.updateBalanceDisplay();
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            this.showToast('Error loading user data', 'error');
        }
    }

    updateBalanceDisplay() {
        if (!this.userData) return;

        const allocated = this.userData.allocated || 0;
        const used = this.userData.used || 0;
        const remaining = allocated - used;
        const usagePercent = dbHelpers.calculatePercentage(used, allocated);

        // Update amounts
        document.getElementById('allocatedAmount').textContent = dbHelpers.formatCurrency(allocated);
        document.getElementById('usedAmount').textContent = dbHelpers.formatCurrency(used);
        document.getElementById('remainingAmount').textContent = dbHelpers.formatCurrency(remaining);

        // Update progress bar
        document.getElementById('usageProgress').style.width = `${Math.min(usagePercent, 100)}%`;
        document.getElementById('usagePercentage').textContent = `${usagePercent}%`;

        // Update status indicator and alerts
        this.updateStatusIndicator(usagePercent);
        this.showUsageAlert(usagePercent);
    }

    updateStatusIndicator(usagePercent) {
        const statusElement = document.getElementById('balanceStatus');
        
        if (usagePercent >= 90) {
            statusElement.className = 'w-3 h-3 rounded-full bg-red-400 pulse-animation';
        } else if (usagePercent >= 70) {
            statusElement.className = 'w-3 h-3 rounded-full bg-yellow-400 pulse-animation';
        } else {
            statusElement.className = 'w-3 h-3 rounded-full bg-green-400';
        }
    }

    showUsageAlert(usagePercent) {
        const alertElement = document.getElementById('alertMessage');
        const alertIcon = document.getElementById('alertIcon');
        const alertText = document.getElementById('alertText');

        if (usagePercent >= 90) {
            alertElement.className = 'mb-4 p-4 rounded-lg bg-red-50 border border-red-200';
            alertIcon.className = 'fas fa-exclamation-triangle text-red-600';
            alertText.textContent = 'Critical: You have used 90% or more of your allocated budget!';
            alertText.className = 'font-medium text-red-800';
            alertElement.classList.remove('hidden');
        } else if (usagePercent >= 70) {
            alertElement.className = 'mb-4 p-4 rounded-lg bg-yellow-50 border border-yellow-200';
            alertIcon.className = 'fas fa-exclamation-circle text-yellow-600';
            alertText.textContent = 'Warning: You have used 70% or more of your allocated budget.';
            alertText.className = 'font-medium text-yellow-800';
            alertElement.classList.remove('hidden');
        } else {
            alertElement.classList.add('hidden');
        }
    }

    addItemToCart() {
        const name = document.getElementById('itemName').value.trim();
        const price = parseFloat(document.getElementById('itemPrice').value);
        const quantity = parseInt(document.getElementById('itemQuantity').value);
        const category = document.getElementById('itemCategory').value;

        if (!name || !price || !quantity || price <= 0 || quantity <= 0) {
            this.showToast('Please fill in all required fields with valid values', 'error');
            return;
        }

        const item = {
            id: Date.now().toString(),
            name: name,
            price: price,
            quantity: quantity,
            category: category,
            total: price * quantity,
            addedAt: new Date().toISOString()
        };

        // Check if adding this item would exceed remaining budget
        const cartTotal = this.getCartTotal() + item.total;
        const remaining = (this.userData.allocated || 0) - (this.userData.used || 0);
        
        if (cartTotal > remaining) {
            this.showToast('Adding this item would exceed your remaining budget', 'error');
            return;
        }

        this.cart.push(item);
        this.saveCart();
        this.updateCartDisplay();
        this.clearForm();
        
        this.showToast(`${name} added to cart`, 'success');
    }

    clearForm() {
        document.getElementById('addItemForm').reset();
        document.getElementById('itemQuantity').value = '1';
    }

    updateCartDisplay() {
        const cartItems = document.getElementById('cartItems');
        const emptyCart = document.getElementById('emptyCart');
        const cartFooter = document.getElementById('cartFooter');
        const cartBadge = document.getElementById('cartBadge');
        const cartTotal = document.getElementById('cartTotal');
        const bottomCartTotal = document.getElementById('bottomCartTotal');

        if (this.cart.length === 0) {
            emptyCart.classList.remove('hidden');
            cartFooter.classList.add('hidden');
            cartBadge.classList.add('hidden');
            cartTotal.textContent = '$0.00';
            bottomCartTotal.textContent = '$0.00';
            return;
        }

        emptyCart.classList.add('hidden');
        cartFooter.classList.remove('hidden');
        cartBadge.classList.remove('hidden');
        cartBadge.textContent = this.cart.length;

        const total = this.getCartTotal();
        cartTotal.textContent = dbHelpers.formatCurrency(total);
        bottomCartTotal.textContent = dbHelpers.formatCurrency(total);

        cartItems.innerHTML = '';
        this.cart.forEach((item, index) => {
            const cartItem = document.createElement('div');
            cartItem.className = 'bg-gray-50 rounded-lg p-3 cart-animation';
            cartItem.innerHTML = `
                <div class="flex items-start justify-between">
                    <div class="flex-1">
                        <h4 class="font-medium text-gray-900">${item.name}</h4>
                        <p class="text-sm text-gray-600">
                            ${dbHelpers.formatCurrency(item.price)} × ${item.quantity}
                            ${item.category ? `• ${item.category}` : ''}
                        </p>
                        <p class="text-sm font-medium text-indigo-600">${dbHelpers.formatCurrency(item.total)}</p>
                    </div>
                    <button 
                        onclick="subAdminDashboard.removeFromCart(${index})" 
                        class="text-red-500 hover:text-red-700 ml-2"
                    >
                        <i class="fas fa-trash text-sm"></i>
                    </button>
                </div>
            `;
            cartItems.appendChild(cartItem);
        });
    }

    removeFromCart(index) {
        if (index >= 0 && index < this.cart.length) {
            const item = this.cart[index];
            this.cart.splice(index, 1);
            this.saveCart();
            this.updateCartDisplay();
            this.showToast(`${item.name} removed from cart`, 'info');
        }
    }

    clearCart() {
        this.cart = [];
        this.saveCart();
        this.updateCartDisplay();
        this.showToast('Cart cleared', 'info');
    }

    getCartTotal() {
        return this.cart.reduce((total, item) => total + item.total, 0);
    }

    async submitPurchase() {
        if (this.cart.length === 0) {
            this.showToast('Your cart is empty', 'error');
            return;
        }

        const total = this.getCartTotal();
        const remaining = (this.userData.allocated || 0) - (this.userData.used || 0);

        if (total > remaining) {
            this.showToast('Purchase total exceeds your remaining budget', 'error');
            return;
        }

        try {
            // Ensure auth is initialized and user has correct role
            if (!auth.currentUser) {
                throw new Error('Not authenticated');
            }
            
            // Check locally stored role first
            if (this.userRole !== 'sub_admin') {
                // Double check with server
                const currentRole = await authManager.getUserRole(auth.currentUser.uid);
                if (currentRole !== 'sub_admin') {
                    throw new Error('Invalid permissions');
                }
                // Update local role
                this.userRole = currentRole;
            }

            const purchaseId = dbHelpers.generateId();
            const uid = auth.currentUser.uid;

            // Create purchase record
            const purchaseData = {
                id: purchaseId,
                userId: uid,
                items: this.cart,
                total: total,
                timestamp: dbHelpers.getTimestamp(),
                status: 'submitted'
            };

            // Verify authentication
            if (!auth.currentUser) {
                throw new Error('Not authenticated');
            }

            try {
                // Start a transaction to ensure data consistency
                const newUsedAmount = (this.userData.used || 0) + total;
                const timestamp = dbHelpers.getTimestamp();

                // First update the user's used amount
                await dbRefs.users.child(uid).update({
                    used: newUsedAmount,
                    lastPurchase: timestamp
                });

                // Then create the purchase record
                purchaseData.status = 'completed';  // Mark as completed immediately
                purchaseData.completedAt = timestamp;
                await dbRefs.purchases.child(purchaseId).set(purchaseData);
                
                // Log the action
                await authManager.logAction('purchase_completed', {
                    purchaseId: purchaseId,
                    total: total,
                    itemCount: this.cart.length,
                    newUsedAmount: newUsedAmount
                });

                // Update local user data
                this.userData.used = newUsedAmount;
                this.userData.lastPurchase = timestamp;
                
            } catch (error) {
                console.error('Purchase operation failed:', error);
                
                // Create failed purchase record if it doesn't exist
                try {
                    await dbRefs.purchases.child(purchaseId).set({
                        ...purchaseData,
                        status: 'failed',
                        error: error.message
                    });
                    
                    // Log the failure
                    await authManager.logAction('purchase_failed', {
                        purchaseId: purchaseId,
                        total: total,
                        error: error.message
                    });
                } catch (logError) {
                    console.warn('Failed to log purchase failure:', logError);
                }
                
                throw error;
            }

            // Log the action only after successful update
            await authManager.logAction('purchase_made', {
                purchaseId: purchaseId,
                total: total,
                itemCount: this.cart.length
            });

            // Clear cart and close sidebar
            this.clearCart();
            this.closeCart();
            
            this.showToast(`Purchase submitted successfully! Total: ${dbHelpers.formatCurrency(total)}`, 'success');

            // Reload user data
            this.loadUserData(uid);

        } catch (error) {
            console.error('Error submitting purchase:', error);
            let errorMessage = 'Error submitting purchase. ';
            
            if (error.message === 'Not authenticated') {
                errorMessage += 'Please refresh the page and try again.';
            } else if (error.message.includes('PERMISSION_DENIED')) {
                errorMessage += 'Please wait a moment and try again.';
                // Reload user data to ensure we have latest permissions
                if (auth.currentUser) {
                    try {
                        await this.loadUserData(auth.currentUser.uid);
                        // If we successfully reload data, try the purchase again
                        setTimeout(() => this.submitPurchase(), 1000);
                        return;
                    } catch (reloadError) {
                        console.warn('Failed to reload user data:', reloadError);
                    }
                }
            } else {
                errorMessage += 'Please try again.';
            }
            
            this.showToast(errorMessage, 'error');
            
            // Always reload data after an error
            if (auth.currentUser) {
                try {
                    // Small delay before reloading data
                    await new Promise(resolve => setTimeout(resolve, 500));
                    await this.loadUserData(auth.currentUser.uid);
                    await this.loadPurchaseHistory(auth.currentUser.uid);
                } catch (reloadError) {
                    console.warn('Failed to reload data:', reloadError);
                }
            }
        }
    }

    async returnFunds() {
        if (!this.userData || (this.userData.allocated || 0) === 0) {
            this.showToast('No funds to return', 'error');
            return;
        }

        const remaining = (this.userData.allocated || 0) - (this.userData.used || 0);
        
        if (remaining <= 0) {
            this.showToast('No remaining funds to return', 'error');
            return;
        }

        if (!confirm(`Are you sure you want to return ${dbHelpers.formatCurrency(remaining)} to the admin?`)) {
            return;
        }

        try {
            const uid = auth.currentUser.uid;

            // Update user's allocation to match used amount
            await dbRefs.users.child(uid).update({
                allocated: this.userData.used || 0,
                lastReturn: dbHelpers.getTimestamp()
            });

            // Log the action
            await authManager.logAction('funds_returned', {
                userId: uid,
                returnedAmount: remaining
            });

            this.showToast(`Successfully returned ${dbHelpers.formatCurrency(remaining)}`, 'success');

            // Reload user data
            this.loadUserData(uid);

        } catch (error) {
            console.error('Error returning funds:', error);
            this.showToast('Error returning funds. Please try again.', 'error');
        }
    }

    async loadSuggestedItems() {
        try {
            const snapshot = await dbRefs.suggestions.once('value');
            const suggestions = snapshot.val() || {};
            const container = document.getElementById('suggestedItems');

            container.innerHTML = '';

            const suggestionList = Object.values(suggestions);
            
            if (suggestionList.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-4 text-gray-500">
                        <i class="fas fa-lightbulb text-2xl mb-2"></i>
                        <p>No suggestions available</p>
                    </div>
                `;
                return;
            }

            suggestionList.forEach(suggestion => {
                const suggestionItem = document.createElement('div');
                suggestionItem.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg';
                suggestionItem.innerHTML = `
                    <div class="flex-1">
                        <h4 class="font-medium text-gray-900">${suggestion.name}</h4>
                        <p class="text-sm text-gray-600">${dbHelpers.formatCurrency(suggestion.price)}</p>
                        ${suggestion.description ? `<p class="text-xs text-gray-500">${suggestion.description}</p>` : ''}
                    </div>
                    <button 
                        onclick="subAdminDashboard.addSuggestedItem('${suggestion.name}', ${suggestion.price}, '${suggestion.category || ''}')"
                        class="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg hover:bg-indigo-200 transition duration-200"
                    >
                        <i class="fas fa-plus text-sm"></i>
                    </button>
                `;
                container.appendChild(suggestionItem);
            });

        } catch (error) {
            console.error('Error loading suggested items:', error);
        }
    }

    addSuggestedItem(name, price, category) {
        document.getElementById('itemName').value = name;
        document.getElementById('itemPrice').value = price;
        document.getElementById('itemCategory').value = category;
        
        // Scroll to form
        document.getElementById('addItemForm').scrollIntoView({ behavior: 'smooth' });
        
        this.showToast('Item details filled in form', 'info');
    }

    async loadPurchaseHistory(uid) {
        try {
            const snapshot = await dbRefs.purchases.orderByChild('userId').equalTo(uid).once('value');
            const purchases = snapshot.val() || {};
            const container = document.getElementById('purchaseHistory');

            container.innerHTML = '';

            const purchaseList = Object.entries(purchases).sort((a, b) => 
                new Date(b[1].timestamp) - new Date(a[1].timestamp)
            );

            if (purchaseList.length === 0) {
                container.innerHTML = `
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-history text-2xl mb-2"></i>
                        <p>No purchase history</p>
                    </div>
                `;
                return;
            }

            purchaseList.forEach(([purchaseId, purchase]) => {
                const purchaseItem = document.createElement('div');
                purchaseItem.className = 'border border-gray-200 rounded-lg p-4';
                
                const date = new Date(purchase.timestamp).toLocaleDateString();
                const time = new Date(purchase.timestamp).toLocaleTimeString();
                
                purchaseItem.innerHTML = `
                    <div class="flex items-center justify-between mb-2">
                        <div>
                            <p class="font-medium text-gray-900">${dbHelpers.formatCurrency(purchase.total)}</p>
                            <p class="text-sm text-gray-600">${date} at ${time}</p>
                        </div>
                        <span class="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                            ${purchase.status || 'Submitted'}
                        </span>
                    </div>
                    <div class="space-y-1">
                        ${purchase.items.map(item => `
                            <div class="flex justify-between text-sm">
                                <span class="text-gray-600">${item.name} (×${item.quantity})</span>
                                <span class="text-gray-900">${dbHelpers.formatCurrency(item.total)}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
                container.appendChild(purchaseItem);
            });

        } catch (error) {
            console.error('Error loading purchase history:', error);
        }
    }

    setupRealtimeListeners(uid) {
        // Listen for user data changes
        const userListener = dbRefs.users.child(uid).on('value', (snapshot) => {
            this.userData = snapshot.val();
            if (this.userData) {
                this.updateBalanceDisplay();
            }
        });
        this.listeners.push(() => dbRefs.users.child(uid).off('value', userListener));

        // Listen for suggestion changes
        const suggestionsListener = dbRefs.suggestions.on('value', () => {
            this.loadSuggestedItems();
        });
        this.listeners.push(() => dbRefs.suggestions.off('value', suggestionsListener));
    }

    openCart() {
        document.getElementById('cartSidebar').classList.remove('translate-x-full');
        document.getElementById('cartOverlay').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    closeCart() {
        document.getElementById('cartSidebar').classList.add('translate-x-full');
        document.getElementById('cartOverlay').classList.add('hidden');
        document.body.style.overflow = 'auto';
    }

    saveCart() {
        localStorage.setItem('budgetTracker_cart', JSON.stringify(this.cart));
    }

    loadCart() {
        const savedCart = localStorage.getItem('budgetTracker_cart');
        if (savedCart) {
            try {
                this.cart = JSON.parse(savedCart);
                this.updateCartDisplay();
            } catch (error) {
                console.error('Error loading cart from localStorage:', error);
                this.cart = [];
            }
        }
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        const toastIcon = document.getElementById('toastIcon');
        const toastMessage = document.getElementById('toastMessage');

        const icons = {
            'success': '<i class="fas fa-check-circle text-green-600"></i>',
            'error': '<i class="fas fa-exclamation-circle text-red-600"></i>',
            'warning': '<i class="fas fa-exclamation-triangle text-yellow-600"></i>',
            'info': '<i class="fas fa-info-circle text-blue-600"></i>'
        };

        toastIcon.innerHTML = icons[type] || icons['info'];
        toastMessage.textContent = message;
        
        toast.classList.remove('hidden');
        
        // Auto hide after 5 seconds
        setTimeout(() => {
            this.hideToast();
        }, 5000);
    }

    hideToast() {
        document.getElementById('toast').classList.add('hidden');
    }

    destroy() {
        // Clean up listeners
        this.listeners.forEach(cleanup => cleanup());
        this.listeners = [];
    }
}

// Initialize sub admin dashboard
let subAdminDashboard;
document.addEventListener('DOMContentLoaded', () => {
    subAdminDashboard = new SubAdminDashboard();
});

// Export for global use
window.subAdminDashboard = subAdminDashboard;

// Navigation functionality
const menuToggle = document.getElementById('menuToggle');
const navSidebar = document.getElementById('navSidebar');
const navOverlay = document.getElementById('navOverlay');
const mainContent = document.getElementById('mainContent');
const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');

// Section management
const sections = {
    dashboard: document.getElementById('dashboardSection'),
    'add-purchase': document.getElementById('addPurchaseSection'),
    suggestions: document.getElementById('suggestionsSection'),
    history: document.getElementById('historySection')
};

// Show active section and hide others
function showSection(sectionId) {
    Object.entries(sections).forEach(([id, element]) => {
        if (id === sectionId) {
            element.classList.remove('hidden');
        } else {
            element.classList.add('hidden');
        }
    });
}

// Handle sidebar toggle
function toggleSidebar() {
    navSidebar.classList.toggle('active');
    navOverlay.classList.toggle('hidden');
    mainContent.classList.toggle('shifted');
}

menuToggle.addEventListener('click', toggleSidebar);
navOverlay.addEventListener('click', toggleSidebar);

// Handle navigation items
const navItems = document.querySelectorAll('.nav-item');
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        // Get section ID from href
        const sectionId = item.getAttribute('href').replace('#', '');
        
        // Show corresponding section
        showSection(sectionId);
        
        // Update active state
        navItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        // Close sidebar on mobile
        if (window.innerWidth <= 768) {
            toggleSidebar();
        }
    });
});

// Show dashboard by default
showSection('dashboard');

// Handle logout from sidebar
sidebarLogoutBtn.addEventListener('click', () => {
    firebase.auth().signOut()
        .then(() => {
            window.location.href = 'login.html';
        })
        .catch((error) => {
            showToast('error', 'Error logging out: ' + error.message);
        });
});

