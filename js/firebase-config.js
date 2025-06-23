// Firebase Configuration
// Replace these values with your actual Firebase project configuration
const firebaseConfig = {
    apiKey: "your-api-key-here",
    authDomain: "your-project-id.firebaseapp.com",
    databaseURL: "https://your-project-id-default-rtdb.firebaseio.com/",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const database = firebase.database();

// Auth state observer
auth.onAuthStateChanged((user) => {
    if (user) {
        // User is signed in
        console.log('User signed in:', user.email);
        
        // Check if we're on the login page and redirect based on role
        if (window.location.pathname.includes('login.html') || window.location.pathname === '/') {
            checkUserRoleAndRedirect(user);
        }
    } else {
        // User is signed out
        console.log('User signed out');
        
        // Redirect to login if not already there
        if (!window.location.pathname.includes('login.html')) {
            window.location.href = 'login.html';
        }
    }
});

// Function to check user role and redirect
function checkUserRoleAndRedirect(user) {
    database.ref('users/' + user.uid).once('value')
        .then((snapshot) => {
            const userData = snapshot.val();
            if (userData && userData.role) {
                if (userData.role === 'admin') {
                    window.location.href = 'admin.html';
                } else if (userData.role === 'subadmin') {
                    window.location.href = 'index.html';
                }
            } else {
                // Default role assignment or error handling
                console.error('User role not found');
                showMessage('User role not found. Please contact administrator.', 'error');
            }
        })
        .catch((error) => {
            console.error('Error checking user role:', error);
            showMessage('Error checking user permissions.', 'error');
        });
}

// Utility function to show messages
function showMessage(message, type = 'success') {
    const messageElement = document.getElementById(type + 'Message');
    if (messageElement) {
        messageElement.textContent = message;
        messageElement.classList.remove('hidden');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            messageElement.classList.add('hidden');
        }, 5000);
    }
}

// Utility function to format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount || 0);
}

// Utility function to format date
function formatDate(timestamp) {
    return new Date(timestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

