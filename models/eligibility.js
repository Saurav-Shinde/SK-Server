import mongoose from 'mongoose'

const eligibilitySchema = new mongoose.Schema(
  {
    // Meta
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    submittedByEmail: { type: String, default: null },

    // Mapping
    brandName: { type: String, required: true },
    locationMapping: { type: String, required: true },
    brandStrength: { type: String, required: true },
    socialMediaEngagement: { type: String, required: true },
    ristaOutletId: { type: String, default: null },

    swiggyRating: { type: Number, default: null },
    zomatoRating: { type: Number, default: null },
    dspRatings: { type: String, default: null },

    // Operating
    bmDeliverySales: { type: String, required: true },
    deliveryAOV: { type: Number, required: true },
    cogsAnalysis: { type: String, required: true },

    dspRateType: { type: String, required: true },
    dspRatePercent: { type: String, default: null },

    wastageRisk: { type: String, required: true },

    numberOfMenuItems: { type: Number, required: true },
    packagingType: { type: String, required: true },

    menuSupplyChainComplexity: { type: [String], required: true },

    launchCapex: { type: String, required: true },
    launchCapexPieces: { type: String, default: null },

    smallwaresNeeded: { type: String, default: null },
    smallwaresCost: { type: String, required: true },

    // Expansion
    activationOpportunities: { type: [String], required: true },
    domesticOpportunities: { type: [String], required: true },
    dspMarketingCommitment: { type: String, required: true },

    // Special Conditions
    retrofittingNeeded: { type: String, required: true },
    additionalSpaceRequired: { type: String, required: true },
    procurementSuppliers: { type: String, required: true },
    multipleDeliveries: { type: String, required: true },
    additionalTrainingTravel: { type: String, required: true },
    launchTravelCosts: { type: String, required: true },
    specialReportingIntegrations: { type: String, required: true },
    equipmentAvailability: { type: String, required: true },
    howDidYouHear: { type: String, required: true },

    // ✅ NEW — Cloudinary Excel uploads
    attachments: [
      {
        type: String, // secure_url
      },
    ],

    // Scoring + AI
    totalScore: { type: Number },
    meetsThreshold: { type: Boolean },
    decision: { type: String },

    sectionScores: {
      mapping: { raw: Number, normalized: Number },
      operating: { raw: Number, normalized: Number },
      expansion: { raw: Number, normalized: Number },
      special_conditions: { raw: Number, normalized: Number },
    },

    aiAnalysisSummary: { type: String },
  },
  { timestamps: true }
)

export default mongoose.model('EligibilitySubmission', eligibilitySchema)
