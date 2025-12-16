// recommendationService.js
const Opportunity = require('../../models/opportunity');
const UserProfile = require('../../models/userProfile');
const OppRegistration = require('../../models/oppRegistration');
const User = require('../../models/user');

/**
 * Calculate distance between two coordinates in kilometers
 * Uses Haversine formula
 */
function calculateDistance(coords1, coords2) {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(coords2[1] - coords1[1]);
    const dLon = toRad(coords2[0] - coords1[0]);

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(coords1[1])) * Math.cos(toRad(coords2[1])) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
}

function toRad(degrees) {
    return degrees * (Math.PI / 180);
}

/**
 * Calculate match score between volunteer and opportunity
 * Returns score (0-100) and breakdown
 */
function calculateMatchScore(volunteerProfile, opportunity, volunteerLocation) {
    let breakdown = {
        skills: 0,
        interests: 0,
        location: 0,
        availability: 0
    };

    // 1. Skills Match (40 points)
    if (opportunity.skillsRequired && opportunity.skillsRequired.length > 0 &&
        volunteerProfile.skills && volunteerProfile.skills.length > 0) {

        const matchingSkills = opportunity.skillsRequired.filter(skill =>
            volunteerProfile.skills.some(vSkill =>
                vSkill.toLowerCase() === skill.toLowerCase()
            )
        );

        breakdown.skills = (matchingSkills.length / opportunity.skillsRequired.length) * 40;
    }

    // 2. Interests Match (30 points)
    if (opportunity.tags && opportunity.tags.length > 0 &&
        volunteerProfile.interests && volunteerProfile.interests.length > 0) {

        const matchingInterests = opportunity.tags.filter(tag =>
            volunteerProfile.interests.some(interest =>
                interest.toLowerCase() === tag.toLowerCase()
            )
        );

        const interestOverlap = matchingInterests.length /
            Math.max(opportunity.tags.length, volunteerProfile.interests.length);
        breakdown.interests = interestOverlap * 30;
    }

    // 3. Location Match (20 points)
    if (volunteerLocation && opportunity.location && opportunity.location.coordinates) {
        const distance = calculateDistance(volunteerLocation, opportunity.location.coordinates);

        if (distance <= 5) {
            breakdown.location = 20;
        } else if (distance <= 10) {
            breakdown.location = 15;
        } else if (distance <= 25) {
            breakdown.location = 10;
        } else if (distance <= 50) {
            breakdown.location = 5;
        }
    }

    // 4. Availability Match (10 points)
    // For now, give full points if opportunity has future dates
    // Can be enhanced with actual availability checking
    if (opportunity.dateTime && opportunity.dateTime.length > 0) {
        const now = new Date();
        const hasFutureDate = opportunity.dateTime.some(slot => new Date(slot.date) > now);
        if (hasFutureDate) {
            breakdown.availability = 10;
        }
    }

    const totalScore = breakdown.skills + breakdown.interests +
        breakdown.location + breakdown.availability;

    return {
        score: Math.round(totalScore),
        breakdown
    };
}

/**
 * Generate match reasons for display
 */
function generateMatchReasons(breakdown, volunteerProfile, opportunity) {
    const reasons = [];

    if (breakdown.skills > 0) {
        const matchingSkills = opportunity.skillsRequired.filter(skill =>
            volunteerProfile.skills.some(vSkill =>
                vSkill.toLowerCase() === skill.toLowerCase()
            )
        );
        if (matchingSkills.length > 0) {
            reasons.push(`Skills match: ${matchingSkills.join(', ')}`);
        }
    }

    if (breakdown.interests > 0) {
        const matchingInterests = opportunity.tags.filter(tag =>
            volunteerProfile.interests.some(interest =>
                interest.toLowerCase() === tag.toLowerCase()
            )
        );
        if (matchingInterests.length > 0) {
            reasons.push(`Interests match: ${matchingInterests.join(', ')}`);
        }
    }

    if (breakdown.location >= 15) {
        reasons.push('Location: Nearby');
    } else if (breakdown.location > 0) {
        reasons.push('Location: Within range');
    }

    if (breakdown.availability > 0) {
        reasons.push('Available during opportunity dates');
    }

    return reasons;
}

/**
 * Get opportunity recommendations for a volunteer
 */
async function getVolunteerRecommendations(userId, options = {}) {
    const {
        limit = 10,
        page = 1,
        minScore = 0
    } = options;

    try {
        // Get volunteer profile
        const volunteerProfile = await UserProfile.findOne({ userId });
        if (!volunteerProfile) {
            return {
                success: false,
                message: 'Volunteer profile not found'
            };
        }

        // Get volunteer's location (if available)
        let volunteerLocation = null;
        // You might want to add location to UserProfile model
        // For now, we'll skip location-based matching if not available

        // Get all active opportunities
        const now = new Date();
        const opportunities = await Opportunity.find({
            status: { $in: ['upcoming', 'started'] },
            dateTime: {
                $elemMatch: {
                    date: { $gte: now }
                }
            }
        }).populate('userId', 'name email');

        // Calculate match scores
        const recommendations = [];

        for (const opportunity of opportunities) {
            const { score, breakdown } = calculateMatchScore(
                volunteerProfile,
                opportunity,
                volunteerLocation
            );

            if (score >= minScore) {
                const matchReasons = generateMatchReasons(breakdown, volunteerProfile, opportunity);

                recommendations.push({
                    opportunityId: opportunity._id,
                    opportunity: opportunity,
                    matchScore: score,
                    matchReasons,
                    breakdown
                });
            }
        }

        // Sort by match score (highest first)
        recommendations.sort((a, b) => b.matchScore - a.matchScore);

        // Paginate
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const paginatedRecommendations = recommendations.slice(startIndex, endIndex);

        return {
            success: true,
            recommendations: paginatedRecommendations,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(recommendations.length / limit),
                totalRecommendations: recommendations.length
            }
        };
    } catch (error) {
        console.error('Error getting volunteer recommendations:', error);
        return {
            success: false,
            message: 'Error generating recommendations',
            error: error.message
        };
    }
}

/**
 * Get volunteer recommendations for an organization's opportunity
 */
async function getOrganizationRecommendations(opportunityId, options = {}) {
    const {
        limit = 20,
        page = 1,
        minScore = 0
    } = options;

    try {
        // Get opportunity
        const opportunity = await Opportunity.findById(opportunityId);
        if (!opportunity) {
            return {
                success: false,
                message: 'Opportunity not found'
            };
        }

        // Get all volunteer profiles
        const volunteerProfiles = await UserProfile.find({});

        // Get users who already applied
        const registrations = await OppRegistration.find({ opportunityId });
        const appliedUserIds = registrations.map(reg => String(reg.userId));

        // Calculate match scores
        const recommendations = [];

        for (const profile of volunteerProfiles) {
            // Skip if already applied
            if (appliedUserIds.includes(String(profile.userId))) {
                continue;
            }

            const { score, breakdown } = calculateMatchScore(
                profile,
                opportunity,
                null // Location matching can be added
            );

            if (score >= minScore) {
                const matchReasons = generateMatchReasons(breakdown, profile, opportunity);

                // Get volunteer stats
                const user = await User.findById(profile.userId);

                recommendations.push({
                    volunteerId: profile.userId,
                    volunteer: {
                        _id: profile.userId,
                        Name: profile.Name,
                        profilePicture: profile.profilePicture,
                        bio: profile.bio,
                        skills: profile.skills,
                        interests: profile.interests
                    },
                    matchScore: score,
                    matchReasons,
                    breakdown,
                    stats: {
                        completedOpportunities: user?.completedOpportunities || 0,
                        averageRating: user?.averageRating || 0,
                        totalHours: user?.totalHours || 0
                    }
                });
            }
        }

        // Sort by match score (highest first)
        recommendations.sort((a, b) => b.matchScore - a.matchScore);

        // Paginate
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;
        const paginatedRecommendations = recommendations.slice(startIndex, endIndex);

        return {
            success: true,
            opportunity: {
                _id: opportunity._id,
                title: opportunity.title
            },
            recommendations: paginatedRecommendations,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(recommendations.length / limit),
                totalVolunteers: recommendations.length
            }
        };
    } catch (error) {
        console.error('Error getting organization recommendations:', error);
        return {
            success: false,
            message: 'Error generating recommendations',
            error: error.message
        };
    }
}

module.exports = {
    getVolunteerRecommendations,
    getOrganizationRecommendations,
    calculateMatchScore,
    calculateDistance
};
