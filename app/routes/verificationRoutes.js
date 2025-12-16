const express = require('express');
const router = express.Router();
const Verification = require('../../models/verification');
const Appeal = require('../../models/appeal');
const OrgProfile = require('../../models/orgProfile');
const { authMiddleware } = require('../../middleware/auth');

// Apply auth middleware to all routes
router.use(authMiddleware);

/**
 * POST /api/organization/verification/submit
 * Submit verification documents for review
 */
router.post('/submit', async (req, res) => {
    try {
        const { organizationId, documents, additionalInfo } = req.body;

        // Basic validation
        if (!organizationId) {
            return res.status(400).json({
                success: false,
                message: 'organizationId is required'
            });
        }

        if (
            !documents ||
            !documents.document ||
            !documents.documentType
        ) {
            return res.status(400).json({
                success: false,
                message: 'Document and documentType are required'
            });
        }

        // Check if organization already has a pending or approved verification
        const existingVerification = await Verification.findOne({
            organizationId,
            status: { $in: ['pending', 'approved'] }
        });

        if (existingVerification) {
            if (existingVerification.status === 'approved') {
                return res.status(400).json({
                    success: false,
                    message: 'Organization is already verified'
                });
            }

            if (existingVerification.status === 'pending') {
                return res.status(400).json({
                    success: false,
                    message: 'A verification request is already pending'
                });
            }
        }

        // Create new verification (SINGLE DOCUMENT STRUCTURE)
        const verification = new Verification({
            organizationId,
            documents: {
                registrationCertificate: documents.registrationCertificate || null,
                document: documents.document,
                documentType: documents.documentType
            },
            additionalInfo: additionalInfo || ''
        });

        await verification.save();

        res.status(201).json({
            success: true,
            verificationId: verification.verificationId,
            status: verification.status,
            message: 'Verification submitted successfully'
        });

    } catch (error) {
        console.error('Error submitting verification:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting verification',
            error: error.message
        });
    }
});

/**
 * GET /api/organization/verification/status/:organizationId
 * Get verification status for an organization
 */
router.get('/status/:organizationId', async (req, res) => {
    try {
        const { organizationId } = req.params;

        const verification = await Verification.findOne({ organizationId })
            .sort({ submittedAt: -1 })
            .populate('reviewedBy', 'name email');

        if (!verification) {
            return res.json({
                status: 'not_submitted'
            });
        }

        res.json({
            status: verification.status,
            verificationId: verification.verificationId,
            submittedAt: verification.submittedAt,
            reviewedAt: verification.reviewedAt,
            reviewedBy: verification.reviewedBy?._id || null,
            rejectionReason: verification.rejectionReason,
            documents: verification.documents
        });

    } catch (error) {
        console.error('Error fetching verification status:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching verification status',
            error: error.message
        });
    }
});

/**
 * POST /api/organization/verification/appeal
 * Submit an appeal for rejected verification
 */
router.post('/appeal', async (req, res) => {
    try {
        const {
            organizationId,
            verificationId,
            appealMessage,
            updatedDocuments
        } = req.body;

        if (!appealMessage) {
            return res.status(400).json({
                success: false,
                message: 'Appeal message is required'
            });
        }

        // Check if verification exists and is rejected
        const verification = await Verification.findOne({
            verificationId,
            organizationId,
            status: 'rejected'
        });

        if (!verification) {
            return res.status(404).json({
                success: false,
                message: 'Rejected verification not found'
            });
        }

        // Check if there's already a pending appeal
        const existingAppeal = await Appeal.findOne({
            verificationId,
            status: 'pending'
        });

        if (existingAppeal) {
            return res.status(400).json({
                success: false,
                message: 'An appeal is already pending for this verification'
            });
        }

        // Create appeal (SINGLE DOCUMENT STRUCTURE)
        const appeal = new Appeal({
            verificationId,
            organizationId,
            appealMessage,
            updatedDocuments: updatedDocuments || {}
        });

        await appeal.save();

        res.status(201).json({
            success: true,
            appealId: appeal.appealId,
            message: 'Appeal submitted successfully'
        });

    } catch (error) {
        console.error('Error submitting appeal:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting appeal',
            error: error.message
        });
    }
});

module.exports = router;
