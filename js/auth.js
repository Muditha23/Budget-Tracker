// Authentication Module
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.userRole = null;
        this.init();
    }

    init() {
        // Listen for authentication state changes
        auth.onAuthStateChanged(async (user) => {
            try {
                if (user) {
                    console.log('Auth state changed: User logged in', user.uid);
                    this.currentUser = user;
                    
                    // Wait longer for Firebase to be ready (increased from 1000ms to 2000ms)
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // Retry mechanism for getting user data
                    let retryCount = 0;
                    let userData = null;
                    
                    while (retryCount < 3) {
                        try {
                            const userSnapshot = await dbRefs.users.child(user.uid).once('value');
                            userData = userSnapshot.val();
                            if (userData) break;
                        } catch (error) {
                            console.warn(`Attempt ${retryCount + 1} failed:`, error);
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                        retryCount++;
                    }
                    
                    if (!userData) {
                        console.warn('User data not found in database after retries');
                        await this.logout();
                        return;
                    }
                    
                    this.userRole = userData.role;
                    console.log('Retrieved user role:', this.userRole);
                    
                    if (!this.userRole) {
                        console.warn('No role found for user, logging out');
                        await this.logout();
                        return;
                    }
                    
                    // Update user's last login
                    try {
                        await dbRefs.users.child(user.uid).update({
                            lastLogin: dbHelpers.getTimestamp()
                        });
                    } catch (error) {
                        console.warn('Failed to update last login time:', error);
                        // Continue anyway as this is not critical
                    }
                    
                    this.redirectBasedOnRole();
                } else {
                    console.log('Auth state changed: No user');
                    this.currentUser = null;
                    this.userRole = null;
                    this.redirectToLogin();
                }
            } catch (error) {
                console.error('Error in auth state change handler:', error);
                if (error.message.includes('permission_denied')) {
                    console.warn('Permission denied while getting user role. Please check Firebase rules configuration.');
                    console.warn('Current user UID:', user ? user.uid : 'No user');
                }
                this.currentUser = null;
                this.userRole = null;
                this.redirectToLogin();
            }
        });
    }

    // Get user role from database
    async getUserRole(uid) {
        try {
            // Add a small delay before checking to ensure Firebase is ready
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const snapshot = await dbRefs.users.child(uid).once('value');
            const userData = snapshot.val();
            
            if (!userData || !userData.role) {
                console.warn('No user data or role found for uid:', uid);
                return null;
            }
            
            return userData.role;
        } catch (error) {
            console.error('Error getting user role:', error);
            
            // If it's a permission error, log additional context
            if (error.message.includes('permission_denied')) {
                console.warn('Permission denied while getting user role. Please check Firebase rules configuration.');
                console.warn('Current user UID:', auth.currentUser ? auth.currentUser.uid : 'No user');
            }
            
            throw error; // Propagate the error to be handled by the caller
        }
    }

    // Validate role
    validateRole(role) {
        const validRoles = ['admin', 'sub_admin'];
        if (!validRoles.includes(role)) {
            throw new Error('Invalid role specified');
        }
        return true;
    }

    // Login with email and password
    async login(email, password) {
        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            
            // Get user role
            const role = await this.getUserRole(userCredential.user.uid);
            if (!role) {
                await auth.signOut();
                return { success: false, error: 'Access denied. Please contact your administrator.' };
            }

            return { success: true, user: userCredential.user, role: role };
        } catch (error) {
            console.error('Login error:', error);
            let errorMessage = 'An error occurred during login.';
            
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
                errorMessage = 'Invalid email or password.';
            } else if (error.code === 'auth/too-many-requests') {
                errorMessage = 'Too many failed attempts. Please try again later.';
            } else if (error.message.includes('permission_denied')) {
                errorMessage = 'Access denied. Please contact your administrator.';
            }
            
            return { success: false, error: errorMessage };
        }
    }

    // Login with Google
    async loginWithGoogle() {
        try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const userCredential = await auth.signInWithPopup(provider);
            
            // Check if user exists in database
            const role = await this.getUserRole(userCredential.user.uid);
            
            if (!role) {
                // If no role found, sign out the user
                await auth.signOut();
                return { success: false, error: 'Access denied. Please contact your administrator.' };
            }
            
            return { success: true, user: userCredential.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Create new user (admin only)
    async createUser(email, password, name, role = 'sub_admin') {
        try {
            // Check if current user is admin
            if (!this.isAdmin()) {
                throw new Error('Only administrators can create new users');
            }

            // Validate role
            this.validateRole(role);

            // Create user in Firebase Auth
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            
            // Add user to database
            await dbRefs.users.child(user.uid).set({
                email: email,
                name: name,
                role: role,
                createdAt: dbHelpers.getTimestamp(),
                allocated: 0,
                used: 0
            });

            // Log the action
            await this.logAction('user_created', {
                adminId: this.currentUser.uid,
                userId: user.uid,
                email: email,
                role: role
            });

            // Sign out the newly created user (since we're creating it while logged in as admin)
            await auth.signOut();
            // Sign back in as the admin
            await auth.signInWithEmailAndPassword(this.currentUser.email, this.currentUser.password);

            return { success: true, user: user };
        } catch (error) {
            // If user was created but database update failed, delete the user
            if (error.code !== 'auth/email-already-in-use' && error.code !== 'auth/invalid-email') {
                try {
                    const user = auth.currentUser;
                    if (user && user.email === email) {
                        await user.delete();
                    }
                } catch (deleteError) {
                    console.error('Error cleaning up user after failed creation:', deleteError);
                }
            }
            return { success: false, error: error.message };
        }
    }

    // Logout
    async logout() {
        try {
            await auth.signOut();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Update user role (admin only)
    async updateUserRole(uid, newRole) {
        try {
            // Validate role
            this.validateRole(newRole);

            // Check if current user is admin
            if (!this.isAdmin()) {
                throw new Error('Only administrators can update user roles');
            }

            await dbRefs.users.child(uid).update({
                role: newRole,
                updatedAt: dbHelpers.getTimestamp()
            });

            // Log the action
            await this.logAction('role_updated', {
                adminId: this.currentUser.uid,
                targetUserId: uid,
                newRole: newRole
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Delete user (admin only)
    async deleteUser(uid) {
        try {
            // Check if current user is admin
            if (!this.isAdmin()) {
                throw new Error('Only administrators can delete users');
            }

            // Get user data before deletion
            const snapshot = await dbRefs.users.child(uid).once('value');
            const userData = snapshot.val();

            if (!userData) {
                throw new Error('User not found');
            }

            // Remove from database
            await dbRefs.users.child(uid).remove();
            
            // Log the action
            await this.logAction('user_deleted', {
                adminId: this.currentUser.uid,
                deletedUserId: uid,
                deletedUserEmail: userData.email,
                deletedUserRole: userData.role
            });

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Log actions
    async logAction(action, details) {
        const logId = dbHelpers.generateId();
        await dbRefs.logs.child(logId).set({
            action: action,
            details: details,
            timestamp: dbHelpers.getTimestamp(),
            userId: this.currentUser ? this.currentUser.uid : null
        });
    }

    // Redirect based on user role
    redirectBasedOnRole() {
        const currentPage = window.location.pathname.split('/').pop();
        
        if (this.userRole === 'admin') {
            if (currentPage !== 'main-admin.html' && currentPage !== '') {
                window.location.href = 'main-admin.html';
            }
        } else if (this.userRole === 'sub_admin') {
            if (currentPage !== 'index.html' && currentPage !== '') {
                window.location.href = 'index.html';
            }
        }
    }

    // Redirect to login
    redirectToLogin() {
        const currentPage = window.location.pathname.split('/').pop();
        if (currentPage !== 'login.html' && currentPage !== '') {
            window.location.href = 'login.html';
        }
    }

    // Check if user is admin
    isAdmin() {
        return this.userRole === 'admin';
    }

    // Check if user is sub admin
    isSubAdmin() {
        return this.userRole === 'sub_admin';
    }

    // Get current user info
    getCurrentUser() {
        return {
            uid: this.currentUser ? this.currentUser.uid : null,
            email: this.currentUser ? this.currentUser.email : null,
            role: this.userRole
        };
    }
}

// Initialize auth manager
const authManager = new AuthManager();

// Export for global use
window.authManager = authManager;

