const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const verificationSchema = new mongoose.Schema(
    {
        verificationId: {
            type: String,
            unique: true,
            default: () => uuidv4(),
        },

        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            unique: true, // ❗ one verification per organization
        },

        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
        },

        // ✅ SINGLE document structure
        documents: {
            document: {
                type: String, // Cloudinary URL
                required: true,
            },
            documentType: {
                type: String, // e.g. "Tax Certificate"
                required: true,
            },
            registrationCertificate: {
                type: String, // optional second proof
                default: null,
            },
        },

        additionalInfo: {
            type: String,
            default: "",
        },

        submittedAt: {
            type: Date,
            default: Date.now,
        },

        reviewedAt: Date,

        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },

        rejectionReason: String,
        adminNotes: String,
    },
    { timestamps: true }
);

// 🔥 Correct index
verificationSchema.index({ organizationId: 1, status: 1 });

module.exports = mongoose.model("Verification", verificationSchema);
