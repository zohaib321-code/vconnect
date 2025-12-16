// organizationRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth');
const Opportunity = require('../../models/opportunity');
const OppRegistration = require('../../models/oppRegistration');
const Activity = require('../../models/activity');
const UserProfile = require('../../models/userProfile');
const OrgProfile = require('../../models/orgProfile');

//----------------------------------------------------
// 1. Get Organization Quick Stats
//----------------------------------------------------
router.get('/dashboard/stats', authMiddleware, async (req, res) => {
    try {
        const organizationId = req.user.userId;

        // Get total volunteers (unique users who registered for opportunities)
        const totalVolunteers = await OppRegistration.distinct('userId', {
            opportunityId: {
                $in: await Opportunity.find({ userId: organizationId }).distinct('_id')
            }
        });

        // Get total opportunities posted
        const opportunitiesPosted = await Opportunity.countDocuments({ userId: organizationId });

        // Get active opportunities (future dates)
        const now = new Date();
        const activeOpportunities = await Opportunity.countDocuments({
            userId: organizationId,
            'dateTime.date': { $gte: now }
        });

        // Get completed projects (past dates)
        const completedProjects = await Opportunity.countDocuments({
            userId: organizationId,
            'dateTime.date': { $lt: now }
        });

        res.status(200).json({
            success: true,
            data: {
                totalVolunteers: totalVolunteers.length,
                opportunitiesPosted,
                activeOpportunities,
                completedProjects
            }
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred'
            }
        });
    }
});

//----------------------------------------------------
// 2. Get Recent Activity (Summary)
//----------------------------------------------------
router.get('/dashboard/recent-activity', authMiddleware, async (req, res) => {
    try {
        const organizationId = req.user.userId;
        const limit = parseInt(req.query.limit) || 3;

        const activities = await Activity.find({ organizationId })
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('userId', 'phone')
            .populate('opportunityId', 'title')
            .lean();

        // Format activities with time ago
        const formattedActivities = activities.map(activity => {
            const timeAgo = getTimeAgo(activity.createdAt);
            return {
                id: activity._id,
                time: timeAgo,
                description: activity.description,
                type: activity.type,
                userId: activity.userId?._id || null,
                opportunityId: activity.opportunityId?._id || null,
                conversationId: activity.conversationId || null
            };
        });

        res.status(200).json({
            success: true,
            data: formattedActivities
        });
    } catch (error) {
        console.error('Error fetching recent activity:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred'
            }
        });
    }
});

//----------------------------------------------------
// 3. Get Upcoming Opportunities
//----------------------------------------------------
router.get('/opportunities/upcoming', authMiddleware, async (req, res) => {
    try {
        const organizationId = req.user.userId;
        const limit = parseInt(req.query.limit) || 3;
        const now = new Date();

        const opportunities = await Opportunity.find({
            userId: organizationId,
            'dateTime.date': { $gte: now }
        })
            .sort({ 'dateTime.date': 1 })
            .limit(limit)
            .lean();

        // Get applicant counts for each opportunity
        const opportunityIds = opportunities.map(opp => opp._id);
        const registrations = await OppRegistration.aggregate([
            { $match: { opportunityId: { $in: opportunityIds } } },
            { $group: { _id: '$opportunityId', count: { $sum: 1 } } }
        ]);

        const registrationMap = {};
        registrations.forEach(reg => {
            registrationMap[reg._id.toString()] = reg.count;
        });

        // Format opportunities
        const formattedOpportunities = opportunities.map(opp => {
            const applicantsCount = registrationMap[opp._id.toString()] || 0;
            const firstDate = opp.dateTime && opp.dateTime.length > 0 ? opp.dateTime[0].date : null;

            // Determine status
            let status = 'open';
            const maxVolunteers = 20; // Default, can be added to schema later
            if (applicantsCount >= maxVolunteers) {
                status = 'closed';
            } else if (applicantsCount >= maxVolunteers * 0.8) {
                status = 'filling';
            }

            return {
                id: opp._id,
                title: opp.title,
                date: firstDate,
                status,
                applicantsCount,
                maxVolunteers
            };
        });

        res.status(200).json({
            success: true,
            data: formattedOpportunities
        });
    } catch (error) {
        console.error('Error fetching upcoming opportunities:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred'
            }
        });
    }
});

//----------------------------------------------------
// 4. Get Alerts and Notifications
//----------------------------------------------------
router.get('/dashboard/alerts', authMiddleware, async (req, res) => {
    try {
        const organizationId = req.user.userId;
        const alerts = [];

        // Check for pending approvals
        const opportunityIds = await Opportunity.find({ userId: organizationId }).distinct('_id');
        const pendingApprovals = await OppRegistration.countDocuments({
            opportunityId: { $in: opportunityIds },
            status: 'pending'
        });

        if (pendingApprovals > 0) {
            alerts.push({
                id: `alert_pending_${Date.now()}`,
                message: `${pendingApprovals} volunteer${pendingApprovals > 1 ? 's' : ''} awaiting approval for current events.`,
                type: 'approval_pending',
                priority: 'medium',
                createdAt: new Date()
            });
        }

        // Check for expiring opportunities (within 2 days)
        const twoDaysFromNow = new Date();
        twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

        const expiringOpportunities = await Opportunity.find({
            userId: organizationId,
            'dateTime.date': {
                $gte: new Date(),
                $lte: twoDaysFromNow
            }
        });

        expiringOpportunities.forEach(opp => {
            alerts.push({
                id: `alert_expiring_${opp._id}`,
                message: `Opportunity "${opp.title}" starting in 2 days.`,
                type: 'expiring_opportunity',
                priority: 'high',
                opportunityId: opp._id,
                createdAt: new Date()
            });
        });

        res.status(200).json({
            success: true,
            data: alerts
        });
    } catch (error) {
        console.error('Error fetching alerts:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred'
            }
        });
    }
});

//----------------------------------------------------
// 5. Get All Activities (Paginated)
//----------------------------------------------------
router.get('/activities', authMiddleware, async (req, res) => {
    try {
        const organizationId = req.user.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const type = req.query.type;
        const search = req.query.search;

        // Build query
        const query = { organizationId };
        if (type) {
            query.type = type;
        }
        if (search) {
            query.description = { $regex: search, $options: 'i' };
        }

        // Get total count
        const totalItems = await Activity.countDocuments(query);
        const totalPages = Math.ceil(totalItems / limit);

        // Get activities
        const activities = await Activity.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('userId', 'phone')
            .populate('opportunityId', 'title')
            .lean();

        // Get user profiles for activities
        const userIds = activities.map(a => a.userId?._id).filter(Boolean);
        const userProfiles = await UserProfile.find({ userId: { $in: userIds } })
            .select('userId Name profilePicture')
            .lean();

        const profileMap = {};
        userProfiles.forEach(profile => {
            profileMap[profile.userId.toString()] = profile;
        });

        // Format activities
        const formattedActivities = activities.map(activity => ({
            id: activity._id,
            type: activity.type,
            description: activity.description,
            timestamp: activity.createdAt,
            user: activity.userId ? {
                id: activity.userId._id,
                name: profileMap[activity.userId._id.toString()]?.Name || 'Unknown User',
                profilePicture: profileMap[activity.userId._id.toString()]?.profilePicture || null
            } : null,
            opportunity: activity.opportunityId ? {
                id: activity.opportunityId._id,
                title: activity.opportunityId.title
            } : null,
            conversationId: activity.conversationId || null
        }));

        res.status(200).json({
            success: true,
            data: {
                activities: formattedActivities,
                pagination: {
                    currentPage: page,
                    totalPages,
                    totalItems,
                    itemsPerPage: limit
                }
            }
        });
    } catch (error) {
        console.error('Error fetching activities:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred'
            }
        });
    }
});

//----------------------------------------------------
// 6. Get Activity Types
//----------------------------------------------------
router.get('/activities/types', authMiddleware, async (req, res) => {
    try {
        const organizationId = req.user.userId;

        const typeCounts = await Activity.aggregate([
            { $match: { organizationId } },
            { $group: { _id: '$type', count: { $sum: 1 } } }
        ]);

        const typeLabels = {
            volunteer_signup: 'Volunteer Signups',
            message: 'Messages',
            opportunity_complete: 'Completed Opportunities',
            application: 'Applications',
            opportunity_created: 'New Opportunities'
        };

        const formattedTypes = typeCounts.map(item => ({
            value: item._id,
            label: typeLabels[item._id] || item._id,
            count: item.count
        }));

        res.status(200).json({
            success: true,
            data: formattedTypes
        });
    } catch (error) {
        console.error('Error fetching activity types:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred'
            }
        });
    }
});

//----------------------------------------------------
// 7. Get Organization Statistics
//----------------------------------------------------
router.get('/stats', authMiddleware, async (req, res) => {
    try {
        const organizationId = req.user.userId;
        const dateRange = req.query.dateRange || '30days';

        // Calculate date filter
        const dateFilter = getDateFilter(dateRange);

        // Get opportunities
        const opportunities = await Opportunity.find({
            userId: organizationId,
            createdAt: { $gte: dateFilter }
        });

        const opportunityIds = opportunities.map(opp => opp._id);

        // Get registrations
        const totalVolunteers = await OppRegistration.distinct('userId', {
            opportunityId: { $in: opportunityIds }
        });

        const now = new Date();
        const activeOpportunities = opportunities.filter(opp =>
            opp.dateTime.some(dt => new Date(dt.date) >= now)
        ).length;

        const completedOpportunities = opportunities.filter(opp =>
            opp.dateTime.every(dt => new Date(dt.date) < now)
        ).length;

        // Get volunteer growth data (last 6 months)
        const volunteerGrowth = await getVolunteerGrowth(organizationId);

        // Get opportunities created over time
        const opportunitiesCreated = await getOpportunitiesCreated(organizationId);

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    totalVolunteers: totalVolunteers.length,
                    totalOpportunities: opportunities.length,
                    activeOpportunities,
                    completedOpportunities,
                    totalHoursVolunteered: 0, // Placeholder - needs time tracking
                    averageRating: 0, // Placeholder - needs rating system
                    monthlyGrowth: calculateMonthlyGrowth(volunteerGrowth),
                    volunteerRetentionRate: 85 // Placeholder - needs historical tracking
                },
                volunteerGrowth,
                opportunitiesCreated
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred'
            }
        });
    }
});

// GET public organization profile by userId (orgId)
router.get('/profile/:orgId', async (req, res) => {
    try {
        const { orgId } = req.params;

        const orgProfile = await OrgProfile.findOne({ userId: orgId })
            .select('orgName description profilePicture website socialLinks establishedYear')
            .lean();

        if (!orgProfile) {
            return res.status(404).json({
                success: false,
                message: 'Organization profile not found'
            });
        }

        // Optional: Add opportunity stats
        const opportunitiesCount = await Opportunity.countDocuments({ userId: orgId });
        const totalVolunteers = await OppRegistration.distinct('userId', {
            opportunityId: { $in: await Opportunity.find({ userId: orgId }).distinct('_id') }
        });

        res.status(200).json({
            success: true,
            profile: {
                ...orgProfile,
                opportunitiesPosted: opportunitiesCount,
                totalVolunteers: totalVolunteers.length
            }
        });
    } catch (error) {
        console.error('Error fetching org profile:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

//----------------------------------------------------
// 8. Get Volunteer Demographics
//----------------------------------------------------
router.get('/stats/demographics', authMiddleware, async (req, res) => {
    try {
        const organizationId = req.user.userId;
        const dateRange = req.query.dateRange || '30days';
        const dateFilter = getDateFilter(dateRange);

        // Get all volunteers for this organization
        const opportunityIds = await Opportunity.find({
            userId: organizationId,
            createdAt: { $gte: dateFilter }
        }).distinct('_id');

        const volunteerIds = await OppRegistration.distinct('userId', {
            opportunityId: { $in: opportunityIds }
        });

        // Get volunteer profiles
        const profiles = await UserProfile.find({
            userId: { $in: volunteerIds }
        }).lean();

        // Calculate age groups (placeholder - needs birthdate in profile)
        const ageGroups = [
            { range: '18-24', count: Math.floor(profiles.length * 0.3) },
            { range: '25-34', count: Math.floor(profiles.length * 0.35) },
            { range: '35-44', count: Math.floor(profiles.length * 0.2) },
            { range: '45+', count: Math.floor(profiles.length * 0.15) }
        ];

        // Get skills distribution
        const skillsMap = {};
        profiles.forEach(profile => {
            if (profile.skills && Array.isArray(profile.skills)) {
                profile.skills.forEach(skill => {
                    skillsMap[skill] = (skillsMap[skill] || 0) + 1;
                });
            }
        });

        const skills = Object.entries(skillsMap).map(([skill, count]) => ({
            skill,
            count
        })).sort((a, b) => b.count - a.count).slice(0, 10);

        // Get location distribution (placeholder - needs proper location data)
        const locations = [
            { city: 'Karachi', count: Math.floor(profiles.length * 0.5) },
            { city: 'Lahore', count: Math.floor(profiles.length * 0.3) },
            { city: 'Islamabad', count: Math.floor(profiles.length * 0.2) }
        ];

        res.status(200).json({
            success: true,
            data: {
                ageGroups,
                skills,
                locations
            }
        });
    } catch (error) {
        console.error('Error fetching demographics:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'An unexpected error occurred'
            }
        });
    }
});

//----------------------------------------------------
// Helper Functions
//----------------------------------------------------

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);

    if (seconds < 60) return `${seconds} secs ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
}

function getDateFilter(dateRange) {
    const now = new Date();
    const filters = {
        '7days': new Date(now.setDate(now.getDate() - 7)),
        '30days': new Date(now.setDate(now.getDate() - 30)),
        '90days': new Date(now.setDate(now.getDate() - 90)),
        '1year': new Date(now.setFullYear(now.getFullYear() - 1)),
        'all': new Date(0)
    };
    return filters[dateRange] || filters['30days'];
}

async function getVolunteerGrowth(organizationId) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentDate = new Date();
    const growth = [];

    for (let i = 5; i >= 0; i--) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 1);

        const opportunityIds = await Opportunity.find({
            userId: organizationId,
            createdAt: { $lt: nextDate }
        }).distinct('_id');

        const volunteers = await OppRegistration.distinct('userId', {
            opportunityId: { $in: opportunityIds },
            createdAt: { $lt: nextDate }
        });

        const newVolunteers = await OppRegistration.distinct('userId', {
            opportunityId: { $in: opportunityIds },
            createdAt: { $gte: date, $lt: nextDate }
        });

        growth.push({
            month: months[date.getMonth()],
            year: date.getFullYear(),
            volunteers: volunteers.length,
            newVolunteers: newVolunteers.length
        });
    }

    return growth;
}

async function getOpportunitiesCreated(organizationId) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentDate = new Date();
    const created = [];

    for (let i = 5; i >= 0; i--) {
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i + 1, 1);

        const count = await Opportunity.countDocuments({
            userId: organizationId,
            createdAt: { $gte: date, $lt: nextDate }
        });

        created.push({
            month: months[date.getMonth()],
            year: date.getFullYear(),
            opportunities: count
        });
    }

    return created;
}

function calculateMonthlyGrowth(volunteerGrowth) {
    if (volunteerGrowth.length < 2) return 0;
    const current = volunteerGrowth[volunteerGrowth.length - 1].volunteers;
    const previous = volunteerGrowth[volunteerGrowth.length - 2].volunteers;
    if (previous === 0) return 100;
    return Math.round(((current - previous) / previous) * 100);
}

module.exports = router;
