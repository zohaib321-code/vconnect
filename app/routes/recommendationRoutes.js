// recommendationRoutes.js
const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../middleware/auth');
const {
    getVolunteerRecommendations,
    getOrganizationRecommendations
} = require('../services/recommendationService');

/**
 * GET /api/recommendations
 * Get personalized opportunity recommendations for volunteers
 */
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { limit, page, minScore } = req.query;

        const options = {
            limit: parseInt(limit) || 10,
            page: parseInt(page) || 1,
            minScore: parseInt(minScore) || 0
        };

        const result = await getVolunteerRecommendations(userId, options);

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Error in GET /recommendations:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

/**
 * GET /api/recommendations/organizations/:orgId
 * Get recommended volunteers for an organization's opportunity
 */
router.get('/organizations/:orgId', authMiddleware, async (req, res) => {
    try {
        const { orgId } = req.params;
        const { opportunityId, limit, page, minScore } = req.query;

        if (!opportunityId) {
            return res.status(400).json({
                success: false,
                message: 'opportunityId is required'
            });
        }

        // Verify the user is the organization owner
        if (req.user.userId !== orgId && req.user.type !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Unauthorized: You can only view recommendations for your own organization'
            });
        }

        const options = {
            limit: parseInt(limit) || 20,
            page: parseInt(page) || 1,
            minScore: parseInt(minScore) || 0
        };

        const result = await getOrganizationRecommendations(opportunityId, options);

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error('Error in GET /recommendations/organizations/:orgId:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

module.exports = router;
