// adminRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth');
const User = require('../../models/user');
const UserProfile = require('../../models/userProfile');
const OrgProfile = require('../../models/orgProfile');
const Opportunity = require('../../models/opportunity');
const OppRegistration = require('../../models/oppRegistration');
const Report = require('../../models/report');
const Notification = require('../../models/notification');

// Admin authorization middleware
const authorizeAdmin = (req, res, next) => {
    if (req.user.type !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Forbidden: Admin access required'
        });
    }
    next();
};

// Apply auth and admin middleware to all routes
router.use(authMiddleware);
router.use(authorizeAdmin);

/**
 * GET /api/admin/stats
 * Get comprehensive platform statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const { dateRange } = req.query;

        let dateFilter = {};
        if (dateRange) {
            const now = new Date();
            let startDate;

            switch (dateRange) {
                case '7days':
                    startDate = new Date(now.setDate(now.getDate() - 7));
                    break;
                case '30days':
                    startDate = new Date(now.setDate(now.getDate() - 30));
                    break;
                case '90days':
                    startDate = new Date(now.setDate(now.getDate() - 90));
                    break;
                case '1year':
                    startDate = new Date(now.setFullYear(now.getFullYear() - 1));
                    break;
                default:
                    startDate = null;
            }

            if (startDate) {
                dateFilter = { createdAt: { $gte: startDate } };
            }
        }

        // Get counts
        const [
            totalUsers,
            totalVolunteers,
            totalOrganizations,
            totalOpportunities,
            activeOpportunities,
            totalApplications,
            pendingOpportunities,
            flaggedOpportunities,
            suspendedUsers,
            pendingReports,
            newUsersInRange,
            newOpportunitiesInRange
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ type: 'user' }),
            User.countDocuments({ type: 'org' }),
            Opportunity.countDocuments(),
            Opportunity.countDocuments({ status: { $in: ['upcoming', 'started'] } }),
            OppRegistration.countDocuments(),
            Opportunity.countDocuments({ status: 'pending' }),
            Opportunity.countDocuments({ flagged: true }),
            User.countDocuments({ status: 'suspended' }),
            Report.countDocuments({ status: 'pending' }),
            User.countDocuments(dateFilter),
            Opportunity.countDocuments(dateFilter)
        ]);

        // Get growth data (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const userGrowth = await User.aggregate([
            { $match: { createdAt: { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        const opportunityGrowth = await Opportunity.aggregate([
            { $match: { createdAt: { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    count: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        res.json({
            success: true,
            stats: {
                users: {
                    total: totalUsers,
                    volunteers: totalVolunteers,
                    organizations: totalOrganizations,
                    suspended: suspendedUsers,
                    newInRange: newUsersInRange
                },
                opportunities: {
                    total: totalOpportunities,
                    active: activeOpportunities,
                    pending: pendingOpportunities,
                    flagged: flaggedOpportunities,
                    newInRange: newOpportunitiesInRange
                },
                applications: {
                    total: totalApplications
                },
                reports: {
                    pending: pendingReports
                },
                growth: {
                    users: userGrowth,
                    opportunities: opportunityGrowth
                }
            }
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

/**
 * GET /api/admin/users
 * Get all users with filtering
 */
router.get('/users', async (req, res) => {
    try {
        const { role, status, search, limit, page } = req.query;

        const query = {};

        if (role) {
            query.type = role;
        }

        if (status) {
            query.status = status;
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const limitNum = parseInt(limit) || 50;
        const pageNum = parseInt(page) || 1;
        const skip = (pageNum - 1) * limitNum;

        const [users, total] = await Promise.all([
            User.find(query)
                .select('-password')
                .sort({ createdAt: -1 })
                .limit(limitNum)
                .skip(skip),
            User.countDocuments(query)
        ]);

        // Get profile completion status
        const usersWithProfiles = await Promise.all(users.map(async (user) => {
            let profileComplete = false;

            if (user.type === 'user') {
                const profile = await UserProfile.findOne({ userId: user._id });
                profileComplete = !!(profile && profile.Name && profile.bio);
            } else if (user.type === 'org') {
                const profile = await OrgProfile.findOne({ userId: user._id });
                profileComplete = !!(profile && profile.orgName && profile.description);
            }

            return {
                _id: user._id,
                name: user.name,
                email: user.email,
                type: user.type,
                status: user.status,
                createdAt: user.createdAt,
                lastActive: user.lastActive,
                profileComplete
            };
        }));

        res.json({
            success: true,
            users: usersWithProfiles,
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(total / limitNum),
                total
            }
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

/**
 * PATCH /api/admin/users/:userId/status
 * Update user status (suspend/activate)
 */
router.patch('/users/:userId/status', async (req, res) => {
    try {
        const { userId } = req.params;
        const { status, reason } = req.body;

        if (!status || !['active', 'suspended'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Valid status (active/suspended) is required'
            });
        }

        const updateData = { status };
        if (status === 'suspended' && reason) {
            updateData.suspendedReason = reason;
        }

        const user = await User.findByIdAndUpdate(
            userId,
            updateData,
            { new: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Create notification for the user
        if (status === 'suspended') {
            await Notification.create({
                userId,
                type: 'system',
                title: 'Account Suspended',
                message: `Your account has been suspended. Reason: ${reason || 'Policy violation'}`,
                metadata: { action: 'suspended', reason }
            });
        } else {
            await Notification.create({
                userId,
                type: 'system',
                title: 'Account Activated',
                message: 'Your account has been reactivated.',
                metadata: { action: 'activated' }
            });
        }

        res.json({
            success: true,
            message: 'User status updated',
            user: {
                _id: user._id,
                status: user.status,
                suspendedReason: user.suspendedReason
            }
        });
    } catch (error) {
        console.error('Error updating user status:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

/**
 * GET /api/admin/opportunities
 * Get all opportunities with filtering
 */
router.get('/opportunities', async (req, res) => {
    try {
        const { status, flagged, organizationId, search, limit, page } = req.query;

        const query = {};

        if (status) {
            query.status = status;
        }

        if (flagged === 'true') {
            query.flagged = true;
        }

        if (organizationId) {
            query.userId = organizationId;
        }

        if (search) {
            query.title = { $regex: search, $options: 'i' };
        }

        const limitNum = parseInt(limit) || 50;
        const pageNum = parseInt(page) || 1;
        const skip = (pageNum - 1) * limitNum;

        const [opportunities, total] = await Promise.all([
            Opportunity.find(query)
                .populate('userId', 'name email')
                .sort({ createdAt: -1 })
                .limit(limitNum)
                .skip(skip),
            Opportunity.countDocuments(query)
        ]);

        // Get organization names
        const opportunitiesWithOrg = await Promise.all(opportunities.map(async (opp) => {
            const orgProfile = opp.userId ? await OrgProfile.findOne({ userId: opp.userId }) : null;

            return {
                _id: opp._id,
                title: opp.title,
                organization: {
                    _id: opp.userId?._id || null,
                    orgName: orgProfile?.orgName || opp.userId?.name || 'Deleted Organization'
                },
                status: opp.status,
                flagged: opp.flagged,
                flagReason: opp.flagReason,
                applicantCount: opp.applicantCount,
                createdAt: opp.createdAt
            };
        }));

        res.json({
            success: true,
            opportunities: opportunitiesWithOrg,
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(total / limitNum),
                total
            }
        });
    } catch (error) {
        console.error('Error fetching opportunities:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

/**
 * PATCH /api/admin/opportunities/:oppId/status
 * Update opportunity status (approve/reject/flag)
 */
router.patch('/opportunities/:oppId/status', async (req, res) => {
    try {
        const { oppId } = req.params;
        const { status, flagged, flagReason } = req.body;

        const updateData = {};

        if (status) {
            if (!['pending', 'upcoming', 'started', 'ended', 'cancelled', 'rejected'].includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid status'
                });
            }
            updateData.status = status;
        }

        if (flagged !== undefined) {
            updateData.flagged = flagged;
            if (flagged && flagReason) {
                updateData.flagReason = flagReason;
            }
        }

        const opportunity = await Opportunity.findByIdAndUpdate(
            oppId,
            updateData,
            { new: true }
        );

        if (!opportunity) {
            return res.status(404).json({
                success: false,
                message: 'Opportunity not found'
            });
        }

        // Notify organization
        if (status === 'rejected') {
            await Notification.create({
                userId: opportunity.userId,
                type: 'opportunity_update',
                title: 'Opportunity Rejected',
                message: `Your opportunity "${opportunity.title}" has been rejected.`,
                link: `/opportunities/${opportunity._id}`,
                metadata: { opportunityId: opportunity._id, action: 'rejected' }
            });
        } else if (status === 'upcoming' && opportunity.status === 'pending') {
            await Notification.create({
                userId: opportunity.userId,
                type: 'opportunity_update',
                title: 'Opportunity Approved',
                message: `Your opportunity "${opportunity.title}" has been approved!`,
                link: `/opportunities/${opportunity._id}`,
                metadata: { opportunityId: opportunity._id, action: 'approved' }
            });
        }

        if (flagged) {
            await Notification.create({
                userId: opportunity.userId,
                type: 'system',
                title: 'Opportunity Flagged',
                message: `Your opportunity "${opportunity.title}" has been flagged. Reason: ${flagReason}`,
                link: `/opportunities/${opportunity._id}`,
                metadata: { opportunityId: opportunity._id, flagReason }
            });
        }

        res.json({
            success: true,
            message: 'Opportunity status updated',
            opportunity: {
                _id: opportunity._id,
                status: opportunity.status,
                flagged: opportunity.flagged,
                flagReason: opportunity.flagReason
            }
        });
    } catch (error) {
        console.error('Error updating opportunity status:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

/**
 * GET /api/admin/reports
 * Get all content reports
 */
router.get('/reports', async (req, res) => {
    try {
        const { type, status, severity, limit, page } = req.query;

        const query = {};

        if (type) {
            query['reportedContent.type'] = type;
        }

        if (status) {
            query.status = status;
        }

        if (severity) {
            query.severity = severity;
        }

        const limitNum = parseInt(limit) || 50;
        const pageNum = parseInt(page) || 1;
        const skip = (pageNum - 1) * limitNum;

        const [reports, total] = await Promise.all([
            Report.find(query)
                .populate('reportedBy', 'name email')
                .populate('resolvedBy', 'name email')
                .sort({ createdAt: -1 })
                .limit(limitNum)
                .skip(skip),
            Report.countDocuments(query)
        ]);

        res.json({
            success: true,
            reports,
            pagination: {
                currentPage: pageNum,
                totalPages: Math.ceil(total / limitNum),
                total
            }
        });
    } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

/**
 * PATCH /api/admin/reports/:reportId
 * Resolve a report
 */
router.patch('/reports/:reportId', async (req, res) => {
    try {
        const { reportId } = req.params;
        const { status, resolution, action } = req.body;

        if (!status || !['resolved', 'dismissed'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Valid status (resolved/dismissed) is required'
            });
        }

        const updateData = {
            status,
            resolution,
            resolvedBy: req.user.userId
        };

        if (action) {
            if (!['none', 'warning', 'suspend', 'ban', 'remove_content'].includes(action)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid action'
                });
            }
            updateData.action = action;
        }

        const report = await Report.findByIdAndUpdate(
            reportId,
            updateData,
            { new: true }
        ).populate('reportedBy', 'name email');

        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Report not found'
            });
        }

        // Execute action
        if (action === 'suspend' || action === 'ban') {
            await User.findByIdAndUpdate(
                report.reportedContent.id,
                {
                    status: 'suspended',
                    suspendedReason: `Content violation: ${report.reason}`
                }
            );
        } else if (action === 'remove_content') {
            if (report.reportedContent.type === 'opportunity') {
                await Opportunity.findByIdAndUpdate(
                    report.reportedContent.id,
                    { status: 'cancelled', flagged: true, flagReason: report.reason }
                );
            }
        }

        // Notify reporter
        await Notification.create({
            userId: report.reportedBy._id,
            type: 'system',
            title: 'Report Resolved',
            message: `Your report has been ${status}. ${resolution || ''}`,
            metadata: { reportId: report._id, action }
        });

        res.json({
            success: true,
            message: 'Report resolved',
            report
        });
    } catch (error) {
        console.error('Error resolving report:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

/**
 * POST /api/admin/reports
 * Create a new report (can be used by users too)
 */
router.post('/reports', authMiddleware, async (req, res) => {
    try {
        const {
            reportedContent,
            reason,
            description,
            severity
        } = req.body;

        if (!reportedContent || !reportedContent.type || !reportedContent.id || !reason || !description) {
            return res.status(400).json({
                success: false,
                message: 'reportedContent (type, id), reason, and description are required'
            });
        }

        const report = await Report.create({
            reportedBy: req.user.userId,
            reportedContent,
            reason,
            description,
            severity: severity || 'medium'
        });

        res.status(201).json({
            success: true,
            message: 'Report created successfully',
            report
        });
    } catch (error) {
        console.error('Error creating report:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

module.exports = router;
