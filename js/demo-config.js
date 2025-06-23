// Demo Configuration (for testing without Firebase)
// This file demonstrates the application layout without requiring Firebase setup
// Replace with actual Firebase configuration for production use

// Mock Firebase for demo purposes
window.firebase = {
    initializeApp: () => {},
    auth: () => ({
        onAuthStateChanged: (callback) => {
            // Simulate no user logged in for demo
            setTimeout(() => callback(null), 100);
        },
        signInWithEmailAndPassword: () => Promise.reject(new Error('Demo mode - Firebase not configured')),
        signOut: () => Promise.resolve()
    }),
    database: () => ({
        ref: () => ({
            once: () => Promise.resolve({ val: () => null }),
            on: () => {},
            off: () => {},
            push: () => Promise.resolve({ key: 'demo-key' }),
            set: () => Promise.resolve(),
            update: () => Promise.resolve(),
            remove: () => Promise.resolve()
        }),
        ServerValue: { TIMESTAMP: Date.now() }
    })
};

// Demo mode indicator
console.log('Running in demo mode - Firebase not configured');
console.log('To use with real Firebase, replace js/firebase-config.js with actual configuration');

// Override auth state check for demo
function checkUserRoleAndRedirect() {
    console.log('Demo mode: Authentication disabled');
}

// Override message display for demo
function showMessage(message, type = 'success') {
    console.log(`${type.toUpperCase()}: ${message}`);
}

