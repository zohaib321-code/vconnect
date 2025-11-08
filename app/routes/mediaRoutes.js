const express = require("express");
const router = express.Router();
const { v2: cloudinary } = require("cloudinary");
const SecureImage = require("../../models/SecureImage");

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// 🟩 Upload secure image (public test version)
router.post("/uploadSecure", async (req, res) => {
  try {
    const { image } = req.body; // base64 string or file URL

    if (!image) return res.status(400).json({ message: "No image provided." });

    const result = await cloudinary.uploader.upload(image, {
      folder: "secure_test",
      resource_type: "image",
    });

    // Save to DB (optional)
    const newImage = await SecureImage.create({
      publicId: result.public_id,
      url: result.secure_url,
    });

    res.status(201).json({
      message: "Image uploaded successfully.",
      image: newImage,
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ message: "Image upload failed.", error });
  }
});

// 🟦 Get all images (public)
router.get("/myImages", async (req, res) => {
  try {
    const images = await SecureImage.find().sort({ createdAt: -1 });

    res.status(200).json({
      count: images.length,
      images,
    });
  } catch (error) {
    console.error("Get images error:", error);
    res.status(500).json({ message: "Error fetching images.", error });
  }
});

// 🟧 Generate direct (non-signed) URL for simplicity
router.get("/signedUrl/:publicId", async (req, res) => {
  try {
    const { publicId } = req.params;

    const image = await SecureImage.findOne({ publicId });
    if (!image) return res.status(404).json({ message: "Image not found." });

    const directUrl = cloudinary.url(publicId, {
      secure: true,
    });

    res.status(200).json({ directUrl });
  } catch (error) {
    console.error("Signed URL error:", error);
    res.status(500).json({ message: "Failed to generate URL.", error });
  }
});

// 🟥 Delete image (public test version)
router.delete("/:publicId", async (req, res) => {
  try {
    const { publicId } = req.params;

    const image = await SecureImage.findOne({ publicId });
    if (!image) return res.status(404).json({ message: "Image not found." });

    await cloudinary.uploader.destroy(publicId);
    await SecureImage.deleteOne({ publicId });

    res.status(200).json({ message: "Image deleted successfully." });
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({ message: "Error deleting image.", error });
  }
});

module.exports = router;
