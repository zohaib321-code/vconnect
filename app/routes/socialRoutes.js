// socialRoutes.js
const express = require('express');
const router = express.Router();

const Follow = require('../../models/follows');
const Friendship = require('../../models/friends');
// const User = require('../../models/user');
// const Profile = require('../../models/userProfile');               
// const OrganizationProfile = require('../../models/orgProfile'); 

/**
 * =========================
 * FOLLOW ROUTES
 * =========================
 */

// Follow an organization
router.post('/follow', async (req, res) => {
    const { followerId, organizationId } = req.body;

    if (!followerId || !organizationId) {
        return res.status(400).json({ error: 'followerId and organizationId are required' });
    }

    try {
        const follow = new Follow({ follower: followerId, organization: organizationId });
        await follow.save();
        res.status(200).json({ message: 'Organization followed successfully' });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: 'You are already following this organization' });
        }
        console.error(error);
        res.status(500).json({ error: 'Failed to follow organization' });
    }
});

// Unfollow an organization
router.post('/unfollow', async (req, res) => {
    const { followerId, organizationId } = req.body;

    if (!followerId || !organizationId) {
        return res.status(400).json({ error: 'followerId and organizationId are required' });
    }

    try {
        await Follow.deleteOne({ follower: followerId, organization: organizationId });
        res.status(200).json({ message: 'Organization unfollowed successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to unfollow organization' });
    }
});

// Get all followers of an organization
router.post('/followers', async (req, res) => {
    const { organizationId } = req.body;
    if (!organizationId) return res.status(400).json({ error: 'organizationId is required' });

    try {
        const followers = await Follow.find({ organization: organizationId })
            .populate({
                path: 'follower',
                model: 'Profile',
                select: 'name email profilePicture userId',
                localField: 'follower',
                foreignField: 'userId',
            });
        res.status(200).json({ followers });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch followers' });
    }
});

// Get all organizations a user is following
router.post('/following', async (req, res) => {
    const { followerId } = req.body;
    if (!followerId) return res.status(400).json({ error: 'followerId is required' });

    try {
        const following = await Follow.find({ follower: followerId })
            .populate({
                path: 'organization',
                model: 'OrganizationProfile',
                select: 'orgName profilePicture coverPicture userId',
                localField: 'organization',
                foreignField: 'userId',
            });
        res.status(200).json({ following });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch following list' });
    }
});


/**
 * =========================
 * FRIENDSHIP ROUTES
 * =========================
 */

// Send friend request
router.post('/friend-request', async (req, res) => {
    const { requesterId, recipientId } = req.body;

    if (!requesterId || !recipientId) return res.status(400).json({ error: 'requesterId and recipientId are required' });
    if (requesterId === recipientId) return res.status(400).json({ error: 'Cannot send request to yourself' });

    try {
        const friendship = new Friendship({ requester: requesterId, recipient: recipientId });
        await friendship.save();
        res.status(200).json({ message: 'Friend request sent successfully' });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ error: 'Friend request already exists' });
        }
        console.error(error);
        res.status(500).json({ error: 'Failed to send friend request' });
    }
});

// Accept friend request
router.post('/friend-request/accept', async (req, res) => {
    const { requesterId, recipientId } = req.body;
    if (!requesterId || !recipientId) return res.status(400).json({ error: 'requesterId and recipientId are required' });

    try {
        const friendship = await Friendship.findOneAndUpdate(
            { requester: requesterId, recipient: recipientId, status: 'pending' },
            { status: 'accepted' },
            { new: true }
        );

        if (!friendship) return res.status(404).json({ error: 'Friend request not found' });

        res.status(200).json({ message: 'Friend request accepted', friendship });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to accept friend request' });
    }
});
// Cancel a pending friend request
router.post('/friend-request/cancel', async (req, res) => {
    const { requesterId, recipientId } = req.body;

    if (!requesterId || !recipientId) {
        return res.status(400).json({ error: 'requesterId and recipientId are required' });
    }

    try {
        // Either side can cancel the request if it's still pending
        const friendship = await Friendship.findOneAndDelete({
            $or: [
                { requester: requesterId, recipient: recipientId, status: 'pending' },
                { requester: recipientId, recipient: requesterId, status: 'pending' },
            ],
        });

        if (!friendship) {
            return res.status(404).json({ error: 'Friendship not found' });
        }

        res.status(200).json({ message: 'Friend request canceled successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to cancel friend request' });
    }
});

// Remove/unfriend
router.post('/friend/remove', async (req, res) => {
    const { userId, friendId } = req.body;
    if (!userId || !friendId) return res.status(400).json({ error: 'userId and friendId are required' });

    try {
        const friendship = await Friendship.findOneAndDelete({
            $or: [
                { requester: userId, recipient: friendId },
                { requester: friendId, recipient: userId }
            ],
            status: 'accepted'
        });

        if (!friendship) return res.status(404).json({ error: 'Friendship not found' });

        res.status(200).json({ message: 'Friend removed successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to remove friend' });
    }
});

// Get all friends of a user
router.post('/friends', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    try {
        const friendships = await Friendship.find({
            $or: [
                { requester: userId, status: 'accepted' },
                { recipient: userId, status: 'accepted' }
            ]
        }).populate({
            path: 'requester',
            model: 'Profile',
            select: 'Name email profilePicture userId',
            localField: 'requester',
            foreignField: 'userId'
        }).populate({
            path: 'recipient',
            model: 'Profile',
            select: 'Name email profilePicture userId',
            localField: 'recipient',
            foreignField: 'userId'
        });

        const friends = friendships.map(f =>
            f.requester.userId.toString() === userId ? f.recipient : f.requester
        );

        res.status(200).json({ friends });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch friends' });
    }
});

// Get pending friend requests for a user
router.post('/friend-requests', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    try {
        const requests = await Friendship.find({ recipient: userId, status: 'pending' })
            .populate({
                path: 'requester',
                model: 'Profile',
                select: 'name email profilePicture userId',
                localField: 'requester',
                foreignField: 'userId'
            });

        res.status(200).json({ requests });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch friend requests' });
    }
});

module.exports = router;
