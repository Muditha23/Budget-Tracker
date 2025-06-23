// API endpoint to update user funds
const admin = require('firebase-admin');

module.exports = async function(req, res) {
    try {
        // Verify Firebase ID token
        const idToken = req.headers.authorization.split('Bearer ')[1];
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        
        // Get user data
        const userRef = admin.database().ref(`users/${decodedToken.uid}`);
        const userSnapshot = await userRef.once('value');
        const userData = userSnapshot.val();
        
        // Verify user is a sub_admin
        if (userData.role !== 'sub_admin') {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        
        const { userId, purchaseId, amount } = req.body;
        
        // Update user's used amount
        const userToUpdateRef = admin.database().ref(`users/${userId}`);
        const snapshot = await userToUpdateRef.once('value');
        const currentData = snapshot.val();
        
        if (!currentData) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Update the user's used amount and last purchase timestamp
        await userToUpdateRef.update({
            used: (currentData.used || 0) + amount,
            lastPurchase: new Date().toISOString()
        });
        
        // Update purchase status to completed
        await admin.database().ref(`purchases/${purchaseId}`).update({
            status: 'completed',
            completedAt: new Date().toISOString()
        });
        
        // Log the action
        await admin.database().ref('logs').push({
            action: 'purchase_completed',
            details: {
                purchaseId,
                userId,
                amount
            },
            timestamp: new Date().toISOString(),
            performedBy: decodedToken.uid
        });
        
        res.json({ success: true });
        
    } catch (error) {
        console.error('Error updating user funds:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}; 