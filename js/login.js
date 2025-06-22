// Login and Registration functionality
document.addEventListener('DOMContentLoaded', function() {
    // Form elements
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showLoginBtn = document.getElementById('showLoginBtn');
    const showRegisterBtn = document.getElementById('showRegisterBtn');

    // Login form elements
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const loginBtn = document.getElementById('loginBtn');

    // Registration form elements
    const registerEmail = document.getElementById('registerEmail');
    const registerPassword = document.getElementById('registerPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const userRole = document.getElementById('userRole');
    const registerBtn = document.getElementById('registerBtn');

    // Message elements
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    const loadingMessage = document.getElementById('loadingMessage');

    // Toggle between login and registration forms
    showLoginBtn.addEventListener('click', () => {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        showLoginBtn.classList.add('text-blue-600', 'border-blue-600');
        showLoginBtn.classList.remove('text-gray-600', 'border-transparent');
        showRegisterBtn.classList.remove('text-blue-600', 'border-blue-600');
        showRegisterBtn.classList.add('text-gray-600', 'border-transparent');
        hideMessages();
    });

    showRegisterBtn.addEventListener('click', () => {
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
        showRegisterBtn.classList.add('text-blue-600', 'border-blue-600');
        showRegisterBtn.classList.remove('text-gray-600', 'border-transparent');
        showLoginBtn.classList.remove('text-blue-600', 'border-blue-600');
        showLoginBtn.classList.add('text-gray-600', 'border-transparent');
        hideMessages();
    });

    // Handle login form submission
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = loginEmail.value.trim();
        const password = loginPassword.value;

        if (!email || !password) {
            showError('Please fill in all fields.');
            return;
        }

        try {
            showLoading(true);
            hideMessages();

            // Sign in with Firebase Auth
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            console.log('Successfully signed in:', user.email);

            // Check user role and redirect
            try {
                const userSnapshot = await database.ref('users/' + user.uid).once('value');
                console.log('User data snapshot:', userSnapshot.val());
                const userData = userSnapshot.val();

                if (!userData || !userData.role) {
                    throw new Error('User role not found. Please contact administrator.');
                }

                // Redirect based on role
                if (userData.role === 'admin') {
                    window.location.href = 'index.html';
                } else if (userData.role === 'subadmin') {
                    window.location.href = 'sub_index.html';
                } else {
                    throw new Error('Invalid user role.');
                }
            } catch (dbError) {
                console.error('Database access error:', dbError);
                await auth.signOut(); // Sign out if database access fails
                throw new Error('Failed to access user data: ' + dbError.message);
            }

        } catch (error) {
            console.error('Login error:', error);
            showError(getErrorMessage(error.code || error.message));
        } finally {
            showLoading(false);
        }
    });

    // Handle registration form submission
    registerForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const email = registerEmail.value.trim();
        const password = registerPassword.value;
        const confirmPwd = confirmPassword.value;
        const role = userRole.value;

        // Validation
        if (!email || !password || !confirmPwd || !role) {
            showError('Please fill in all fields.');
            return;
        }

        if (password !== confirmPwd) {
            showError('Passwords do not match.');
            return;
        }

        if (password.length < 6) {
            showError('Password must be at least 6 characters long.');
            return;
        }

        try {
            showLoading(true);
            hideMessages();

            // Check if admin role already exists
            if (role === 'admin') {
                try {
                    console.log('Checking for existing admin...');
                    const adminSnapshot = await database.ref('users').orderByChild('role').equalTo('admin').once('value');
                    console.log('Admin check result:', adminSnapshot.val());
                    if (adminSnapshot.exists()) {
                        throw new Error('Main Admin role already exists. Only one Main Admin is allowed.');
                    }
                } catch (adminCheckError) {
                    console.error('Admin check error:', adminCheckError);
                    if (adminCheckError.code === 'PERMISSION_DENIED') {
                        // Special handling for permission denied during admin check
                        await database.ref('users').once('value', (snapshot) => {
                            if (!snapshot.exists()) {
                                // No users exist yet, this might be the first admin
                                console.log('No users exist, proceeding with admin creation');
                                return;
                            }
                            throw adminCheckError;
                        });
                    } else {
                        throw adminCheckError;
                    }
                }
            }

            // Create user account
            console.log('Creating user account...');
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            console.log('User account created:', user.email);

            // Set user role in database
            try {
                console.log('Setting user role...');
                await database.ref('users/' + user.uid).set({
                    email: email,
                    role: role,
                    createdAt: firebase.database.ServerValue.TIMESTAMP
                });
                console.log('User role set successfully');

                // If it's a sub-admin, initialize their budget data
                if (role === 'subadmin') {
                    console.log('Initializing sub-admin data...');
                    await database.ref('users/' + user.uid).update({
                        allocatedBudget: 0,
                        usedBudget: 0
                    });

                    // Initialize sub-admin's purchase history
                    await database.ref('purchases/' + user.uid).set({
                        initialized: true
                    });
                    console.log('Sub-admin data initialized');
                }

                showSuccess('Registration successful! Please sign in.');
                
                // Clear form and switch to login
                registerForm.reset();
                showLoginBtn.click();

            } catch (dbError) {
                console.error('Database write error:', dbError);
                // If database write fails, delete the auth user
                await user.delete();
                throw new Error('Failed to set user data: ' + dbError.message);
            }

        } catch (error) {
            console.error('Registration error:', error);
            showError(getErrorMessage(error.code || error.message));
        } finally {
            showLoading(false);
        }
    });

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
        successMessage.classList.add('hidden');
    }

    function showSuccess(message) {
        successMessage.textContent = message;
        successMessage.classList.remove('hidden');
        errorMessage.classList.add('hidden');
    }

    function hideMessages() {
        errorMessage.classList.add('hidden');
        successMessage.classList.add('hidden');
    }

    function showLoading(show) {
        if (show) {
            loadingMessage.classList.remove('hidden');
            loginBtn.disabled = true;
            registerBtn.disabled = true;
            loginBtn.textContent = 'Processing...';
            registerBtn.textContent = 'Processing...';
        } else {
            loadingMessage.classList.add('hidden');
            loginBtn.disabled = false;
            registerBtn.disabled = false;
            loginBtn.textContent = 'Sign In';
            registerBtn.textContent = 'Register';
        }
    }

    function getErrorMessage(errorCode) {
        switch (errorCode) {
            case 'auth/user-not-found':
                return 'No account found with this email address.';
            case 'auth/wrong-password':
                return 'Incorrect password.';
            case 'auth/invalid-email':
                return 'Invalid email address.';
            case 'auth/email-already-in-use':
                return 'This email is already registered.';
            case 'auth/user-disabled':
                return 'This account has been disabled.';
            case 'auth/too-many-requests':
                return 'Too many failed attempts. Please try again later.';
            case 'auth/weak-password':
                return 'Password is too weak. Use at least 6 characters.';
            case 'PERMISSION_DENIED':
                return 'Permission denied. This might happen if you\'re trying to create an admin account when one already exists.';
            default:
                return errorCode || 'An error occurred. Please try again.';
        }
    }

    // Check if user is already logged in
    auth.onAuthStateChanged((user) => {
        if (user) {
            console.log('Auth state changed: User is signed in:', user.email);
            // User is already logged in, check role and redirect
            database.ref('users/' + user.uid).once('value')
                .then((snapshot) => {
                    console.log('User data:', snapshot.val());
                    const userData = snapshot.val();
                    if (userData && userData.role) {
                        if (userData.role === 'admin') {
                            window.location.href = 'index.html';
                        } else if (userData.role === 'subadmin') {
                            window.location.href = 'sub_index.html';
                        }
                    }
                })
                .catch((error) => {
                    console.error('Error checking user role:', error);
                    auth.signOut();
                });
        } else {
            console.log('Auth state changed: No user signed in');
        }
    });
});

