const express = require("express");
const router = express.Router();
const { v2: cloudinary } = require("cloudinary");
const authMiddleware = require("../../middleware/auth");
const SecureImage = require("../../models/SecureImage");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});


// 🟩 Upload secure image (private upload)
router.post("/uploadSecure", authMiddleware, async (req, res) => {
  try {
    const { image } = req.body; // base64 string or file URL

    if (!image) return res.status(400).json({ message: "No image provided." });

    const result = await cloudinary.uploader.upload(image, {
      folder: "secure",
      type: "authenticated", // private
      resource_type: "image",
    });

    const newImage = await SecureImage.create({
      user: req.user.userId,
      publicId: result.public_id,
      url: result.secure_url,
    });

    res.status(201).json({
      message: "Image uploaded securely.",
      image: newImage,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ message: "Image upload failed.", error });
  }
});


// 🟦 Get all images uploaded by current user
router.get("/myImages", authMiddleware, async (req, res) => {
  try {
    const images = await SecureImage.find({ user: req.user.userId })
      .sort({ createdAt: -1 });

    res.status(200).json({
      count: images.length,
      images,
    });
  } catch (error) {
    console.error("Get images error:", error);
    res.status(500).json({ message: "Error fetching images.", error });
  }
});


// 🟨 Admin: Get all images for a specific user
router.get("/user/:userId", authMiddleware, async (req, res) => {
  try {
    if (req.user.type !== "admin") {
      return res.status(403).json({ message: "Access denied. Admins only." });
    }

    const { userId } = req.params;
    const images = await SecureImage.find({ user: userId })
      .sort({ createdAt: -1 });

    res.status(200).json({
      count: images.length,
      images,
    });
  } catch (error) {
    console.error("Admin get user images error:", error);
    res.status(500).json({ message: "Error fetching user images.", error });
  }
});


// 🟧 Generate temporary signed URL (for viewing private image)
router.get("/signedUrl/:publicId", authMiddleware, async (req, res) => {
  try {
    const { publicId } = req.params;

    const image = await SecureImage.findOne({ publicId });
    if (!image) return res.status(404).json({ message: "Image not found." });

    // only owner or admin can view
    if (req.user.type !== "admin" && image.user.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Not authorized." });
    }

    // signed URL valid for 2 minutes
    const signedUrl = cloudinary.url(publicId, {
      secure: true,
      sign_url: true,
      type: "authenticated",
      expires_at: Math.floor(Date.now() / 1000) + 120,
    });

    res.status(200).json({ signedUrl });
  } catch (error) {
    console.error("Signed URL error:", error);
    res.status(500).json({ message: "Failed to generate signed URL.", error });
  }
});


// 🟥 Delete image (only by owner)
router.delete("/:publicId", authMiddleware, async (req, res) => {
  try {
    const { publicId } = req.params;

    const image = await SecureImage.findOne({ publicId });
    if (!image) return res.status(404).json({ message: "Image not found." });

    if (image.user.toString() !== req.user.userId) {
      return res.status(403).json({ message: "Not authorized to delete this image." });
    }

    await cloudinary.uploader.destroy(publicId, { type: "authenticated" });
    await SecureImage.deleteOne({ publicId });

    res.status(200).json({ message: "Image deleted successfully." });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ message: "Error deleting image.", error });
  }
});

module.exports = router;
