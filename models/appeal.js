const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const appealSchema = new mongoose.Schema(
    {
        appealId: {
            type: String,
            unique: true,
            default: () => uuidv4(),
        },

        verificationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Verification",
            required: true,
        },

        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        appealMessage: {
            type: String,
            required: true,
        },

        // ✅ SAME single-document format
        updatedDocuments: {
            document: {
                type: String,
                required: true,
            },
            documentType: {
                type: String,
                required: true,
            },
            registrationCertificate: {
                type: String,
                default: null,
            },
        },

        status: {
            type: String,
            enum: ["pending", "approved", "rejected"],
            default: "pending",
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
    },
    { timestamps: true }
);

appealSchema.index({ verificationId: 1, status: 1 });

module.exports = mongoose.model("Appeal", appealSchema);
