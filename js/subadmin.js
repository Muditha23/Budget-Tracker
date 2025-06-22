// Sub Admin Interface Implementation
document.addEventListener('DOMContentLoaded', function() {
    // UI Elements
    const loginSection = document.getElementById('loginSection');
    const mainContent = document.getElementById('mainContent');
    const loginForm = document.getElementById('loginForm');
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const loginBtn = document.getElementById('loginBtn');
    const loginErrorMessage = document.getElementById('loginErrorMessage');
    const loginLoadingMessage = document.getElementById('loginLoadingMessage');
    const predefinedTab = document.getElementById('predefinedTab');
    const customTab = document.getElementById('customTab');
    const predefinedForm = document.getElementById('predefinedForm');
    const customForm = document.getElementById('customForm');
    const predefinedItem = document.getElementById('predefinedItem');
    const predefinedPrice = document.getElementById('predefinedPrice');
    const predefinedQuantity = document.getElementById('predefinedQuantity');
    const customItemName = document.getElementById('customItemName');
    const customPrice = document.getElementById('customPrice');
    const customQuantity = document.getElementById('customQuantity');
    const addPredefinedBtn = document.getElementById('addPredefinedBtn');
    const addCustomBtn = document.getElementById('addCustomBtn');
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    const submitPurchase = document.getElementById('submitPurchase');
    const logoutBtn = document.getElementById('logoutBtn');
    const allocatedAmount = document.getElementById('allocatedAmount');
    const remainingAmount = document.getElementById('remainingAmount');
    const usagePercentage = document.getElementById('usagePercentage');
    const usageBar = document.getElementById('usageBar');

    // Cart state
    let cart = [];
    let predefinedItems = {};
    let userData = null;
    let currentUser = null;

    // Initialize Firebase Auth
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            try {
                currentUser = user;
                // Get user data
                const userSnapshot = await database.ref('users/' + user.uid).once('value');
                userData = userSnapshot.val();
                
                // Check if user is a sub-admin
                if (userData && userData.role === 'subadmin') {
                    // Hide login, show main content
                    loginSection.classList.add('hidden');
                    mainContent.classList.remove('hidden');
                    // Initialize interface
                    initializeSubAdminInterface(userData);
                } else {
                    console.error('User is not a sub-admin');
                    showLoginError('Access denied. This interface is for sub-admins only.');
                    auth.signOut();
                }
            } catch (error) {
                console.error('Error initializing sub-admin:', error);
                showLoginError('Error initializing interface. Please try again.');
            }
        } else {
            currentUser = null;
            userData = null;
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
            userData = userSnapshot.val();

            if (!userData || userData.role !== 'subadmin') {
                throw new Error('Access denied. This interface is for sub-admins only.');
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

    // Tab switching
    predefinedTab.addEventListener('click', () => switchTab('predefined'));
    customTab.addEventListener('click', () => switchTab('custom'));

    function switchTab(tab) {
        if (tab === 'predefined') {
            predefinedTab.classList.add('bg-blue-600', 'text-white');
            predefinedTab.classList.remove('text-gray-600');
            customTab.classList.remove('bg-blue-600', 'text-white');
            customTab.classList.add('text-gray-600');
            predefinedForm.classList.remove('hidden');
            customForm.classList.add('hidden');
        } else {
            customTab.classList.add('bg-blue-600', 'text-white');
            customTab.classList.remove('text-gray-600');
            predefinedTab.classList.remove('bg-blue-600', 'text-white');
            predefinedTab.classList.add('text-gray-600');
            customForm.classList.remove('hidden');
            predefinedForm.classList.add('hidden');
        }
    }

    // Predefined item selection
    predefinedItem.addEventListener('change', function() {
        const selectedItemId = this.value;
        if (selectedItemId && predefinedItems[selectedItemId]) {
            predefinedPrice.value = formatCurrency(predefinedItems[selectedItemId].price);
        } else {
            predefinedPrice.value = '';
        }
    });

    // Add predefined item to cart
    addPredefinedBtn.addEventListener('click', function() {
        const selectedItemId = predefinedItem.value;
        const quantity = parseInt(predefinedQuantity.value) || 1;

        if (!selectedItemId) {
            showMessage('Please select an item.', 'error');
            return;
        }

        const item = predefinedItems[selectedItemId];
        addToCart({
            id: selectedItemId,
            name: item.name,
            price: item.price,
            quantity: quantity,
            type: 'predefined'
        });

        // Reset form
        predefinedItem.value = '';
        predefinedPrice.value = '';
        predefinedQuantity.value = 1;
    });

    // Add custom item to cart
    addCustomBtn.addEventListener('click', function() {
        const name = customItemName.value.trim();
        const price = parseFloat(customPrice.value) || 0;
        const quantity = parseInt(customQuantity.value) || 1;

        if (!name) {
            showMessage('Please enter an item name.', 'error');
            return;
        }

        if (price <= 0) {
            showMessage('Please enter a valid price.', 'error');
            return;
        }

        addToCart({
            id: 'custom_' + Date.now(),
            name: name,
            price: price,
            quantity: quantity,
            type: 'custom'
        });

        // Reset form
        customItemName.value = '';
        customPrice.value = '';
        customQuantity.value = 1;
    });

    function addToCart(item) {
        // Check if item already exists in cart
        const existingIndex = cart.findIndex(cartItem => 
            cartItem.id === item.id || (cartItem.type === 'custom' && cartItem.name === item.name)
        );

        if (existingIndex !== -1) {
            // Update quantity
            cart[existingIndex].quantity += item.quantity;
        } else {
            // Add new item
            cart.push(item);
        }

        updateCartDisplay();
        updateSubmitButton();
    }

    function removeFromCart(index) {
        cart.splice(index, 1);
        updateCartDisplay();
        updateSubmitButton();
    }

    function updateCartQuantity(index, newQuantity) {
        if (newQuantity <= 0) {
            removeFromCart(index);
        } else {
            cart[index].quantity = newQuantity;
            updateCartDisplay();
            updateSubmitButton();
        }
    }

    function updateCartDisplay() {
        if (cart.length === 0) {
            cartItems.innerHTML = '<p class="text-gray-500 text-center py-4">Your cart is empty</p>';
            cartTotal.textContent = '$0.00';
            return;
        }

        const cartHTML = cart.map((item, index) => `
            <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div class="flex-1">
                    <h4 class="font-medium text-gray-800">${item.name}</h4>
                    <p class="text-sm text-gray-600">${formatCurrency(item.price)} each</p>
                </div>
                <div class="flex items-center space-x-2">
                    <button onclick="updateCartQuantity(${index}, ${item.quantity - 1})" 
                            class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors">
                        -
                    </button>
                    <span class="w-8 text-center font-medium">${item.quantity}</span>
                    <button onclick="updateCartQuantity(${index}, ${item.quantity + 1})" 
                            class="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center hover:bg-gray-300 transition-colors">
                        +
                    </button>
                    <button onclick="removeFromCart(${index})" 
                            class="w-8 h-8 bg-red-200 text-red-600 rounded-full flex items-center justify-center hover:bg-red-300 transition-colors ml-2">
                        ×
                    </button>
                </div>
            </div>
        `).join('');

        cartItems.innerHTML = cartHTML;

        // Update total
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        cartTotal.textContent = formatCurrency(total);

        // Update budget display
        updateBudgetDisplay(total);
    }

    function updateBudgetDisplay(cartTotal = 0) {
        if (!userData) return;

        // Get total allocated and used budget
        const totalAllocated = userData.totalAllocated || 0;
        const usedBudget = userData.usedBudget || 0;
        const remaining = totalAllocated - usedBudget;
        const potentialUsed = usedBudget + cartTotal;
        const potentialRemaining = totalAllocated - potentialUsed;
        const usagePercent = (potentialUsed / totalAllocated) * 100;

        // Update UI elements
        allocatedAmount.textContent = formatCurrency(totalAllocated);
        remainingAmount.textContent = formatCurrency(potentialRemaining);
        usagePercentage.textContent = Math.round(usagePercent) + '%';

        // Update usage bar color based on percentage
        usageBar.style.width = Math.min(usagePercent, 100) + '%';
        
        if (usagePercent >= 90) {
            usageBar.className = 'bg-red-500 h-2 rounded-full transition-all duration-300';
            remainingAmount.className = 'text-xl font-bold text-red-600';
        } else if (usagePercent >= 80) {
            usageBar.className = 'bg-yellow-500 h-2 rounded-full transition-all duration-300';
            remainingAmount.className = 'text-xl font-bold text-yellow-600';
        } else {
            usageBar.className = 'bg-green-500 h-2 rounded-full transition-all duration-300';
            remainingAmount.className = 'text-xl font-bold text-green-600';
        }
    }

    function updateSubmitButton() {
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const totalAllocated = userData?.totalAllocated || 0;
        const canSubmit = cart.length > 0 && userData && (userData.usedBudget + total <= totalAllocated);

        if (canSubmit) {
            submitPurchase.disabled = false;
            submitPurchase.className = 'w-full bg-blue-600 text-white py-4 px-4 rounded-lg font-medium text-lg hover:bg-blue-700 transition-colors';
            submitPurchase.textContent = `Submit Purchase (${formatCurrency(total)})`;
        } else {
            submitPurchase.disabled = true;
            if (cart.length === 0) {
                submitPurchase.className = 'w-full bg-gray-400 text-white py-4 px-4 rounded-lg font-medium text-lg disabled:cursor-not-allowed';
                submitPurchase.textContent = 'Add items to cart';
            } else {
                submitPurchase.className = 'w-full bg-red-400 text-white py-4 px-4 rounded-lg font-medium text-lg disabled:cursor-not-allowed';
                submitPurchase.textContent = 'Insufficient Budget';
            }
        }
    }

    // Submit purchase
    submitPurchase.addEventListener('click', async function() {
        if (cart.length === 0) return;

        try {
            this.disabled = true;
            this.textContent = 'Processing...';

            // Create a new purchase entry
            const purchaseRef = database.ref('purchases/' + currentUser.uid).push();
            const timestamp = firebase.database.ServerValue.TIMESTAMP;

            // Calculate total amount
            const totalAmount = cart.reduce((total, item) => total + (item.price * item.quantity), 0);

            // Create purchase data
            const purchaseData = {
                items: cart.map(item => ({
                    id: item.id,
                    name: item.name,
                    price: item.price,
                    quantity: item.quantity,
                    type: item.type
                })),
                totalAmount: totalAmount,
                timestamp: timestamp,
                userId: currentUser.uid,
                userEmail: currentUser.email
            };

            // Update user's used budget
            const userRef = database.ref('users/' + currentUser.uid);
            const currentUsedBudget = userData.usedBudget || 0;
            const newUsedBudget = currentUsedBudget + totalAmount;

            // Perform the updates
            await Promise.all([
                purchaseRef.set(purchaseData),
                userRef.update({ usedBudget: newUsedBudget })
            ]);
            
            showMessage('Purchase submitted successfully!', 'success');
            
            // Clear cart and update display
            cart = [];
            updateCartDisplay();
            updateSubmitButton();
            
            // Refresh user data
            const userSnapshot = await database.ref('users/' + currentUser.uid).once('value');
            userData = userSnapshot.val();
            updateBudgetDisplay();

        } catch (error) {
            console.error('Error submitting purchase:', error);
            showMessage(error.message || 'Error submitting purchase. Please try again.', 'error');
        } finally {
            updateSubmitButton();
        }
    });

    // Logout
    logoutBtn.addEventListener('click', async () => {
        try {
            await auth.signOut();
        } catch (error) {
            console.error('Error signing out:', error);
            showMessage('Error signing out. Please try again.', 'error');
        }
    });

    // Global functions for cart management (called from HTML)
    window.updateCartQuantity = updateCartQuantity;
    window.removeFromCart = removeFromCart;

    // Initialize interface when user data is available
    window.initializeSubAdminInterface = function(userDataParam) {
        userData = userDataParam;
        updateBudgetDisplay();
        setupItemsListener();
    };

    // Setup real-time listener for items
    function setupItemsListener() {
        if (!currentUser) {
            console.error('User not authenticated');
            return;
        }

        // Remove any existing listener
        if (window.itemsRef) {
            window.itemsRef.off();
        }

        // Create a new reference and listener
        window.itemsRef = database.ref('items');
        window.itemsRef.orderByChild('assignedTo').equalTo(currentUser.uid)
            .on('value', async (snapshot) => {
                try {
                    const items = snapshot.val() || {};
                    
                    // Handle items that need prices
                    const pendingItems = Object.entries(items).filter(([_, item]) => 
                        item.status === 'pending_price' || !item.price || item.price === null
                    );

                    // Handle items with prices set (predefined items)
                    predefinedItems = Object.entries(items).reduce((acc, [id, item]) => {
                        if (item.price !== null && item.status === 'active') {
                            acc[id] = {
                                id: id,
                                name: item.name,
                                price: item.price,
                                status: item.status
                            };
                        }
                        return acc;
                    }, {});

                    // Update predefined items dropdown
                    updatePredefinedItemsDropdown();

                    // Update pending items section if it exists
                    updatePendingItemsSection(pendingItems);

                } catch (error) {
                    console.error('Error processing items update:', error);
                    showMessage('Error updating items. Please refresh the page.', 'error');
                }
            }, (error) => {
                console.error('Error setting up items listener:', error);
                showMessage('Error connecting to database. Please refresh the page.', 'error');
            });

        // Setup notifications listener
        setupNotificationsListener();
    }

    function updatePredefinedItemsDropdown() {
        const options = Object.values(predefinedItems).map(item => 
            `<option value="${item.id}">${item.name} - ${formatCurrency(item.price)}</option>`
        ).join('');
        
        predefinedItem.innerHTML = '<option value="">Choose an item...</option>' + options;
    }

    function updatePendingItemsSection(pendingItems) {
        // Find or create the pending items section
        let pendingSection = document.getElementById('pendingItemsSection');
        const container = document.querySelector('.p-4') || document.body;

        // Remove existing section if no pending items
        if (pendingItems.length === 0) {
            if (pendingSection) {
                pendingSection.remove();
            }
            return;
        }

        // Create new section if it doesn't exist
        if (!pendingSection) {
            pendingSection = document.createElement('div');
            pendingSection.id = 'pendingItemsSection';
            pendingSection.className = 'bg-white rounded-lg shadow-sm p-4 mb-6';
            container.insertBefore(pendingSection, container.firstChild);
        }

        // Update section content
        pendingSection.innerHTML = `
            <h2 class="text-lg font-semibold text-gray-800 mb-4">Items Requiring Price</h2>
            <div class="space-y-3">
                ${pendingItems.map(([id, item]) => `
                    <div class="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                        <div class="flex-1">
                            <h4 class="font-medium text-gray-800">${item.name}</h4>
                            <p class="text-sm text-gray-600">Assigned by admin</p>
                        </div>
                        <div class="flex items-center space-x-2">
                            <div class="relative">
                                <span class="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500">$</span>
                                <input type="number" id="price_${id}" placeholder="0.00" min="0" step="0.01"
                                       class="w-32 pl-8 pr-3 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500">
                            </div>
                            <button onclick="setItemPrice('${id}')"
                                    class="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors">
                                Set Price
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // Function to set item price
    window.setItemPrice = async function(itemId) {
        try {
            const priceInput = document.getElementById(`price_${itemId}`);
            const price = parseFloat(priceInput.value);

            if (!price || price <= 0) {
                showMessage('Please enter a valid price.', 'error');
                return;
            }

            await database.ref(`items/${itemId}`).update({
                price: price,
                status: 'active',
                priceSetAt: firebase.database.ServerValue.TIMESTAMP,
                priceSetBy: currentUser.uid
            });

            // Add notification for admin
            const notificationRef = database.ref(`notifications/admin`).push();
            await notificationRef.set({
                type: 'price_set',
                itemId: itemId,
                price: price,
                subAdminId: currentUser.uid,
                subAdminEmail: currentUser.email,
                status: 'unread',
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });

            showMessage('Price set successfully!', 'success');
        } catch (error) {
            console.error('Error setting item price:', error);
            showMessage('Error setting price. Please try again.', 'error');
        }
    };

    // Setup notifications listener
    function setupNotificationsListener() {
        if (!currentUser) return;

        const notificationsRef = database.ref(`notifications/${currentUser.uid}`);
        notificationsRef.on('child_added', async (snapshot) => {
            const notification = snapshot.val();
            if (notification.status === 'unread') {
                // Mark as read
                await snapshot.ref.update({ status: 'read' });
                
                // Show notification
                switch (notification.type) {
                    case 'new_item':
                        showMessage(`New item "${notification.itemName}" has been assigned to you.`, 'success');
                        break;
                    case 'item_assigned':
                        showMessage(`Item "${notification.itemName}" has been assigned to you.`, 'success');
                        break;
                    case 'item_unassigned':
                        showMessage(`Item "${notification.itemName}" has been unassigned from you.`, 'info');
                        break;
                }
            }
        });
    }

    // Cleanup function for when the page is unloaded
    window.addEventListener('unload', () => {
        if (window.itemsRef) {
            window.itemsRef.off();
        }
    });

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

    // Initialize budget info
    async function initializeBudgetInfo() {
        try {
            const uid = firebase.auth().currentUser.uid;
            
            // Set up real-time listener for budget allocations
            database.ref(`budget_allocations/${uid}`).on('value', async (allocationsSnapshot) => {
                const allocations = allocationsSnapshot.val() || {};
                
                // Calculate total allocated budget from all allocations
                const totalAllocated = Object.values(allocations).reduce((sum, allocation) => {
                    if (allocation.type === 'reversal') {
                        return sum - allocation.amount;
                    }
                    return sum + allocation.amount;
                }, 0);
                
                // Get user data with used budget
                const userSnapshot = await database.ref(`users/${uid}`).once('value');
                userData = userSnapshot.val() || {};
                userData.totalAllocated = totalAllocated;

                // Update budget display
                updateBudgetDisplay();
                updateSubmitButton();

                // Update budget history if container exists
                const budgetHistoryContainer = document.getElementById('budgetHistory');
                if (budgetHistoryContainer) {
                    budgetHistoryContainer.innerHTML = generateBudgetHistory(allocations);
                }

                // Update the main budget overview section
                const totalBudgetElement = document.getElementById('totalBudget');
                const usedBudgetElement = document.getElementById('usedBudget');
                const remainingBudgetElement = document.getElementById('remainingBudget');

                if (totalBudgetElement) totalBudgetElement.textContent = formatCurrency(totalAllocated);
                if (usedBudgetElement) usedBudgetElement.textContent = formatCurrency(userData.usedBudget || 0);
                if (remainingBudgetElement) remainingBudgetElement.textContent = formatCurrency(totalAllocated - (userData.usedBudget || 0));

                // Update progress bar if it exists
                const progressBar = document.querySelector('.progress-bar');
                if (progressBar) {
                    const percentage = totalAllocated > 0 ? ((userData.usedBudget || 0) / totalAllocated) * 100 : 0;
                    progressBar.style.width = `${Math.min(percentage, 100)}%`;
                    
                    // Update progress bar color based on usage
                    if (percentage >= 90) {
                        progressBar.classList.remove('bg-blue-600', 'bg-yellow-500');
                        progressBar.classList.add('bg-red-600');
                    } else if (percentage >= 75) {
                        progressBar.classList.remove('bg-blue-600', 'bg-red-600');
                        progressBar.classList.add('bg-yellow-500');
                    } else {
                        progressBar.classList.remove('bg-yellow-500', 'bg-red-600');
                        progressBar.classList.add('bg-blue-600');
                    }
                }
            });

        } catch (error) {
            console.error('Error initializing budget info:', error);
            showMessage('Error loading budget information', 'error');
        }
    }

    function generateBudgetHistory(allocations) {
        if (!allocations || Object.keys(allocations).length === 0) {
            return '<p class="text-gray-500">No budget allocation history</p>';
        }

        const historyArray = Object.entries(allocations)
            .map(([id, allocation]) => ({
                ...allocation,
                id
            }))
            .sort((a, b) => b.timestamp - a.timestamp);

        return `
            <div class="bg-white rounded-lg shadow p-4">
                <h3 class="text-lg font-semibold mb-4">Budget Allocation History</h3>
                <div class="space-y-3">
                    ${historyArray.map(allocation => `
                        <div class="border-b border-gray-200 pb-2 last:border-0">
                            <div class="flex justify-between items-center">
                                <span class="font-medium ${allocation.type === 'reversal' ? 'text-red-600' : 'text-green-600'}">
                                    ${allocation.type === 'reversal' ? '-' : '+'}${formatCurrency(allocation.amount)}
                                </span>
                                <span class="text-gray-500 text-sm">${formatDate(allocation.timestamp)}</span>
                            </div>
                            <p class="text-gray-600 text-sm">
                                ${allocation.type === 'reversal' 
                                    ? `Reversed by: ${allocation.adminEmail}`
                                    : `Allocated by: ${allocation.adminEmail}`}
                            </p>
                            ${allocation.notes ? `<p class="text-gray-500 text-xs italic">${allocation.notes}</p>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Call initializeBudgetInfo after authentication
    firebase.auth().onAuthStateChanged(function(user) {
        if (user) {
            initializeBudgetInfo();
            setupItemsListener();
        }
    });

    // Sidebar functionality
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');

    sidebarToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        mainContent.classList.toggle('sidebar-open');
    });

    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target) && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            mainContent.classList.remove('sidebar-open');
        }
    });

    // Section loading animations
    const observerOptions = {
        root: null,
        threshold: 0.1,
        rootMargin: '0px'
    };

    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in');
                sectionObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('section').forEach(section => {
        section.classList.remove('fade-in');
        sectionObserver.observe(section);
    });

    // Smooth scrolling for sidebar navigation
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const href = this.getAttribute('href');
            if (!href || href === '#') return;
            
            const section = document.querySelector(href);
            if (section) {
                section.scrollIntoView({
                    behavior: 'smooth'
                });
                // Close sidebar on mobile after clicking
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('open');
                    mainContent.classList.remove('sidebar-open');
                }
            }
        });
    });

    // Handle mobile viewport height adjustments
    function setMobileHeight() {
        document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    }

    setMobileHeight();
    window.addEventListener('resize', setMobileHeight);

    // Section Navigation
    const navLinks = document.querySelectorAll('.nav-link');
    const sectionTitle = document.getElementById('sectionTitle');
    const submitButtonContainer = document.getElementById('submitButtonContainer');

    function showSection(sectionId) {
        document.querySelectorAll('.section-content').forEach(section => {
            section.classList.add('hidden');
            section.classList.remove('active');
        });

        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.remove('hidden');
            targetSection.classList.add('active');
            
            // Update page title
            const navLink = document.querySelector(`[data-section="${sectionId}"]`);
            if (navLink) {
                sectionTitle.textContent = navLink.querySelector('span').textContent;
            }

            // Show/hide submit button only in purchase section
            submitButtonContainer.classList.toggle('hidden', sectionId !== 'purchase');

            // Load history data if showing history section
            if (sectionId === 'history') {
                loadPurchaseHistory();
            }
        }
    }

    // Navigation click handlers
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = link.getAttribute('data-section');
            if (!sectionId) return;
            
            showSection(sectionId);
            
            // Add active state to navigation
            navLinks.forEach(navLink => navLink.classList.remove('bg-white/50'));
            link.classList.add('bg-white/50');

            // Close sidebar on mobile after navigation
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
                mainContent.classList.remove('sidebar-open');
            }
        });
    });

    // Handle direct hash navigation
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.slice(1); // Remove the # symbol
        if (hash && ['budget', 'purchase', 'history'].includes(hash)) {
            showSection(hash);
            // Update active state in navigation
            navLinks.forEach(link => {
                if (link.getAttribute('data-section') === hash) {
                    link.classList.add('bg-white/50');
                } else {
                    link.classList.remove('bg-white/50');
                }
            });
        }
    });

    // Check initial hash on page load
    if (window.location.hash) {
        const hash = window.location.hash.slice(1);
        if (['budget', 'purchase', 'history'].includes(hash)) {
            showSection(hash);
        }
    }

    // Purchase History functionality
    function loadPurchaseHistory() {
        const historyList = document.getElementById('historyList');
        const historyFilter = document.getElementById('historyFilter');

        // Show loading state
        historyList.innerHTML = `
            <div class="animate-pulse">
                <div class="h-20 bg-gray-100 rounded-lg mb-4"></div>
                <div class="h-20 bg-gray-100 rounded-lg mb-4"></div>
                <div class="h-20 bg-gray-100 rounded-lg"></div>
            </div>
        `;

        // Get user ID from auth
        const userId = firebase.auth().currentUser?.uid;
        if (!userId) return;

        // Get filter value
        const filterValue = historyFilter.value;
        let startDate = new Date();

        // Calculate filter date range
        switch (filterValue) {
            case 'today':
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'week':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'month':
                startDate.setMonth(startDate.getMonth() - 1);
                break;
            default:
                startDate = null;
        }

        // Query purchases from Firebase
        let query = firebase.database().ref('purchases').orderByChild('userId').equalTo(userId);
        if (startDate) {
            query = query.startAt(startDate.getTime());
        }

        query.once('value')
            .then((snapshot) => {
                const purchases = [];
                snapshot.forEach((child) => {
                    purchases.unshift({ id: child.key, ...child.val() });
                });

                if (purchases.length === 0) {
                    historyList.innerHTML = `
                        <div class="text-center py-8 text-gray-500">
                            No purchases found
                        </div>
                    `;
                    return;
                }

                historyList.innerHTML = purchases.map(purchase => `
                    <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                        <div class="flex justify-between items-start mb-2">
                            <div>
                                <div class="font-medium text-gray-900">Purchase #${purchase.id.slice(-6)}</div>
                                <div class="text-sm text-gray-500">${new Date(purchase.timestamp).toLocaleString()}</div>
                            </div>
                            <div class="text-lg font-semibold text-blue-600">$${purchase.total.toFixed(2)}</div>
                        </div>
                        <div class="text-sm text-gray-600">
                            ${purchase.items.map(item => `
                                <div class="flex justify-between items-center">
                                    <span>${item.name} × ${item.quantity}</span>
                                    <span>$${(item.price * item.quantity).toFixed(2)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('');
            })
            .catch((error) => {
                console.error('Error loading purchase history:', error);
                historyList.innerHTML = `
                    <div class="text-center py-8 text-red-500">
                        Error loading purchase history
                    </div>
                `;
            });
    }

    // Handle history filter changes
    document.getElementById('historyFilter')?.addEventListener('change', loadPurchaseHistory);

    // Show initial section (Budget Overview)
    showSection('budget');
});

