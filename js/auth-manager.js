// Authentication utilities for admin functions
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        auth.onAuthStateChanged((user) => {
            if (user) {
                this.currentUser = user;
                this.verifyAdminAccess();
            } else {
                window.location.href = 'login.html';
            }
        });
    }

    async verifyAdminAccess() {
        try {
            const userSnapshot = await database.ref('users/' + this.currentUser.uid).once('value');
            const userData = userSnapshot.val();

            if (!userData || userData.role !== 'admin') {
                await auth.signOut();
                window.location.href = 'login.html';
                return;
            }

            // User is verified admin, initialize dashboard
            if (typeof initializeDashboard === 'function') {
                initializeDashboard();
            }
        } catch (error) {
            console.error('Error verifying admin access:', error);
            await auth.signOut();
            window.location.href = 'login.html';
        }
    }

    async createSubAdmin(email, password, budgetAmount) {
        try {
            // Create user account
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Set user role and budget in database
            await database.ref('users/' + user.uid).set({
                email: email,
                role: 'subadmin',
                allocatedBudget: parseFloat(budgetAmount),
                usedBudget: 0,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                createdBy: this.currentUser.uid
            });

            // Initialize sub-admin's purchase history
            await database.ref('purchases/' + user.uid).set({
                initialized: true
            });

            return { success: true, uid: user.uid };
        } catch (error) {
            console.error('Error creating sub admin:', error);
            throw error;
        }
    }

    async deleteSubAdmin(uid) {
        try {
            // Remove user data from database
            await database.ref('users/' + uid).remove();
            
            // Remove purchase history
            await database.ref('purchases/' + uid).remove();

            // Note: Firebase Auth doesn't allow deleting users from client-side
            // In production, you would need a Cloud Function for this
            console.log('Sub admin data removed from database. User account still exists in Auth.');
            
            return { success: true };
        } catch (error) {
            console.error('Error deleting sub admin:', error);
            throw error;
        }
    }

    async updateSubAdminBudget(uid, newBudget) {
        try {
            await database.ref('users/' + uid + '/allocatedBudget').set(parseFloat(newBudget));
            return { success: true };
        } catch (error) {
            console.error('Error updating sub admin budget:', error);
            throw error;
        }
    }

    async logout() {
        try {
            await auth.signOut();
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error signing out:', error);
        }
    }
}

// Sub-admin authentication for the purchase form
class SubAdminAuth {
    constructor() {
        this.currentUser = null;
        this.userData = null;
        this.init();
    }

    init() {
        auth.onAuthStateChanged((user) => {
            if (user) {
                this.currentUser = user;
                this.verifySubAdminAccess();
            } else {
                window.location.href = 'login.html';
            }
        });
    }

    async verifySubAdminAccess() {
        try {
            const userSnapshot = await database.ref('users/' + this.currentUser.uid).once('value');
            const userData = userSnapshot.val();

            if (!userData || userData.role !== 'subadmin') {
                await auth.signOut();
                window.location.href = 'login.html';
                return;
            }

            this.userData = userData;

            // User is verified sub-admin, initialize interface
            if (typeof initializeSubAdminInterface === 'function') {
                initializeSubAdminInterface(userData);
            }
        } catch (error) {
            console.error('Error verifying sub admin access:', error);
            await auth.signOut();
            window.location.href = 'login.html';
        }
    }

    async submitPurchase(cartItems) {
        try {
            const totalAmount = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            
            // Check if user has enough budget
            if (this.userData.usedBudget + totalAmount > this.userData.allocatedBudget) {
                throw new Error('Insufficient budget for this purchase.');
            }

            // Create purchase record
            const purchaseData = {
                userId: this.currentUser.uid,
                userEmail: this.currentUser.email,
                items: cartItems,
                totalAmount: totalAmount,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                status: 'completed'
            };

            // Save purchase to database
            const purchaseRef = await database.ref('purchases/' + this.currentUser.uid).push(purchaseData);

            // Update user's used budget
            const newUsedBudget = this.userData.usedBudget + totalAmount;
            await database.ref('users/' + this.currentUser.uid + '/usedBudget').set(newUsedBudget);

            // Update local userData
            this.userData.usedBudget = newUsedBudget;

            return { success: true, purchaseId: purchaseRef.key };
        } catch (error) {
            console.error('Error submitting purchase:', error);
            throw error;
        }
    }

    async logout() {
        try {
            await auth.signOut();
            window.location.href = 'login.html';
        } catch (error) {
            console.error('Error signing out:', error);
        }
    }
}

