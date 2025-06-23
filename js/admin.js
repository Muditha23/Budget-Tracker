// Admin Dashboard Module
class AdminDashboard {
    constructor() {
        this.currentSection = 'dashboard';
        this.listeners = [];
        this.init();
    }

    init() {
        // Check if user is admin
        auth.onAuthStateChanged((user) => {
            if (user) {
                console.log('User authenticated:', user.email);
                authManager.getUserRole(user.uid).then(role => {
                    console.log('User role:', role);
                    if (role !== 'admin') {
                        console.log('Not an admin, redirecting to login');
                        window.location.href = 'login.html';
                        return;
                    }
                    this.setupDashboard(user);
                });
            } else {
                console.log('No user authenticated, redirecting to login');
                window.location.href = 'login.html';
            }
        });

        this.setupEventListeners();
        this.updateCurrentTime();
        setInterval(() => this.updateCurrentTime(), 1000);
    }

    setupDashboard(user) {
        // Update user info
        document.getElementById('adminName').textContent = user.displayName || 'Admin User';
        document.getElementById('adminEmail').textContent = user.email;

        // Load dashboard data
        this.loadDashboardData();
        this.setupRealtimeListeners();
    }

    setupEventListeners() {
        // Sidebar navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = e.currentTarget.dataset.section;
                this.showSection(section);
            });
        });

        // Mobile menu
        document.getElementById('openSidebar').addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('-translate-x-full');
            document.getElementById('mobileMenuOverlay').classList.remove('hidden');
        });

        document.getElementById('closeSidebar').addEventListener('click', () => {
            document.getElementById('sidebar').classList.add('-translate-x-full');
            document.getElementById('mobileMenuOverlay').classList.add('hidden');
        });

        document.getElementById('mobileMenuOverlay').addEventListener('click', () => {
            document.getElementById('sidebar').classList.add('-translate-x-full');
            document.getElementById('mobileMenuOverlay').classList.add('hidden');
        });

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', async () => {
            const result = await authManager.logout();
            if (result.success) {
                window.location.href = 'login.html';
            }
        });

        // Add funds form
        document.getElementById('addFundsForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddFunds();
        });

        // Toast close
        document.getElementById('closeToast').addEventListener('click', () => {
            this.hideToast();
        });
    }

    showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.add('hidden');
        });

        // Show selected section
        document.getElementById(`${sectionName}-section`).classList.remove('hidden');

        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active', 'bg-indigo-100', 'text-indigo-700');
            link.classList.add('text-gray-700');
        });

        const activeLink = document.querySelector(`[data-section="${sectionName}"]`);
        if (activeLink) {
            activeLink.classList.add('active', 'bg-indigo-100', 'text-indigo-700');
            activeLink.classList.remove('text-gray-700');
        }

        // Update page title
        const titles = {
            'dashboard': 'Dashboard',
            'add-funds': 'Add Funds',
            'allocate-funds': 'Allocate Funds',
            'sub-admin-logs': 'Sub Admin Logs',
            'manage-users': 'Manage Users',
            'suggestions': 'Suggestions',
            'export-pdf': 'Export PDF'
        };
        document.getElementById('pageTitle').textContent = titles[sectionName] || 'Dashboard';

        this.currentSection = sectionName;

        // Load section-specific data
        switch(sectionName) {
            case 'add-funds':
            this.loadFundHistory();
                break;
            case 'export-pdf':
                this.setupPDFExportSection();
                break;
            case 'allocate-funds':
                this.setupAllocateFundsSection();
                break;
            case 'manage-users':
                this.setupManageUsersSection();
                break;
            case 'sub-admin-logs':
                this.setupSubAdminLogsSection();
                break;
            case 'suggestions':
                this.setupSuggestionsSection();
                break;
        }
    }

    async loadDashboardData() {
        try {
            // Ensure user is authenticated and has admin role
            const user = auth.currentUser;
            if (!user) {
                throw new Error('No authenticated user');
            }

            const userRole = await authManager.getUserRole(user.uid);
            if (userRole !== 'admin') {
                throw new Error('Unauthorized access');
            }

            // Load summary data
            await this.loadSummaryData();
            
            // Load sub admin data
            await this.loadSubAdminData();
            
            // Load recent activity
            await this.loadRecentActivity();
            
        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showToast('Error loading dashboard data: ' + error.message, 'error');
            if (error.message.includes('Unauthorized') || error.message.includes('permission_denied')) {
                window.location.href = 'login.html';
            }
        }
    }

    async loadSummaryData() {
        try {
            // Show loading state
            ['totalFunds', 'totalAllocated', 'totalUsed', 'totalRemaining'].forEach(id => {
                document.getElementById(id).innerHTML = '<div class="animate-pulse bg-gray-200 h-6 w-24 rounded"></div>';
            });

            // Get total funds
            const fundsSnapshot = await dbRefs.funds.once('value');
            const funds = fundsSnapshot.val() || {};
            const totalFunds = Object.values(funds).reduce((sum, fund) => sum + (fund.amount || 0), 0);

            // Get allocations and usage
            const usersSnapshot = await dbRefs.users.once('value');
            const users = usersSnapshot.val() || {};
            
            let totalAllocated = 0;
            let totalUsed = 0;
            
            Object.values(users).forEach(user => {
                if (user.role === 'sub_admin') {
                    totalAllocated += user.allocated || 0;
                    totalUsed += user.used || 0;
                }
            });

            const totalRemaining = totalFunds - totalUsed;

            // Update UI
            document.getElementById('totalFunds').textContent = dbHelpers.formatCurrency(totalFunds);
            document.getElementById('totalAllocated').textContent = dbHelpers.formatCurrency(totalAllocated);
            document.getElementById('totalUsed').textContent = dbHelpers.formatCurrency(totalUsed);
            document.getElementById('totalRemaining').textContent = dbHelpers.formatCurrency(totalRemaining);

        } catch (error) {
            console.error('Error loading summary data:', error);
            this.showToast('Error loading summary data: ' + error.message, 'error');
            
            // Show error state in UI
            ['totalFunds', 'totalAllocated', 'totalUsed', 'totalRemaining'].forEach(id => {
                document.getElementById(id).innerHTML = '<span class="text-red-500">Error loading data</span>';
            });
        }
    }

    async loadSubAdminData() {
        try {
            const tableBody = document.getElementById('subAdminTable');
            
            // Show loading state
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-4">
                        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                        <p class="mt-2 text-gray-600">Loading sub admin data...</p>
                    </td>
                </tr>
            `;

            const snapshot = await dbRefs.users.once('value');
            const users = snapshot.val() || {};
            
            tableBody.innerHTML = '';
            let hasSubAdmins = false;

            Object.entries(users).forEach(([uid, user]) => {
                if (user.role === 'sub_admin') {
                    hasSubAdmins = true;
                    const allocated = user.allocated || 0;
                    const used = user.used || 0;
                    const remaining = allocated - used;
                    const usagePercent = dbHelpers.calculatePercentage(used, allocated);

                    let statusClass = 'bg-green-100 text-green-800';
                    let statusText = 'Good';
                    
                    if (usagePercent >= 90) {
                        statusClass = 'bg-red-100 text-red-800';
                        statusText = 'Critical';
                    } else if (usagePercent >= 70) {
                        statusClass = 'bg-yellow-100 text-yellow-800';
                        statusText = 'Warning';
                    }

                    const row = document.createElement('tr');
                    row.className = 'border-b border-gray-100 hover:bg-gray-50 transition duration-150';
                    row.innerHTML = `
                        <td class="py-3 font-medium text-gray-900">${user.name || 'N/A'}</td>
                        <td class="py-3 text-gray-600">${user.email}</td>
                        <td class="py-3 text-gray-900">${dbHelpers.formatCurrency(allocated)}</td>
                        <td class="py-3 text-gray-900">${dbHelpers.formatCurrency(used)}</td>
                        <td class="py-3 text-gray-900">${dbHelpers.formatCurrency(remaining)}</td>
                        <td class="py-3">
                            <div class="flex items-center">
                                <div class="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                    <div class="bg-indigo-600 h-2 rounded-full" style="width: ${Math.min(usagePercent, 100)}%"></div>
                                </div>
                                <span class="text-sm text-gray-600">${usagePercent}%</span>
                            </div>
                        </td>
                        <td class="py-3">
                            <span class="px-2 py-1 text-xs font-medium rounded-full ${statusClass}">
                                ${statusText}
                            </span>
                        </td>
                    `;
                    tableBody.appendChild(row);
                }
            });

            if (!hasSubAdmins) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="7" class="text-center py-8 text-gray-500">
                            <i class="fas fa-users text-4xl mb-3"></i>
                            <p>No sub admin users found</p>
                        </td>
                    </tr>
                `;
            }

            // Update notification badge
            this.updateNotificationBadge();

        } catch (error) {
            console.error('Error loading sub admin data:', error);
            this.showToast('Error loading sub admin data: ' + error.message, 'error');
            
            // Show error state
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-8 text-red-500">
                        <i class="fas fa-exclamation-circle text-4xl mb-3"></i>
                        <p>Error loading sub admin data</p>
                        <p class="text-sm mt-2">${error.message}</p>
                        <button 
                            onclick="adminDashboard.loadSubAdminData()"
                            class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition duration-200"
                        >
                            <i class="fas fa-sync-alt mr-2"></i>
                            Retry
                        </button>
                    </td>
                </tr>
            `;
        }
    }

    async loadRecentActivity() {
        try {
            const snapshot = await dbRefs.logs.orderByChild('timestamp').limitToLast(10).once('value');
            const logs = snapshot.val() || {};
            const activityContainer = document.getElementById('recentActivity');
            
            activityContainer.innerHTML = '';

            const sortedLogs = Object.entries(logs).sort((a, b) => 
                new Date(b[1].timestamp) - new Date(a[1].timestamp)
            );

            if (sortedLogs.length === 0) {
                activityContainer.innerHTML = `
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-history text-2xl mb-2"></i>
                        <p>No recent activity</p>
                    </div>
                `;
                return;
            }

            sortedLogs.forEach(([logId, log]) => {
                const activityItem = document.createElement('div');
                activityItem.className = 'flex items-start space-x-3 p-3 bg-gray-50 rounded-lg';
                
                const iconClass = this.getActivityIcon(log.action);
                const timeAgo = this.getTimeAgo(log.timestamp);
                
                activityItem.innerHTML = `
                    <div class="bg-white w-8 h-8 rounded-full flex items-center justify-center">
                        ${iconClass}
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-medium text-gray-900">${this.getActivityDescription(log)}</p>
                        <p class="text-xs text-gray-500">${timeAgo}</p>
                    </div>
                `;
                
                activityContainer.appendChild(activityItem);
            });

        } catch (error) {
            console.error('Error loading recent activity:', error);
        }
    }

    async handleAddFunds() {
        const amount = parseFloat(document.getElementById('fundAmount').value);
        const note = document.getElementById('fundNote').value.trim();

        if (!amount || amount <= 0) {
            this.showToast('Please enter a valid amount', 'error');
            return;
        }

        try {
            const fundId = dbHelpers.generateId();
            
            // Add fund to database
            await dbRefs.funds.child(fundId).set({
                amount: amount,
                note: note,
                timestamp: dbHelpers.getTimestamp(),
                addedBy: auth.currentUser.uid
            });

            // Log the action
            await authManager.logAction('funds_added', {
                amount: amount,
                note: note,
                fundId: fundId
            });

            // Reset form
            document.getElementById('addFundsForm').reset();
            
            // Show success message
            this.showToast(`Successfully added ${dbHelpers.formatCurrency(amount)}`, 'success');
            
            // Reload data
            this.loadSummaryData();
            this.loadFundHistory();

        } catch (error) {
            console.error('Error adding funds:', error);
            this.showToast('Error adding funds. Please try again.', 'error');
        }
    }

    async loadFundHistory() {
        try {
            const snapshot = await dbRefs.funds.orderByChild('timestamp').once('value');
            const funds = snapshot.val() || {};
            const historyContainer = document.getElementById('fundHistory');
            
            historyContainer.innerHTML = '';

            const sortedFunds = Object.entries(funds).sort((a, b) => 
                new Date(b[1].timestamp) - new Date(a[1].timestamp)
            );

            if (sortedFunds.length === 0) {
                historyContainer.innerHTML = `
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-history text-2xl mb-2"></i>
                        <p>No fund history available</p>
                    </div>
                `;
                return;
            }

            sortedFunds.forEach(([fundId, fund]) => {
                const historyItem = document.createElement('div');
                historyItem.className = 'flex items-center justify-between p-4 bg-gray-50 rounded-lg';
                
                const date = new Date(fund.timestamp).toLocaleDateString();
                const time = new Date(fund.timestamp).toLocaleTimeString();
                
                historyItem.innerHTML = `
                    <div class="flex items-center space-x-3">
                        <div class="bg-green-100 w-10 h-10 rounded-full flex items-center justify-center">
                            <i class="fas fa-plus text-green-600"></i>
                        </div>
                        <div>
                            <p class="font-medium text-gray-900">${dbHelpers.formatCurrency(fund.amount)}</p>
                            <p class="text-sm text-gray-600">${fund.note || 'No note provided'}</p>
                        </div>
                    </div>
                    <div class="text-right">
                        <p class="text-sm text-gray-900">${date}</p>
                        <p class="text-xs text-gray-500">${time}</p>
                    </div>
                `;
                
                historyContainer.appendChild(historyItem);
            });

        } catch (error) {
            console.error('Error loading fund history:', error);
        }
    }

    setupRealtimeListeners() {
        // Listen for user changes
        const usersListener = dbRefs.users.on('value', () => {
            if (this.currentSection === 'dashboard') {
                this.loadSummaryData();
                this.loadSubAdminData();
            }
        });
        this.listeners.push(() => dbRefs.users.off('value', usersListener));

        // Listen for fund changes
        const fundsListener = dbRefs.funds.on('value', () => {
            if (this.currentSection === 'dashboard') {
                this.loadSummaryData();
            }
            if (this.currentSection === 'add-funds') {
                this.loadFundHistory();
            }
        });
        this.listeners.push(() => dbRefs.funds.off('value', fundsListener));

        // Listen for log changes
        const logsListener = dbRefs.logs.on('value', () => {
            if (this.currentSection === 'dashboard') {
                this.loadRecentActivity();
            }
        });
        this.listeners.push(() => dbRefs.logs.off('value', logsListener));
    }

    updateNotificationBadge() {
        // Count users with high usage
        dbRefs.users.once('value').then(snapshot => {
            const users = snapshot.val() || {};
            let alertCount = 0;

            Object.values(users).forEach(user => {
                if (user.role === 'sub_admin') {
                    const usagePercent = dbHelpers.calculatePercentage(user.used || 0, user.allocated || 0);
                    if (usagePercent >= 70) {
                        alertCount++;
                    }
                }
            });

            const badge = document.getElementById('notificationBadge');
            if (alertCount > 0) {
                badge.textContent = alertCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        });
    }

    updateCurrentTime() {
        const now = new Date();
        const timeString = now.toLocaleString();
        document.getElementById('currentTime').textContent = timeString;
    }

    getActivityIcon(action) {
        const icons = {
            'funds_added': 'fas fa-plus-circle text-green-600',
            'user_created': 'fas fa-user-plus text-blue-600',
            'role_updated': 'fas fa-user-edit text-orange-600',
            'user_deleted': 'fas fa-user-minus text-red-600',
            'allocation_made': 'fas fa-hand-holding-dollar text-purple-600',
            'purchase_made': 'fas fa-shopping-cart text-indigo-600',
            'add_funds': 'fas fa-plus-circle text-green-600',
            'allocate_funds': 'fas fa-hand-holding-dollar text-purple-600'
        };
        return `<i class="${icons[action] || 'fas fa-info-circle text-gray-600'} text-xl"></i>`;
    }

    getActivityDescription(log) {
        const descriptions = {
            'funds_added': `Added ${dbHelpers.formatCurrency(log.details.amount)} to system`,
            'user_created': `Created new user: ${log.details.newUserEmail}`,
            'role_updated': `Updated user role to ${log.details.newRole}`,
            'user_deleted': 'Deleted user account',
            'allocation_made': `Allocated funds to user`,
            'purchase_made': 'Purchase submitted',
            'add_funds': `Added ${dbHelpers.formatCurrency(log.details.amount)} to system`,
            'allocate_funds': `Allocated funds to user`
        };
        return descriptions[log.action] || 'Unknown activity';
    }

    getTimeAgo(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diffInSeconds = Math.floor((now - time) / 1000);

        if (diffInSeconds < 60) return 'Just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
        return `${Math.floor(diffInSeconds / 86400)} days ago`;
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

    setupPDFExportSection() {
        const section = document.getElementById('export-pdf-section');
        section.innerHTML = `
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 max-w-2xl">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-semibold text-gray-800">Export System Report</h3>
                </div>
                <div class="p-6">
                    <p class="text-gray-600 mb-6">
                        Generate a comprehensive PDF report of the system's current state, including:
                        <ul class="list-disc list-inside mt-2 space-y-1">
                            <li>System Summary</li>
                            <li>Sub Admin Details</li>
                            <li>Recent Activity</li>
                            <li>Fund History</li>
                            <li>Purchase History</li>
                        </ul>
                    </p>
                    <button 
                        onclick="adminDashboard.handlePDFExport()"
                        class="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition duration-200 font-medium"
                    >
                        <i class="fas fa-file-pdf mr-2"></i>
                        Generate PDF Report
                    </button>
                </div>
            </div>
        `;
    }

    setupAllocateFundsSection() {
        const section = document.getElementById('allocate-funds-section');
        section.innerHTML = `
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 max-w-2xl">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-semibold text-gray-800">Allocate Funds to Sub Admin</h3>
                </div>
                <div class="p-6">
                    <form id="allocateFundsForm" class="space-y-6">
                        <div>
                            <label for="subAdminSelect" class="block text-sm font-medium text-gray-700 mb-2">
                                Select Sub Admin
                            </label>
                            <select 
                                id="subAdminSelect" 
                                required
                                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            >
                                <option value="">Choose a sub admin</option>
                            </select>
                        </div>
                        
                        <div>
                            <label for="allocationAmount" class="block text-sm font-medium text-gray-700 mb-2">
                                Amount to Allocate ($)
                            </label>
                            <input 
                                type="number" 
                                id="allocationAmount" 
                                required
                                min="0"
                                step="0.01"
                                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder="Enter amount to allocate"
                            >
                        </div>
                        
                        <div>
                            <label for="allocationNote" class="block text-sm font-medium text-gray-700 mb-2">
                                Note (Optional)
                            </label>
                            <textarea 
                                id="allocationNote" 
                                rows="3"
                                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder="Add a note about this allocation"
                            ></textarea>
                        </div>
                        
                        <button 
                            type="submit" 
                            class="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition duration-200 font-medium"
                        >
                            <i class="fas fa-hand-holding-dollar mr-2"></i>
                            Allocate Funds
                        </button>
                    </form>
                </div>
            </div>
            
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 mt-8">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-semibold text-gray-800">Allocation History</h3>
                </div>
                <div class="p-6">
                    <div id="allocationHistory" class="space-y-4">
                        <!-- Allocation history will be populated here -->
                    </div>
                </div>
            </div>
        `;
        
        // Add event listener for the form
        document.getElementById('allocateFundsForm').addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAllocateFunds();
            });

        // Load sub admin list
        this.loadSubAdminList();
        this.loadAllocationHistory();
    }

    setupManageUsersSection() {
        const section = document.getElementById('manage-users-section');
        section.innerHTML = `
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 max-w-2xl mb-8">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-semibold text-gray-800">Add New Sub Admin</h3>
                </div>
                <div class="p-6">
                    <form id="addUserForm" class="space-y-6">
                        <div>
                            <label for="userName" class="block text-sm font-medium text-gray-700 mb-2">
                                Name
                            </label>
                            <input 
                                type="text" 
                                id="userName" 
                                required
                                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder="Enter user's name"
                            >
                        </div>
                        
                        <div>
                            <label for="userEmail" class="block text-sm font-medium text-gray-700 mb-2">
                                Email
                            </label>
                            <input 
                                type="email" 
                                id="userEmail" 
                                required
                                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder="Enter user's email"
                            >
                        </div>
                        
                        <div>
                            <label for="userPassword" class="block text-sm font-medium text-gray-700 mb-2">
                                Password
                            </label>
                            <input 
                                type="password" 
                                id="userPassword" 
                                required
                                minlength="6"
                                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder="Enter password"
                            >
                        </div>
                        
                            <button 
                                type="submit" 
                                class="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition duration-200 font-medium"
                            >
                                <i class="fas fa-user-plus mr-2"></i>
                                Add Sub Admin
                            </button>
                    </form>
                </div>
            </div>
            
            <div class="bg-white rounded-xl shadow-sm border border-gray-100">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-semibold text-gray-800">Manage Sub Admins</h3>
                </div>
                <div class="p-6">
                    <div id="usersList" class="space-y-4">
                        <!-- Users will be populated here -->
                    </div>
                </div>
            </div>
        `;
        
        // Add event listener for the form
        document.getElementById('addUserForm').addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleAddUser();
            });

        // Load users list
        this.loadUsersList();
    }

    setupSubAdminLogsSection() {
        const section = document.getElementById('sub-admin-logs-section');
        section.innerHTML = `
            <div class="bg-white rounded-xl shadow-sm border border-gray-100">
                <div class="px-6 py-4 border-b border-gray-200">
                    <div class="flex items-center justify-between">
                        <h3 class="text-lg font-semibold text-gray-800">Sub Admin Activity Logs</h3>
                        <button 
                            id="refreshLogs"
                            class="text-indigo-600 hover:text-indigo-700"
                        >
                            <i class="fas fa-refresh"></i>
                        </button>
                    </div>
                </div>
                <div class="p-6">
                    <div id="subAdminLogs" class="space-y-4">
                        <!-- Logs will be populated here -->
                    </div>
                </div>
            </div>
        `;

        // Add event listener for refresh button
        document.getElementById('refreshLogs').addEventListener('click', () => {
            this.loadActivityLogs();
        });

        // Load initial logs
        this.loadActivityLogs();
    }

    async loadActivityLogs() {
        try {
            const query = dbRefs.logs.orderByChild('timestamp');
            const snapshot = await query.limitToLast(20).once('value');
            const logs = snapshot.val() || {};
            const logsDiv = document.getElementById('subAdminLogs');
            
            logsDiv.innerHTML = '';
            
            Object.entries(logs).reverse().forEach(([logId, log]) => {
                const logItem = document.createElement('div');
                logItem.className = 'flex items-center space-x-4';
                logItem.innerHTML = `
                    <div class="flex-shrink-0">
                        ${this.getActivityIcon(log.action)}
                    </div>
                    <div class="flex-1">
                        <p class="text-sm text-gray-800">${this.getActivityDescription(log)}</p>
                        <p class="text-xs text-gray-500">${this.getTimeAgo(log.timestamp)}</p>
                    </div>
                `;
                logsDiv.appendChild(logItem);
            });

            if (Object.keys(logs).length === 0) {
                logsDiv.innerHTML = `
                    <div class="text-center py-8 text-gray-500">
                        No activity logs found
                    </div>
                `;
            }

        } catch (error) {
            console.error('Error loading activity logs:', error);
            this.showToast('Error loading activity logs', 'error');
        }
    }

    setupSuggestionsSection() {
        const section = document.getElementById('suggestions-section');
        section.innerHTML = `
            <div class="bg-white rounded-xl shadow-sm border border-gray-100 mb-8">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-semibold text-gray-800">Add Suggested Item</h3>
                </div>
                <div class="p-6">
                    <form id="addSuggestionForm" class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label for="suggestionName" class="block text-sm font-medium text-gray-700 mb-2">
                                Item Name
                            </label>
                            <input 
                                type="text" 
                                id="suggestionName" 
                                required
                                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder="Enter item name"
                            >
                        </div>
                        
                        <div>
                            <label for="suggestionPrice" class="block text-sm font-medium text-gray-700 mb-2">
                                Suggested Price ($)
                            </label>
                            <input 
                                type="number" 
                                id="suggestionPrice" 
                                required
                                min="0"
                                step="0.01"
                                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder="0.00"
                            >
                        </div>
                        
                        <div>
                            <label for="suggestionCategory" class="block text-sm font-medium text-gray-700 mb-2">
                                Category
                            </label>
                            <select 
                                id="suggestionCategory" 
                                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            >
                                <option value="office-supplies">Office Supplies</option>
                                <option value="equipment">Equipment</option>
                                <option value="software">Software</option>
                                <option value="travel">Travel</option>
                                <option value="meals">Meals</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        
                        <div class="flex items-end">
                            <button 
                                type="submit" 
                                class="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition duration-200 font-medium"
                            >
                                <i class="fas fa-plus mr-2"></i>
                                Add Suggestion
                            </button>
                        </div>
                        
                        <div class="md:col-span-2">
                            <label for="suggestionDescription" class="block text-sm font-medium text-gray-700 mb-2">
                                Description (Optional)
                            </label>
                            <textarea 
                                id="suggestionDescription" 
                                rows="3"
                                class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder="Add a description for this item"
                            ></textarea>
                        </div>
                    </form>
                </div>
            </div>
            
            <div class="bg-white rounded-xl shadow-sm border border-gray-100">
                <div class="px-6 py-4 border-b border-gray-200">
                    <h3 class="text-lg font-semibold text-gray-800">Current Suggestions</h3>
                </div>
                <div class="p-6">
                    <div id="suggestionsList" class="space-y-4">
                        <!-- Suggestions will be populated here -->
                    </div>
                </div>
            </div>
        `;
        
        // Add event listener for the form
        document.getElementById('addSuggestionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddSuggestion();
        });

        // Load suggestions list
        this.loadSuggestionsList();
    }

    async handleAddUser() {
        const name = document.getElementById('userName').value.trim();
        const email = document.getElementById('userEmail').value.trim();
        const password = document.getElementById('userPassword').value;

        if (!name || !email || !password) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }

        try {
            // Create user with email and password
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const uid = userCredential.user.uid;

            // Set user profile
            await userCredential.user.updateProfile({
                displayName: name
            });

            // Add user to database with sub_admin role
            await dbRefs.users.child(uid).set({
                name: name,
                email: email,
                role: 'sub_admin',
                allocated: 0,
                used: 0,
                createdAt: dbHelpers.getTimestamp(),
                createdBy: auth.currentUser.uid
            });

            // Log the action
            await authManager.logAction('user_created', {
                newUserId: uid,
                newUserEmail: email
            });

            // Reset form
            document.getElementById('addUserForm').reset();
            
            // Show success message
            this.showToast('Successfully added new sub admin', 'success');
            
            // Reload users list
            this.loadUsersList();

        } catch (error) {
            console.error('Error adding user:', error);
            this.showToast('Error adding user. Please try again.', 'error');
        }
    }

    async handleAllocateFunds() {
        const userId = document.getElementById('subAdminSelect').value;
        const amount = parseFloat(document.getElementById('allocationAmount').value);
        const note = document.getElementById('allocationNote').value.trim();

        if (!userId || !amount || amount <= 0) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }

        try {
            // Get user's current allocation
            const userSnapshot = await dbRefs.users.child(userId).once('value');
            const userData = userSnapshot.val();
            
            if (!userData) {
                this.showToast('User not found', 'error');
                return;
            }

            const currentAllocation = userData.allocated || 0;
            const newAllocation = currentAllocation + amount;

            // Update user's allocation
            await dbRefs.users.child(userId).update({
                allocated: newAllocation,
                lastAllocation: dbHelpers.getTimestamp()
            });

            // Log the action
            await authManager.logAction('allocation_made', {
                userId: userId,
                amount: amount,
                note: note
            });

            // Reset form
            document.getElementById('allocateFundsForm').reset();
            
            // Show success message
            this.showToast(`Successfully allocated ${dbHelpers.formatCurrency(amount)}`, 'success');
            
            // Reload data
            this.loadSummaryData();
            this.loadAllocationHistory();

        } catch (error) {
            console.error('Error allocating funds:', error);
            this.showToast('Error allocating funds. Please try again.', 'error');
        }
    }

    async handleAddSuggestion() {
        const name = document.getElementById('suggestionName').value.trim();
        const price = parseFloat(document.getElementById('suggestionPrice').value);
        const category = document.getElementById('suggestionCategory').value;
        const description = document.getElementById('suggestionDescription').value.trim();

        if (!name || !price || price <= 0) {
            this.showToast('Please fill in all required fields', 'error');
            return;
        }

        try {
            const suggestionId = dbHelpers.generateId();
            
            // Add suggestion to database
            await dbRefs.suggestions.child(suggestionId).set({
                name: name,
                price: price,
                category: category,
                description: description,
                timestamp: dbHelpers.getTimestamp(),
                addedBy: auth.currentUser.uid,
                status: 'pending'
            });

            // Log the action
            await authManager.logAction('suggestion_added', {
                suggestionId: suggestionId,
                name: name,
                price: price
            });

            // Reset form
            document.getElementById('addSuggestionForm').reset();
            
            // Show success message
            this.showToast('Successfully added suggestion', 'success');
            
            // Reload suggestions list
            this.loadSuggestionsList();

        } catch (error) {
            console.error('Error adding suggestion:', error);
            this.showToast('Error adding suggestion. Please try again.', 'error');
        }
    }

    async loadUsersList() {
        const usersList = document.getElementById('usersList');
        
        try {
            // Show loading state
            usersList.innerHTML = `
                <div class="text-center py-8">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    <p class="mt-2 text-gray-600">Loading users...</p>
                </div>
            `;

            // Wait for Firebase to be ready
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Get current user for comparison
            const currentUser = auth.currentUser;
            if (!currentUser) {
                throw new Error('No authenticated user found');
            }

            const snapshot = await dbRefs.users.once('value');
            const users = snapshot.val() || {};
            
            usersList.innerHTML = '';
            
            let hasUsers = false;
            
            Object.entries(users).forEach(([uid, user]) => {
                // Skip if not a sub_admin
                if (user.role !== 'sub_admin') return;
                
                hasUsers = true;
                const userCard = document.createElement('div');
                userCard.className = 'bg-white p-4 rounded-lg border border-gray-200 hover:shadow-md transition duration-200';
                
                // Calculate usage percentage
                const allocated = user.allocated || 0;
                const used = user.used || 0;
                const usagePercent = allocated > 0 ? Math.round((used / allocated) * 100) : 0;
                
                // Determine status color
                let statusColor = 'green';
                if (usagePercent >= 90) {
                    statusColor = 'red';
                } else if (usagePercent >= 70) {
                    statusColor = 'yellow';
                }

                userCard.innerHTML = `
                    <div class="flex items-center justify-between">
                        <div class="flex-grow">
                            <h4 class="font-medium text-gray-900">${user.name || 'Unnamed User'}</h4>
                            <p class="text-sm text-gray-600">${user.email}</p>
                            <p class="text-xs text-gray-500 mt-1">Created: ${this.getTimeAgo(user.createdAt || '')}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-sm font-medium text-gray-600">Allocated</p>
                            <p class="text-lg font-bold text-gray-900">${dbHelpers.formatCurrency(allocated)}</p>
                            <div class="mt-2">
                                <div class="w-24 bg-gray-200 rounded-full h-2">
                                    <div class="bg-${statusColor}-600 h-2 rounded-full" style="width: ${usagePercent}%"></div>
                                </div>
                                <p class="text-xs text-gray-500 mt-1">${usagePercent}% used</p>
                            </div>
                        </div>
                    </div>
                    <div class="mt-4 flex justify-end space-x-2">
                        <button 
                            onclick="adminDashboard.handleEditUser('${uid}')"
                            class="px-3 py-1 text-sm text-indigo-600 hover:bg-indigo-50 rounded"
                        >
                            <i class="fas fa-edit"></i>
                            Edit
                        </button>
                        <button 
                            onclick="adminDashboard.handleDeleteUser('${uid}')"
                            class="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                        >
                            <i class="fas fa-trash-alt"></i>
                            Delete
                        </button>
                    </div>
                `;
                usersList.appendChild(userCard);
            });

            // Show message if no users found
            if (!hasUsers) {
                usersList.innerHTML = `
                    <div class="text-center py-8 text-gray-500">
                        <i class="fas fa-users text-4xl mb-3"></i>
                        <p>No sub admin users found</p>
                        <p class="text-sm mt-2">Add a new sub admin using the form above</p>
                    </div>
                `;
            }

        } catch (error) {
            console.error('Error loading users list:', error);
            
            // Show error state
            usersList.innerHTML = `
                <div class="text-center py-8 text-red-500">
                    <i class="fas fa-exclamation-circle text-4xl mb-3"></i>
                    <p>Error loading users list</p>
                    <p class="text-sm mt-2">${error.message}</p>
                    <button 
                        onclick="adminDashboard.loadUsersList()"
                        class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition duration-200"
                    >
                        <i class="fas fa-sync-alt mr-2"></i>
                        Retry
                    </button>
                </div>
            `;
            
            this.showToast('Error loading users list: ' + error.message, 'error');
        }
    }

    async loadSubAdminList() {
        try {
            const snapshot = await dbRefs.users.orderByChild('role').equalTo('sub_admin').once('value');
            const users = snapshot.val() || {};
            const select = document.getElementById('subAdminSelect');
            
            // Clear existing options
            select.innerHTML = '<option value="">Choose a sub admin</option>';
            
            // Add options for each sub admin
            Object.entries(users).forEach(([uid, user]) => {
                const option = document.createElement('option');
                option.value = uid;
                option.textContent = `${user.name} (${user.email})`;
                select.appendChild(option);
            });

        } catch (error) {
            console.error('Error loading sub admin list:', error);
            this.showToast('Error loading sub admin list', 'error');
        }
    }

    async loadAllocationHistory() {
        try {
            const snapshot = await dbRefs.logs.orderByChild('action').equalTo('allocation_made').limitToLast(10).once('value');
            const logs = snapshot.val() || {};
            const historyDiv = document.getElementById('allocationHistory');
            
            historyDiv.innerHTML = '';
            
            Object.entries(logs).reverse().forEach(([logId, log]) => {
                const historyItem = document.createElement('div');
                historyItem.className = 'flex items-center justify-between p-4 bg-gray-50 rounded-lg';
                historyItem.innerHTML = `
                    <div>
                        <p class="font-medium text-gray-900">${dbHelpers.formatCurrency(log.details.amount)}</p>
                        <p class="text-sm text-gray-600">${this.getTimeAgo(log.timestamp)}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-sm text-gray-600">${log.details.note || 'No note'}</p>
                    </div>
                `;
                historyDiv.appendChild(historyItem);
            });

            if (Object.keys(logs).length === 0) {
                historyDiv.innerHTML = `
                    <div class="text-center py-8 text-gray-500">
                        No allocation history yet
                    </div>
                `;
            }

        } catch (error) {
            console.error('Error loading allocation history:', error);
            this.showToast('Error loading allocation history', 'error');
        }
    }

    async loadSuggestionsList() {
        try {
            const snapshot = await dbRefs.suggestions.orderByChild('timestamp').once('value');
            const suggestions = snapshot.val() || {};
            const suggestionsDiv = document.getElementById('suggestionsList');
            
            suggestionsDiv.innerHTML = '';
            
            Object.entries(suggestions).reverse().forEach(([suggestionId, suggestion]) => {
                const suggestionItem = document.createElement('div');
                suggestionItem.className = 'bg-gray-50 rounded-lg p-4';
                suggestionItem.innerHTML = `
                    <div class="flex items-center justify-between">
                        <div>
                        <h4 class="font-medium text-gray-900">${suggestion.name}</h4>
                            <p class="text-sm text-gray-600">${suggestion.category}</p>
                    </div>
                        <div class="text-right">
                            <p class="text-lg font-bold text-gray-900">${dbHelpers.formatCurrency(suggestion.price)}</p>
                            <p class="text-sm text-gray-600">${this.getTimeAgo(suggestion.timestamp)}</p>
                        </div>
                    </div>
                    ${suggestion.description ? `
                        <p class="mt-2 text-sm text-gray-600">${suggestion.description}</p>
                    ` : ''}
                    <div class="mt-4 flex justify-end space-x-2">
                    <button 
                            onclick="adminDashboard.handleApproveSuggestion('${suggestionId}')"
                            class="px-3 py-1 text-sm text-green-600 hover:bg-green-50 rounded"
                    >
                            <i class="fas fa-check"></i>
                            Approve
                    </button>
                        <button 
                            onclick="adminDashboard.handleRejectSuggestion('${suggestionId}')"
                            class="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                        >
                            <i class="fas fa-times"></i>
                            Reject
                        </button>
                    </div>
                `;
                suggestionsDiv.appendChild(suggestionItem);
            });

            if (Object.keys(suggestions).length === 0) {
                suggestionsDiv.innerHTML = `
                    <div class="text-center py-8 text-gray-500">
                        No suggestions yet
                    </div>
                `;
            }

        } catch (error) {
            console.error('Error loading suggestions list:', error);
            this.showToast('Error loading suggestions list', 'error');
        }
    }

    async handleDeleteUser(uid) {
        try {
            // Get user data first
            const userSnapshot = await dbRefs.users.child(uid).once('value');
            const userData = userSnapshot.val();

            if (!userData) {
                throw new Error('User not found');
            }

            // Create confirmation modal
            const modalHtml = `
                <div id="deleteUserModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                        <div class="mt-3 text-center">
                            <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                                <i class="fas fa-exclamation-triangle text-red-600"></i>
                            </div>
                            <h3 class="text-lg font-medium text-gray-900 mt-4">Delete Sub Admin</h3>
                            <div class="mt-2 px-7 py-3">
                                <p class="text-sm text-gray-500">
                                    Are you sure you want to delete ${userData.name || 'this user'}? This action cannot be undone.
                                </p>
                                <div class="mt-4 text-sm text-gray-600">
                                    <p><strong>Email:</strong> ${userData.email}</p>
                                    <p><strong>Allocated Funds:</strong> ${dbHelpers.formatCurrency(userData.allocated || 0)}</p>
                                </div>
                            </div>
                            <div class="flex justify-center space-x-2 mt-5">
                                <button 
                                    onclick="document.getElementById('deleteUserModal').remove()"
                                    class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                                <button 
                                    id="confirmDeleteBtn"
                                    class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                >
                                    Delete User
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Add modal to body
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            // Add click handler for delete confirmation
            document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
                try {
                    // Show loading state
                    const btn = document.getElementById('confirmDeleteBtn');
                    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Deleting...';
                    btn.disabled = true;

                    // Delete user from authentication
                    await auth.deleteUser(uid);

                    // Delete user from database
                    await dbRefs.users.child(uid).remove();

                    // Log the action
                    await authManager.logAction('user_deleted', {
                        deletedUserId: uid,
                        deletedUserEmail: userData.email
                    });

                    // Remove modal
                    document.getElementById('deleteUserModal').remove();
                    
                    // Show success message
                    this.showToast('Successfully deleted sub admin', 'success');
                    
                    // Reload users list
                    this.loadUsersList();

                } catch (error) {
                    console.error('Error deleting user:', error);
                    
                    // Show error in modal
                    const modalContent = document.querySelector('#deleteUserModal .text-center');
                    modalContent.innerHTML = `
                        <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                            <i class="fas fa-times text-red-600"></i>
                        </div>
                        <h3 class="text-lg font-medium text-gray-900 mt-4">Error Deleting User</h3>
                        <div class="mt-2 px-7 py-3">
                            <p class="text-sm text-red-500">${error.message}</p>
                        </div>
                        <div class="flex justify-center mt-5">
                            <button 
                                onclick="document.getElementById('deleteUserModal').remove()"
                                class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                            >
                                Close
                            </button>
                        </div>
                    `;
                    
                    this.showToast('Error deleting user: ' + error.message, 'error');
                }
            });

        } catch (error) {
            console.error('Error preparing to delete user:', error);
            this.showToast('Error preparing to delete user: ' + error.message, 'error');
        }
    }

    async handleApproveSuggestion(suggestionId) {
        try {
            // Get suggestion data first
            const suggestionSnapshot = await dbRefs.suggestions.child(suggestionId).once('value');
            const suggestionData = suggestionSnapshot.val();

            if (!suggestionData) {
                this.showToast('Suggestion not found', 'error');
                return;
            }

            // Update suggestion status
            await dbRefs.suggestions.child(suggestionId).update({
                status: 'approved',
                approvedAt: dbHelpers.getTimestamp(),
                approvedBy: auth.currentUser.uid
            });

            // Log the action
            await authManager.logAction('suggestion_approved', {
                suggestionId: suggestionId,
                name: suggestionData.name,
                price: suggestionData.price
            });

            // Show success message
            this.showToast('Successfully approved suggestion', 'success');
            
            // Reload suggestions list
            this.loadSuggestionsList();

        } catch (error) {
            console.error('Error approving suggestion:', error);
            this.showToast('Error approving suggestion. Please try again.', 'error');
        }
    }

    async handleRejectSuggestion(suggestionId) {
        try {
            // Get suggestion data first
            const suggestionSnapshot = await dbRefs.suggestions.child(suggestionId).once('value');
            const suggestionData = suggestionSnapshot.val();

            if (!suggestionData) {
                this.showToast('Suggestion not found', 'error');
                return;
            }

            // Update suggestion status
            await dbRefs.suggestions.child(suggestionId).update({
                status: 'rejected',
                rejectedAt: dbHelpers.getTimestamp(),
                rejectedBy: auth.currentUser.uid
            });

            // Log the action
            await authManager.logAction('suggestion_rejected', {
                suggestionId: suggestionId,
                name: suggestionData.name,
                price: suggestionData.price
            });

            // Show success message
            this.showToast('Successfully rejected suggestion', 'success');
            
            // Reload suggestions list
            this.loadSuggestionsList();

        } catch (error) {
            console.error('Error rejecting suggestion:', error);
            this.showToast('Error rejecting suggestion. Please try again.', 'error');
        }
    }

    async handleEditUser(uid) {
        try {
            // Get user data
            const snapshot = await dbRefs.users.child(uid).once('value');
            const userData = snapshot.val();
            
            if (!userData) {
                throw new Error('User not found');
            }

            // Create modal HTML
            const modalHtml = `
                <div id="editUserModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                    <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                        <div class="mt-3">
                            <h3 class="text-lg font-semibold text-gray-800 mb-4">Edit Sub Admin</h3>
                            <form id="editUserForm" class="space-y-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Name</label>
                                    <input 
                                        type="text" 
                                        id="editUserName" 
                                        value="${userData.name || ''}"
                                        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        required
                                    >
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Email</label>
                                    <input 
                                        type="email" 
                                        value="${userData.email}"
                                        class="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100"
                                        disabled
                                    >
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-2">Allocated Funds</label>
                                    <input 
                                        type="number" 
                                        id="editUserAllocation" 
                                        value="${userData.allocated || 0}"
                                        min="0"
                                        step="0.01"
                                        class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        required
                                    >
                                </div>
                                <div class="flex justify-end space-x-2 mt-5">
                                    <button 
                                        type="button"
                                        onclick="document.getElementById('editUserModal').remove()"
                                        class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        class="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            `;

            // Add modal to body
            document.body.insertAdjacentHTML('beforeend', modalHtml);

            // Add form submit handler
            document.getElementById('editUserForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const newName = document.getElementById('editUserName').value.trim();
                const newAllocation = parseFloat(document.getElementById('editUserAllocation').value);

                try {
                    // Update user data
                    await dbRefs.users.child(uid).update({
                        name: newName,
                        allocated: newAllocation,
                        updatedAt: dbHelpers.getTimestamp()
                    });

                    // Log the action
                    await authManager.logAction('user_updated', {
                        targetUserId: uid,
                        updates: {
                            name: newName,
                            allocated: newAllocation
                        }
                    });

                    // Remove modal
                    document.getElementById('editUserModal').remove();
                    
                    // Show success message
                    this.showToast('Successfully updated user details', 'success');
                    
                    // Reload users list
                    this.loadUsersList();
                    
                } catch (error) {
                    console.error('Error updating user:', error);
                    this.showToast('Error updating user: ' + error.message, 'error');
                }
            });

        } catch (error) {
            console.error('Error opening edit modal:', error);
            this.showToast('Error opening edit modal: ' + error.message, 'error');
        }
    }
}

// Initialize admin dashboard
let adminDashboard;
document.addEventListener('DOMContentLoaded', () => {
    adminDashboard = new AdminDashboard();
});

// Export for global use
window.adminDashboard = adminDashboard;

