// Sub Admin Interface Implementation
document.addEventListener('DOMContentLoaded', function() {
    // Initialize authentication
    const subAdminAuth = new SubAdminAuth();
    
    // UI Elements
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
    
    // Budget display elements
    const allocatedAmount = document.getElementById('allocatedAmount');
    const remainingAmount = document.getElementById('remainingAmount');
    const usagePercentage = document.getElementById('usagePercentage');
    const usageBar = document.getElementById('usageBar');
    const spentAmount = document.getElementById('spentAmount');

    // Cart state
    let cart = [];
    let predefinedItems = {};
    let userData = null;

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
        const totalAllocated = userData.allocatedBudget || 0;
        const usedBudget = userData.usedBudget || 0;
        const availableBalance = userData.availableBalance || totalAllocated;
        
        // Calculate remaining balance after purchases (not including returns)
        const remainingAfterPurchases = availableBalance - usedBudget;
        const potentialRemaining = remainingAfterPurchases - cartTotal;
        
        // Calculate usage percentage based on actual spending against total allocated
        const usagePercent = totalAllocated > 0 ? (usedBudget / totalAllocated) * 100 : 0;

        // Update UI elements
        allocatedAmount.textContent = formatCurrency(availableBalance);
        remainingAmount.textContent = formatCurrency(potentialRemaining);
        spentAmount.textContent = formatCurrency(usedBudget);
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
        const totalAllocated = userData?.allocatedBudget || 0;
        const usedBudget = userData?.usedBudget || 0;
        const canSubmit = cart.length > 0 && userData && (usedBudget + total <= totalAllocated);

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

            await subAdminAuth.submitPurchase(cart);
            
            showMessage('Purchase submitted successfully!', 'success');
            
            // Clear cart and update display
            cart = [];
            updateCartDisplay();
            updateSubmitButton();
            
            // Refresh user data
            const userSnapshot = await database.ref('users/' + subAdminAuth.currentUser.uid).once('value');
            userData = userSnapshot.val();
            updateBudgetDisplay();

            // Add a small delay before refreshing to show the success message
            setTimeout(() => {
                window.location.reload();
            }, 1000);

        } catch (error) {
            console.error('Error submitting purchase:', error);
            showMessage(error.message || 'Error submitting purchase. Please try again.', 'error');
        } finally {
            updateSubmitButton();
        }
    });

    // Logout
    logoutBtn.addEventListener('click', () => {
        subAdminAuth.logout();
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
        if (!subAdminAuth.currentUser) {
            console.error('User not authenticated');
            return;
        }

        // Remove any existing listener
        if (window.itemsRef) {
            window.itemsRef.off();
        }

        // Create a new reference and listener
        window.itemsRef = database.ref('items');
        window.itemsRef.orderByChild('assignedTo').equalTo(subAdminAuth.currentUser.uid)
            .on('value', async (snapshot) => {
                try {
                    const items = snapshot.val() || {};
                    
                    // Handle items that need prices
                    const pendingItems = Object.entries(items).filter(([_, item]) => 
                        item.status === 'pending_price' || item.price === null
                    );

                    // Handle items with prices set (predefined items)
                    predefinedItems = Object.entries(items).reduce((acc, [id, item]) => {
                        if (item.price !== null && item.status === 'active') {
                            acc[id] = item;
                        }
                        return acc;
                    }, {});

                    // Update predefined items dropdown
                    const options = Object.keys(predefinedItems).map(id => 
                        `<option value="${id}">${predefinedItems[id].name} - ${formatCurrency(predefinedItems[id].price)}</option>`
                    ).join('');
                    
                    predefinedItem.innerHTML = '<option value="">Choose an item...</option>' + options;

                    // Update pending items section
                    let container = document.querySelector('.container');
                    if (!container) {
                        container = document.querySelector('.p-4'); // Fallback to main content div
                    }

                    if (container) {
                        // Remove existing pending section if it exists
                        const existingSection = document.getElementById('pendingItemsSection');
                        if (existingSection) {
                            existingSection.remove();
                        }

                        if (pendingItems.length > 0) {
                            // Create new pending items section
                            const pendingSection = document.createElement('div');
                            pendingSection.id = 'pendingItemsSection';
                            pendingSection.className = 'bg-white rounded-lg shadow-sm p-4 mb-6';
                            
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

                            // Insert at the top of the container
                            const firstChild = container.firstChild;
                            container.insertBefore(pendingSection, firstChild);
                        }
                    }
                } catch (error) {
                    console.error('Error processing items update:', error);
                    showMessage('Error updating items. Please refresh the page.', 'error');
                }
            }, (error) => {
                console.error('Error setting up items listener:', error);
                showMessage('Error connecting to database. Please refresh the page.', 'error');
            });
    }

    // Add function to set item price
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
                priceSetAt: firebase.database.ServerValue.TIMESTAMP
            });

            showMessage('Price set successfully!', 'success');
        } catch (error) {
            console.error('Error setting item price:', error);
            showMessage('Error setting price. Please try again.', 'error');
        }
    };

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
            
            // Get initial user data
            const userSnapshot = await database.ref(`users/${uid}`).once('value');
            userData = userSnapshot.val();

            if (!userData) {
                showMessage('Error: User data not found', 'error');
                return;
            }

            // Set up real-time listener for budget allocations
            database.ref(`budget_allocations/${uid}`).on('value', async (allocationsSnapshot) => {
                const allocations = allocationsSnapshot.val() || {};
                
                // Calculate total allocated budget (original amount given by admin)
                const totalAllocated = Object.values(allocations).reduce((sum, allocation) => {
                    return allocation.type !== 'reversal' ? sum + allocation.amount : sum;
                }, 0);

                // Calculate available balance (allocated minus returns)
                const availableBalance = Object.values(allocations).reduce((sum, allocation) => {
                    return allocation.type === 'reversal' ? sum - allocation.amount : sum + allocation.amount;
                }, 0);

                // Update user data in memory and database
                userData = {
                    ...userData,
                    allocatedBudget: totalAllocated,
                    availableBalance: availableBalance
                };

                // Update the database with new values
                await database.ref(`users/${uid}`).update({
                    allocatedBudget: totalAllocated,
                    availableBalance: availableBalance
                });

                // Update budget display
                updateBudgetDisplay();
                
                // Generate and display budget history
                generateBudgetHistory(allocations);
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
    const mainContent = document.querySelector('.main-content');

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
            if (href && href !== '#') {
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

    // Balance Return Functionality
    const returnAmount = document.getElementById('returnAmount');
    const returnNotes = document.getElementById('returnNotes');
    const submitReturn = document.getElementById('submitReturn');
    const returnAvailableAmount = document.getElementById('returnAvailableAmount');
    const totalReturnedAmount = document.getElementById('totalReturnedAmount');
    const returnHistoryList = document.getElementById('returnHistoryList');

    // Initialize return section data
    async function initializeReturnSection() {
        try {
            const uid = firebase.auth().currentUser.uid;
            
            // Get user data
            const userSnapshot = await database.ref(`users/${uid}`).once('value');
            const userData = userSnapshot.val();

            if (!userData) {
                showMessage('Error: User data not found', 'error');
                return;
            }

            // Set up real-time listener for return history
            database.ref(`balance_returns/${uid}`).on('value', (snapshot) => {
                const returns = snapshot.val() || {};
                updateReturnHistory(returns);
                
                // Calculate total returned amount
                const totalReturned = Object.values(returns).reduce((sum, ret) => sum + ret.amount, 0);
                totalReturnedAmount.textContent = formatCurrency(totalReturned);
            });

            // Update available amount whenever budget changes
            database.ref(`budget_allocations/${uid}`).on('value', async (allocationsSnapshot) => {
                const allocations = allocationsSnapshot.val() || {};
                const totalAllocated = Object.values(allocations).reduce((sum, allocation) => {
                    return allocation.type === 'reversal' ? sum - allocation.amount : sum + allocation.amount;
                }, 0);

                const userDataSnapshot = await database.ref(`users/${uid}`).once('value');
                const currentUserData = userDataSnapshot.val();
                const usedBudget = currentUserData.usedBudget || 0;
                const availableAmount = totalAllocated - usedBudget;
                
                returnAvailableAmount.textContent = formatCurrency(availableAmount);
                
                // Disable return button if no available balance
                returnAmount.max = availableAmount;
                if (availableAmount <= 0) {
                    submitReturn.disabled = true;
                    submitReturn.className = 'ios-button w-full bg-gray-400';
                    returnAmount.disabled = true;
                } else {
                    submitReturn.disabled = false;
                    submitReturn.className = 'ios-button w-full bg-purple-600';
                    returnAmount.disabled = false;
                }
            });
        } catch (error) {
            console.error('Error initializing return section:', error);
            showMessage('Error loading return section', 'error');
        }
    }

    // Handle balance return submission
    submitReturn.addEventListener('click', async function() {
        try {
            const amount = parseFloat(returnAmount.value);
            if (!amount || amount <= 0) {
                showMessage('Please enter a valid amount', 'error');
                return;
            }

            const availableAmount = parseFloat(returnAvailableAmount.textContent.replace(/[^0-9.-]+/g, ''));
            if (amount > availableAmount) {
                showMessage('Amount exceeds available balance', 'error');
                return;
            }

            const uid = firebase.auth().currentUser.uid;
            
            // Get user data
            const userSnapshot = await database.ref(`users/${uid}`).once('value');
            const userData = userSnapshot.val();
            
            // Try to get admin ID, fallback to createdBy if adminId is not set
            const adminId = userData.adminId || userData.createdBy;

            if (!adminId) {
                showMessage('Error: Could not determine admin. Please contact support.', 'error');
                return;
            }

            // Create return record
            const returnRef = database.ref(`balance_returns/${uid}`).push();
            const returnData = {
                amount: amount,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                notes: returnNotes.value.trim(),
                status: 'completed'
            };

            // Create a reversal allocation
            const allocationRef = database.ref(`budget_allocations/${uid}`).push();
            const allocationData = {
                amount: amount,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                type: 'reversal',
                notes: `Balance returned${returnNotes.value.trim() ? ': ' + returnNotes.value.trim() : ''}`
            };

            // Update user's data - keep original allocated budget but update available balance
            const updatedAvailableBalance = (userData.availableBalance || 0) - amount;

            // Perform updates atomically
            await database.ref().update({
                [`balance_returns/${uid}/${returnRef.key}`]: returnData,
                [`budget_allocations/${uid}/${allocationRef.key}`]: allocationData,
                [`users/${uid}/availableBalance`]: updatedAvailableBalance
            });

            // Reset form
            returnAmount.value = '';
            returnNotes.value = '';
            showMessage('Balance successfully returned', 'success');

        } catch (error) {
            console.error('Error returning balance:', error);
            showMessage('Error returning balance', 'error');
        }
    });

    // Update return history display
    function updateReturnHistory(returns) {
        if (!returns || Object.keys(returns).length === 0) {
            returnHistoryList.innerHTML = '<p class="text-gray-500 text-center py-4">No return history</p>';
            return;
        }

        const historyArray = Object.entries(returns)
            .map(([id, ret]) => ({...ret, id}))
            .sort((a, b) => b.timestamp - a.timestamp);

        returnHistoryList.innerHTML = historyArray.map(ret => `
            <div class="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <div class="font-medium text-gray-900">Return #${ret.id.slice(-6)}</div>
                        <div class="text-sm text-gray-500">${new Date(ret.timestamp).toLocaleString()}</div>
                    </div>
                    <div class="text-lg font-semibold text-purple-600">${formatCurrency(ret.amount)}</div>
                </div>
                ${ret.notes ? `<p class="text-sm text-gray-600 mt-2">${ret.notes}</p>` : ''}
            </div>
        `).join('');
    }

    // Initialize return section when showing it
    document.querySelector('[data-section="return"]').addEventListener('click', () => {
        initializeReturnSection();
    });
});

