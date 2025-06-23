// Firebase Configuration
// Replace with your actual Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyAG7iyDcdPWFK21tg0cxGDOvNAt8aD0Jog",
    authDomain: "budget-tracker-bf232.firebaseapp.com",
    databaseURL: "https://budget-tracker-bf232-default-rtdb.firebaseio.com",
    projectId: "budget-tracker-bf232",
    storageBucket: "budget-tracker-bf232.firebasestorage.app",
    messagingSenderId: "369163526936",
    appId: "1:369163526936:web:d0b0e2a5366c5900a6746d",
    measurementId: "G-4PRLS0R966"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const database = firebase.database();

// Database references
const dbRefs = {
    users: database.ref('users'),
    funds: database.ref('funds'),
    allocations: database.ref('allocations'),
    purchases: database.ref('purchases'),
    logs: database.ref('logs'),
    suggestions: database.ref('suggestions')
};

// Helper functions for database operations
const dbHelpers = {
    // Get current timestamp
    getTimestamp: () => new Date().toISOString(),
    
    // Generate unique ID
    generateId: () => database.ref().push().key,
    
    // Format currency
    formatCurrency: (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    },
    
    // Calculate percentage
    calculatePercentage: (used, allocated) => {
        if (allocated === 0) return 0;
        return Math.round((used / allocated) * 100);
    }
};

// Export for use in other modules
window.firebaseConfig = firebaseConfig;
window.auth = auth;
window.database = database;
window.dbRefs = dbRefs;
window.dbHelpers = dbHelpers;

