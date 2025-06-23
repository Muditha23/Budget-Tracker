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

        const allocated = userData.allocatedBudget || 0;
        const used = userData.usedBudget || 0;
        const remaining = allocated - used;
        const potentialUsed = used + cartTotal;
        const potentialRemaining = allocated - potentialUsed;
        const usagePercent = (potentialUsed / allocated) * 100;

        allocatedAmount.textContent = formatCurrency(allocated);
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
        const canSubmit = cart.length > 0 && userData && (userData.usedBudget + total <= userData.allocatedBudget);

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
        loadPredefinedItems();
    };

    async function loadPredefinedItems() {
        try {
            const itemsSnapshot = await database.ref('items').once('value');
            const items = itemsSnapshot.val() || {};
            
            predefinedItems = items;
            
            // Populate dropdown
            const options = Object.keys(items).map(id => 
                `<option value="${id}">${items[id].name} - ${formatCurrency(items[id].price)}</option>`
            ).join('');
            
            predefinedItem.innerHTML = '<option value="">Choose an item...</option>' + options;
            
        } catch (error) {
            console.error('Error loading predefined items:', error);
        }
    }

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
});

