const express = require('express');
const router = express.Router();
const Verification = require('../../models/verification');
const Appeal = require('../../models/appeal');
const OrgProfile = require('../../models/orgProfile');
const User = require('../../models/user');
const { authMiddleware } = require('../../middleware/auth');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Middleware to check if user is admin
const adminOnly = (req, res, next) => {
    if (req.user.type !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Admin only.'
        });
    }
    next();
};

router.use(adminOnly);

/**
 * GET /api/admin/verifications/pending
 * Get all pending verification requests
 */
router.get('/verifications/pending', async (req, res) => {
    try {
        const verifications = await Verification.find({ status: 'pending' })
            .populate('organizationId', 'name email')
            .sort({ submittedAt: -1 });

        const formattedVerifications = await Promise.all(
            verifications.map(async (verification) => {
                const orgProfile = await OrgProfile.findOne({ userId: verification.organizationId._id });

                return {
                    verificationId: verification.verificationId,
                    organizationId: verification.organizationId._id,
                    organizationName: orgProfile?.orgName || verification.organizationId.name,
                    submittedAt: verification.submittedAt,
                    documents: verification.documents,
                    additionalInfo: verification.additionalInfo
                };
            })
        );

        res.json({
            success: true,
            verifications: formattedVerifications
        });

    } catch (error) {
        console.error('Error fetching pending verifications:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching pending verifications',
            error: error.message
        });
    }
});

/**
 * GET /api/admin/verification/:verificationId
 * Get detailed verification request
 */
router.get('/verification/:verificationId', async (req, res) => {
    try {
        const { verificationId } = req.params;

        const verification = await Verification.findOne({ verificationId })
            .populate('organizationId', 'name email');

        if (!verification) {
            return res.status(404).json({
                success: false,
                message: 'Verification not found'
            });
        }

        const orgProfile = await OrgProfile.findOne({ userId: verification.organizationId._id });

        res.json({
            success: true,
            verificationId: verification.verificationId,
            organization: {
                id: verification.organizationId._id,
                name: orgProfile?.orgName || verification.organizationId.name,
                email: verification.organizationId.email,
                location: orgProfile?.location || null,
                aboutOrg: orgProfile?.aboutOrg || ''
            },
            documents: verification.documents,
            submittedAt: verification.submittedAt,
            status: verification.status,
            additionalInfo: verification.additionalInfo
        });

    } catch (error) {
        console.error('Error fetching verification details:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching verification details',
            error: error.message
        });
    }
});

/**
 * POST /api/admin/verification/approve
 * Approve organization verification
 */
router.post('/verification/approve', async (req, res) => {
    try {
        const { verificationId, adminId, notes } = req.body;

        const verification = await Verification.findOne({ verificationId });

        if (!verification) {
            return res.status(404).json({
                success: false,
                message: 'Verification not found'
            });
        }

        if (verification.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Verification has already been reviewed'
            });
        }

        verification.status = 'approved';
        verification.reviewedAt = new Date();
        verification.reviewedBy = adminId;
        verification.adminNotes = notes;

        await verification.save();

        res.json({
            success: true,
            message: 'Organization approved successfully'
        });

    } catch (error) {
        console.error('Error approving verification:', error);
        res.status(500).json({
            success: false,
            message: 'Error approving verification',
            error: error.message
        });
    }
});

/**
 * POST /api/admin/verification/reject
 * Reject organization verification
 */
router.post('/verification/reject', async (req, res) => {
    try {
        const { verificationId, adminId, reason, notes } = req.body;

        if (!reason) {
            return res.status(400).json({
                success: false,
                message: 'Rejection reason is required'
            });
        }

        const verification = await Verification.findOne({ verificationId });

        if (!verification) {
            return res.status(404).json({
                success: false,
                message: 'Verification not found'
            });
        }

        if (verification.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Verification has already been reviewed'
            });
        }

        verification.status = 'rejected';
        verification.reviewedAt = new Date();
        verification.reviewedBy = adminId;
        verification.rejectionReason = reason;
        verification.adminNotes = notes;

        await verification.save();

        res.json({
            success: true,
            message: 'Verification rejected'
        });

    } catch (error) {
        console.error('Error rejecting verification:', error);
        res.status(500).json({
            success: false,
            message: 'Error rejecting verification',
            error: error.message
        });
    }
});

/**
 * GET /api/admin/verifications/appeals
 * Get all pending appeals
 */
router.get('/verifications/appeals', async (req, res) => {
    try {
        const appeals = await Appeal.find({ status: 'pending' })
            .populate('organizationId', 'name email')
            .sort({ submittedAt: -1 });

        const formattedAppeals = await Promise.all(
            appeals.map(async (appeal) => {
                const orgProfile = await OrgProfile.findOne({ userId: appeal.organizationId._id });
                const verification = await Verification.findOne({ verificationId: appeal.verificationId });

                return {
                    appealId: appeal.appealId,
                    verificationId: appeal.verificationId,
                    organizationId: appeal.organizationId._id,
                    organizationName: orgProfile?.orgName || appeal.organizationId.name,
                    appealMessage: appeal.appealMessage,
                    submittedAt: appeal.submittedAt,
                    originalRejectionReason: verification?.rejectionReason || '',
                    updatedDocuments: appeal.updatedDocuments
                };
            })
        );

        res.json({
            success: true,
            appeals: formattedAppeals
        });

    } catch (error) {
        console.error('Error fetching appeals:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching appeals',
            error: error.message
        });
    }
});

module.exports = router;
