// PDF Export Module
class PDFExporter {
    constructor() {
        this.jsPDF = window.jspdf.jsPDF;
    }

    async exportSystemReport() {
        try {
            const doc = new this.jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            let yPosition = 20;

            // Header
            doc.setFontSize(20);
            doc.setFont(undefined, 'bold');
            doc.text('Budget Tracker System Report', pageWidth / 2, yPosition, { align: 'center' });
            
            yPosition += 10;
            doc.setFontSize(12);
            doc.setFont(undefined, 'normal');
            doc.text(`Generated on: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: 'center' });
            
            yPosition += 20;

            // System Summary
            const summaryData = await this.getSummaryData();
            yPosition = this.addSummarySection(doc, yPosition, summaryData);

            // Sub Admin Details
            const subAdminData = await this.getSubAdminData();
            yPosition = this.addSubAdminSection(doc, yPosition, subAdminData);

            // Recent Activity
            const activityData = await this.getActivityData();
            yPosition = this.addActivitySection(doc, yPosition, activityData);

            // Fund History
            const fundData = await this.getFundData();
            yPosition = this.addFundSection(doc, yPosition, fundData);

            // Purchase History
            const purchaseData = await this.getPurchaseData();
            yPosition = this.addPurchaseSection(doc, yPosition, purchaseData);

            // Save the PDF
            const fileName = `budget-tracker-report-${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(fileName);

            return { success: true, fileName: fileName };

        } catch (error) {
            console.error('Error generating PDF:', error);
            return { success: false, error: error.message };
        }
    }

    async getSummaryData() {
        const fundsSnapshot = await dbRefs.funds.once('value');
        const funds = fundsSnapshot.val() || {};
        const totalFunds = Object.values(funds).reduce((sum, fund) => sum + (fund.amount || 0), 0);

        const usersSnapshot = await dbRefs.users.once('value');
        const users = usersSnapshot.val() || {};
        
        let totalAllocated = 0;
        let totalUsed = 0;
        let subAdminCount = 0;
        
        Object.values(users).forEach(user => {
            if (user.role === 'sub_admin') {
                totalAllocated += user.allocated || 0;
                totalUsed += user.used || 0;
                subAdminCount++;
            }
        });

        return {
            totalFunds,
            totalAllocated,
            totalUsed,
            totalRemaining: totalFunds - totalUsed,
            subAdminCount
        };
    }

    async getSubAdminData() {
        const snapshot = await dbRefs.users.once('value');
        const users = snapshot.val() || {};
        
        return Object.entries(users)
            .filter(([uid, user]) => user.role === 'sub_admin')
            .map(([uid, user]) => ({
                name: user.name || 'N/A',
                email: user.email,
                allocated: user.allocated || 0,
                used: user.used || 0,
                remaining: (user.allocated || 0) - (user.used || 0),
                usagePercent: dbHelpers.calculatePercentage(user.used || 0, user.allocated || 0)
            }));
    }

    async getActivityData() {
        const snapshot = await dbRefs.logs.orderByChild('timestamp').limitToLast(20).once('value');
        const logs = snapshot.val() || {};
        
        return Object.entries(logs)
            .sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp))
            .map(([logId, log]) => ({
                action: log.action,
                timestamp: log.timestamp,
                description: this.getActivityDescription(log)
            }));
    }

    async getFundData() {
        const snapshot = await dbRefs.funds.orderByChild('timestamp').once('value');
        const funds = snapshot.val() || {};
        
        return Object.entries(funds)
            .sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp))
            .map(([fundId, fund]) => ({
                amount: fund.amount,
                note: fund.note || 'No note',
                timestamp: fund.timestamp
            }));
    }

    async getPurchaseData() {
        const snapshot = await dbRefs.purchases.orderByChild('timestamp').once('value');
        const purchases = snapshot.val() || {};
        
        return Object.entries(purchases)
            .sort((a, b) => new Date(b[1].timestamp) - new Date(a[1].timestamp))
            .map(([purchaseId, purchase]) => ({
                userId: purchase.userId,
                total: purchase.total,
                itemCount: purchase.items ? purchase.items.length : 0,
                timestamp: purchase.timestamp,
                items: purchase.items || []
            }));
    }

    addSummarySection(doc, yPosition, data) {
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text('System Summary', 20, yPosition);
        yPosition += 15;

        doc.setFontSize(12);
        doc.setFont(undefined, 'normal');
        
        const summaryItems = [
            `Total Funds: ${dbHelpers.formatCurrency(data.totalFunds)}`,
            `Total Allocated: ${dbHelpers.formatCurrency(data.totalAllocated)}`,
            `Total Used: ${dbHelpers.formatCurrency(data.totalUsed)}`,
            `Remaining: ${dbHelpers.formatCurrency(data.totalRemaining)}`,
            `Active Sub Admins: ${data.subAdminCount}`
        ];

        summaryItems.forEach(item => {
            doc.text(item, 25, yPosition);
            yPosition += 8;
        });

        return yPosition + 10;
    }

    addSubAdminSection(doc, yPosition, data) {
        if (yPosition > 250) {
            doc.addPage();
            yPosition = 20;
        }

        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text('Sub Admin Details', 20, yPosition);
        yPosition += 15;

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');

        // Table headers
        const headers = ['Name', 'Email', 'Allocated', 'Used', 'Remaining', 'Usage %'];
        const colWidths = [30, 50, 25, 25, 25, 20];
        let xPosition = 20;

        doc.setFont(undefined, 'bold');
        headers.forEach((header, index) => {
            doc.text(header, xPosition, yPosition);
            xPosition += colWidths[index];
        });
        yPosition += 8;

        // Table data
        doc.setFont(undefined, 'normal');
        data.forEach(user => {
            if (yPosition > 270) {
                doc.addPage();
                yPosition = 20;
            }

            xPosition = 20;
            const rowData = [
                user.name.substring(0, 15),
                user.email.substring(0, 25),
                dbHelpers.formatCurrency(user.allocated),
                dbHelpers.formatCurrency(user.used),
                dbHelpers.formatCurrency(user.remaining),
                `${user.usagePercent}%`
            ];

            rowData.forEach((data, index) => {
                doc.text(data, xPosition, yPosition);
                xPosition += colWidths[index];
            });
            yPosition += 6;
        });

        return yPosition + 10;
    }

    addActivitySection(doc, yPosition, data) {
        if (yPosition > 200) {
            doc.addPage();
            yPosition = 20;
        }

        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text('Recent Activity', 20, yPosition);
        yPosition += 15;

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');

        data.slice(0, 15).forEach(activity => {
            if (yPosition > 270) {
                doc.addPage();
                yPosition = 20;
            }

            const date = new Date(activity.timestamp).toLocaleDateString();
            const time = new Date(activity.timestamp).toLocaleTimeString();
            
            doc.text(`${date} ${time}`, 20, yPosition);
            doc.text(activity.description, 70, yPosition);
            yPosition += 6;
        });

        return yPosition + 10;
    }

    addFundSection(doc, yPosition, data) {
        if (yPosition > 200) {
            doc.addPage();
            yPosition = 20;
        }

        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text('Fund History', 20, yPosition);
        yPosition += 15;

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');

        data.forEach(fund => {
            if (yPosition > 270) {
                doc.addPage();
                yPosition = 20;
            }

            const date = new Date(fund.timestamp).toLocaleDateString();
            const time = new Date(fund.timestamp).toLocaleTimeString();
            
            doc.text(`${date} ${time}`, 20, yPosition);
            doc.text(dbHelpers.formatCurrency(fund.amount), 70, yPosition);
            doc.text(fund.note.substring(0, 50), 110, yPosition);
            yPosition += 6;
        });

        return yPosition + 10;
    }

    addPurchaseSection(doc, yPosition, data) {
        if (yPosition > 200) {
            doc.addPage();
            yPosition = 20;
        }

        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text('Purchase History', 20, yPosition);
        yPosition += 15;

        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');

        data.slice(0, 20).forEach(purchase => {
            if (yPosition > 270) {
                doc.addPage();
                yPosition = 20;
            }

            const date = new Date(purchase.timestamp).toLocaleDateString();
            const time = new Date(purchase.timestamp).toLocaleTimeString();
            
            doc.text(`${date} ${time}`, 20, yPosition);
            doc.text(dbHelpers.formatCurrency(purchase.total), 70, yPosition);
            doc.text(`${purchase.itemCount} items`, 110, yPosition);
            yPosition += 6;
        });

        return yPosition + 10;
    }

    getActivityDescription(log) {
        const descriptions = {
            'funds_added': `Added ${dbHelpers.formatCurrency(log.details.amount)} to system`,
            'user_created': `Created new user: ${log.details.newUserEmail}`,
            'role_updated': `Updated user role to ${log.details.newRole}`,
            'user_deleted': 'Deleted user account',
            'allocation_made': `Allocated funds to user`,
            'purchase_made': `Purchase submitted: ${dbHelpers.formatCurrency(log.details.total)}`,
            'funds_returned': `Returned ${dbHelpers.formatCurrency(log.details.returnedAmount)}`
        };
        return descriptions[log.action] || 'Unknown activity';
    }
}

// Export for global use
window.PDFExporter = PDFExporter;

