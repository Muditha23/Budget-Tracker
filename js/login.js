// Login functionality
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const errorMessage = document.getElementById('errorMessage');
    const loadingMessage = document.getElementById('loadingMessage');

    // Handle form submission
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (!email || !password) {
            showError('Please fill in all fields.');
            return;
        }

        try {
            showLoading(true);
            hideError();

            // Sign in with Firebase Auth
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Check user role and redirect
            const userSnapshot = await database.ref('users/' + user.uid).once('value');
            const userData = userSnapshot.val();

            if (!userData || !userData.role) {
                throw new Error('User role not found. Please contact administrator.');
            }

            // Redirect based on role
            if (userData.role === 'admin') {
                window.location.href = 'admin.html';
            } else if (userData.role === 'subadmin') {
                window.location.href = 'index.html';
            } else {
                throw new Error('Invalid user role.');
            }

        } catch (error) {
            console.error('Login error:', error);
            showError(getErrorMessage(error.code || error.message));
        } finally {
            showLoading(false);
        }
    });

    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    }

    function hideError() {
        errorMessage.classList.add('hidden');
    }

    function showLoading(show) {
        if (show) {
            loadingMessage.classList.remove('hidden');
            loginBtn.disabled = true;
            loginBtn.textContent = 'Signing In...';
        } else {
            loadingMessage.classList.add('hidden');
            loginBtn.disabled = false;
            loginBtn.textContent = 'Sign In';
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
            case 'auth/user-disabled':
                return 'This account has been disabled.';
            case 'auth/too-many-requests':
                return 'Too many failed login attempts. Please try again later.';
            default:
                return errorCode || 'An error occurred during login. Please try again.';
        }
    }

    // Check if user is already logged in
    auth.onAuthStateChanged((user) => {
        if (user) {
            // User is already logged in, redirect based on role
            checkUserRoleAndRedirect(user);
        }
    });
});

