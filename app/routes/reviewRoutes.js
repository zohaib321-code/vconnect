const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Review = require('../../models/review');
const User = require('../../models/user');
const OrgProfile = require('../../models/orgProfile'); // OrgProfile wrapper for organization details
const OppRegistration = require('../../models/oppRegistration');
const Opportunity = require('../../models/opportunity');
const { authMiddleware } = require('../../middleware/auth');
const UserProfile = require('../../models/userProfile');

router.use(authMiddleware);

// Helper function to update user/org rating
async function updateProfileRating(userId) {
    const reviews = await Review.find({ revieweeId: userId });
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    const averageRating = reviews.length > 0 ? (totalRating / reviews.length).toFixed(1) : 0;
    const reviewCount = reviews.length;

    // Try updating User model first
    let updated = await User.findByIdAndUpdate(userId, { averageRating, reviewCount }, { new: true });

    // If not a User (or logically an OrgProfile linked to that User ID context), check OrgProfile
    // Note: In this system, OrgProfile is linked to a User. The revieweeId is likely the User._id.
    // If the reviewee is an Organization, their User entry is updated above. 
    // However, if we need to update OrgProfile explicitly (if it holds the duplicate data):
    const orgProfile = await OrgProfile.findOne({ userId: userId });
    if (orgProfile) {
        orgProfile.averageRating = averageRating;
        orgProfile.reviewCount = reviewCount;
        await orgProfile.save();
    }
}

// POST /create - Create a single review
router.post('/create', async (req, res) => {
    try {
        const { revieweeId, opportunityId, rating, comment, type } = req.body;
        const reviewerId = req.user.userId; // Assuming authMiddleware populates this

        // 1. Validate Opportunity Status
        const opportunity = await Opportunity.findById(opportunityId);
        if (!opportunity) {
            return res.status(404).json({ message: "Opportunity not found" });
        }
        // Assuming 'ended' is the status for completed opportunities
        // Logic: Allow if status is 'ended' OR 'cancelled' (maybe? stick to ended for now based on plan)
        if (opportunity.status !== 'ended') {
            return res.status(400).json({ message: "Cannot review an incomplete opportunity" });
        }

        // 2. Validate Registration (Participant must be accepted)
        // If Reviewer is User (Vol) -> Check their registration
        // If Reviewer is Org -> Check Reviewee (Vol) registration
        const volunteerId = type === 'userToOrg' ? reviewerId : revieweeId;

        const registration = await OppRegistration.findOne({
            userId: volunteerId,
            opportunityId: opportunityId,
            status: 'accepted'
        });

        if (!registration) {
            return res.status(400).json({ message: "User is not an accepted participant of this opportunity" });
        }

        // 2.5 Validation: Consistency check for userToOrg
        if (type === 'userToOrg') {
            if (revieweeId !== opportunity.userId.toString()) {
                return res.status(400).json({ message: "For userToOrg reviews, revieweeId must match the Opportunity creator (Organization)." });
            }
        }

        // 3. Create Review
        const newReview = new Review({
            reviewerId,
            revieweeId,
            opportunityId,
            rating,
            comment,
            type
        });

        await newReview.save();

        // 4. Update Profile Rating
        await updateProfileRating(revieweeId);

        res.status(201).json({ message: "Review submitted successfully", review: newReview });

    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ message: "You have already reviewed this user for this opportunity" });
        }
        console.error(err);
        res.status(500).json({ message: "Error submitting review", error: err.message });
    }
});

// POST /batch - Create multiple reviews (Org -> Users)
router.post('/batch', async (req, res) => {
    try {
        const { reviews } = req.body; // Array of { revieweeId, rating, comment }
        const { opportunityId } = req.body;
        const reviewerId = req.user.userId;

        if (!Array.isArray(reviews) || reviews.length === 0) {
            return res.status(400).json({ message: "No reviews provided" });
        }

        const opportunity = await Opportunity.findById(opportunityId);
        if (!opportunity || opportunity.status !== 'ended') {
            return res.status(400).json({ message: "Opportunity must be ended to submit reviews" });
        }

        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        for (const reviewData of reviews) {
            try {
                // Determine volunteer ID (reviewee)
                const volunteerId = reviewData.revieweeId;

                // Validate registration
                const registration = await OppRegistration.findOne({
                    userId: volunteerId,
                    opportunityId: opportunityId,
                    status: 'accepted'
                });

                if (!registration) {
                    results.failed++;
                    results.errors.push(`User ${volunteerId} verification failed`);
                    continue;
                }

                // Create Review
                // Check for existing first to avoid error throw loop? rely on unique index catch
                const existing = await Review.findOne({ reviewerId, revieweeId: volunteerId, opportunityId });
                if (existing) {
                    results.failed++;
                    results.errors.push(`User ${volunteerId} already reviewed`);
                    continue;
                }

                const newReview = new Review({
                    reviewerId,
                    revieweeId: volunteerId,
                    opportunityId,
                    rating: reviewData.rating,
                    comment: reviewData.comment,
                    type: 'orgToUser'
                });

                await newReview.save();
                await updateProfileRating(volunteerId);
                results.success++;

            } catch (err) {
                results.failed++;
                results.errors.push(`Error for user ${reviewData.revieweeId}: ${err.message}`);
            }
        }

        res.status(200).json({ message: "Batch processing complete", results });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error processing batch reviews" });
    }
});

// GET /user/:userId - Get reviews for a user/org with populated details
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        // Fetch reviews where the user is the reviewee
        const reviews = await Review.find({ revieweeId: userId })
            .populate({
                path: 'reviewerId',
                select: 'name email',
                populate: [
                    { path: 'profile', select: 'Name profilePicture' },
                    { path: 'organizationProfile', select: 'orgName profilePicture' }
                ]
            }) // Basic user details + profiles
            .populate('opportunityId', 'title')
            .sort({ createdAt: -1 });

        // Map details based on reviewer type
        const populatedReviews = reviews.map((review) => {
            const reviewObj = review.toObject();
            const reviewer = review.reviewerId;

            let name = "Unknown";
            let image = null;

            if (reviewer) {
                if (review.type === 'userToOrg') {
                    // Reviewer is User -> Use UserProfile
                    if (reviewer.profile) {
                        name = reviewer.profile.Name || "Unknown";
                        image = reviewer.profile.profilePicture || null;
                    }
                } else {
                    // Reviewer is Org -> Use OrgProfile
                    if (reviewer.organizationProfile) {
                        name = reviewer.organizationProfile.orgName || "Unknown";
                        image = reviewer.organizationProfile.profilePicture || null;
                    }
                }
            }

            reviewObj.reviewerDetails = { name, image };
            return reviewObj;
        });

        res.status(200).json(populatedReviews);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching reviews" });
    }
});

// GET /opportunity/:opportunityId - Get all reviews for a specific opportunity
router.get('/opportunity/:opportunityId', async (req, res) => {
    try {
        const { opportunityId } = req.params;

        const reviews = await Review.find({ opportunityId })
            .populate({
                path: 'reviewerId',
                select: 'name email',
                populate: [
                    { path: 'profile', select: 'Name profilePicture' },
                    { path: 'organizationProfile', select: 'orgName profilePicture' }
                ]
            })
            .populate('revieweeId', 'name email')
            .sort({ createdAt: -1 });

        const populatedReviews = reviews.map((review) => {
            const reviewObj = review.toObject();
            const reviewer = review.reviewerId;

            let name = "Unknown";
            let image = null;

            if (reviewer) {
                if (review.type === 'userToOrg') {
                    // Reviewer is User -> Use UserProfile
                    if (reviewer.profile) {
                        name = reviewer.profile.Name || "Unknown";
                        image = reviewer.profile.profilePicture || null;
                    }
                } else {
                    // Reviewer is Org -> Use OrgProfile
                    if (reviewer.organizationProfile) {
                        name = reviewer.organizationProfile.orgName || "Unknown";
                        image = reviewer.organizationProfile.profilePicture || null;
                    }
                }
            }

            reviewObj.reviewerDetails = { name, image };
            return reviewObj;
        });

        res.status(200).json(populatedReviews);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching opportunity reviews" });
    }
});

// GET /organization/:userId - Get reviews about an organization (via their opportunities)
router.get('/organization/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        // 1. Find all opportunities created by this organization
        const opportunities = await Opportunity.find({ userId: userId }).select('_id');
        const opportunityIds = opportunities.map(op => op._id);

        if (opportunityIds.length === 0) {
            return res.status(200).json([]); // No opportunities, so no reviews
        }

        // 2. Find reviews for these opportunities where type is 'userToOrg'
        // This ensures we get reviews written BY users ABOUT this org context
        const reviews = await Review.find({
            opportunityId: { $in: opportunityIds },
            type: 'userToOrg'
        })
            .populate({
                path: 'reviewerId',
                select: 'name email',
                populate: [
                    { path: 'profile', select: 'Name profilePicture' },
                    { path: 'organizationProfile', select: 'orgName profilePicture' }
                ]
            })
            .populate('opportunityId', 'title')
            .sort({ createdAt: -1 });

        const populatedReviews = reviews.map((review) => {
            const reviewObj = review.toObject();
            const reviewer = review.reviewerId;

            let name = "Unknown";
            let image = null;

            if (reviewer) {
                if (reviewer.profile) {
                    name = reviewer.profile.Name || "Unknown";
                    image = reviewer.profile.profilePicture || null;
                }
            }

            reviewObj.reviewerDetails = { name, image };
            return reviewObj;
        });

        res.status(200).json(populatedReviews);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error fetching organization reviews" });
    }
});

module.exports = router;
