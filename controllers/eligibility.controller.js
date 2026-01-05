import EligibilitySubmission from '../models/eligibility.js'
import { scoreEligibility } from '../utils/scoreEligibility.js'
import { generateAnalysisSummary } from '../utils/geminiService.js'
import { sendEligibilityEmails } from '../utils/emailService.js'
import Brand from '../models/brand.js'
import User from '../models/user.js'
import cloudinary from "../config/cloudinary.js";

const numericFields = ['deliveryAOV', 'numberOfMenuItems']

export const submitEligibility = async (req, res) => {
  try {
    let fileLinks = [];

    // ---------- FILE UPLOADS (optional) ----------
    if (req.files?.length) {
      // promise wrapper for upload_stream
      const uploadToCloudinary = (fileBuffer, filename) =>
        new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            {
              resource_type: "raw",
              folder: "eligibility_uploads",
              public_id: filename,
            },
            (err, result) => {
              if (err) reject(err);
              else resolve(result);
            }
          );
          stream.end(fileBuffer);
        });

      for (const file of req.files) {
        const uploaded = await uploadToCloudinary(file.buffer, file.originalname);
        fileLinks.push(uploaded.secure_url);
      }
    }

    const payload = { ...req.body, fileLinks };

    // ------------------ 0) Validate ------------------
    const requiredFields = [
      'brandName',
      'locationMapping',
      'brandStrength',
      'socialMediaEngagement',
      'bmDeliverySales',
      'deliveryAOV',
      'cogsAnalysis',
      'dspRateType',
      'wastageRisk',
      'numberOfMenuItems',
      'packagingType',
      'activationOpportunities',
      'domesticOpportunities',
      'dspMarketingCommitment',
      'retrofittingNeeded',
      'multipleDeliveries',
      'equipmentAvailability',
      'howDidYouHear',
      'launchCapex',
      'smallwaresCost',
      'additionalSpaceRequired',
      'procurementSuppliers',
      'additionalTrainingTravel',
      'launchTravelCosts',
      'specialReportingIntegrations',
    ];

    const missingField = requiredFields.find(
      (f) => payload[f] === undefined || payload[f] === null || payload[f] === ''
    );

    if (missingField) {
      return res.status(400).json({
        message: `Field "${missingField}" is required.`,
      });
    }

    // ------------------ 1) Normalize ------------------
    numericFields.forEach((field) => {
      if (payload[field] !== undefined) {
        const num = Number(payload[field]);
        if (!Number.isNaN(num)) payload[field] = num;
      }
    });

    payload.brandName = payload.brandName?.trim();
    payload.ristaOutletId = payload.ristaOutletId
      ? String(payload.ristaOutletId).trim()
      : null;
    payload.submittedByEmail = payload.submittedByEmail?.toLowerCase().trim();

    // ------------------ 2) Score ------------------
    const scoreResult = scoreEligibility(payload);
    const rawScore = scoreResult.total_score_0_to_10 ?? 0;

    const eligibilityPassed = rawScore >= 5.5;

    const approvalStatus = eligibilityPassed ? 'APPROVED' : 'REJECTED';
    const operationalStatus = eligibilityPassed ? 'PENDING_SETUP' : 'NOT_ALLOWED';

    // ------------------ 3) Tier ------------------
    let tier = '';
    let tierLabel = '';
    let tierMessage = '';

    if (rawScore < 4) {
      tier = 'tier_1';
      tierLabel = 'Needs Significant Improvement';
      tierMessage = 'Your brand is not yet ready for onboarding. Improve core metrics and reapply.';
    } else if (rawScore < 6) {
      tier = 'tier_2';
      tierLabel = 'Promising but Needs Improvement';
      tierMessage = 'Your brand shows promise but needs improvements to qualify.';
    } else if (rawScore < 8) {
      tier = 'tier_3';
      tierLabel = 'Strong Candidate';
      tierMessage = 'Your brand is strong and close to onboarding readiness.';
    } else {
      tier = 'tier_4';
      tierLabel = 'Top Tier Brand';
      tierMessage = 'Excellent performance! Your brand qualifies for onboarding.';
    }

    // ------------------ 4) AI Summary ------------------
    let aiAnalysisSummary = '';
    try {
      aiAnalysisSummary = await generateAnalysisSummary(payload, scoreResult);
    } catch {
      aiAnalysisSummary = `Your brand scored ${rawScore}/10 based on submitted data.`;
    }

    // ------------------ 5) Attach metadata ------------------
    payload.totalScore = rawScore;
    payload.eligibilityPassed = eligibilityPassed;
    payload.approvalStatus = approvalStatus;
    payload.operationalStatus = operationalStatus;
    payload.sectionScores = scoreResult.section_scores;
    payload.aiAnalysisSummary = aiAnalysisSummary;
    payload.tier = tier;
    payload.tierLabel = tierLabel;
    payload.tierMessage = tierMessage;

    // ------------------ 6) Save ------------------
    const submission = await EligibilitySubmission.create(payload);

    // ------------------ 7) Auto-create brand ------------------
    if (eligibilityPassed) {
      let brand = await Brand.findOne({ brandName: payload.brandName });

      if (!brand) {
        brand = await Brand.create({
          brandName: payload.brandName,
          status: 'Approved',
          eligibilityScore: rawScore,
          operationalStatus: 'PENDING_SETUP',
          ristaOutletId: payload.ristaOutletId || undefined,
          createdBy: submission.submittedBy,
        });
      } else if (payload.ristaOutletId) {
        brand.ristaOutletId = payload.ristaOutletId;
        await brand.save();
      }

      if (submission.submittedBy) {
        await User.findByIdAndUpdate(
          submission.submittedBy,
          { brandName: payload.brandName },
          { new: true }
        );
      }
    }

    // ------------------ 8) Emails ------------------
    try {
      await sendEligibilityEmails({
        submission: payload,
        scoreResult,
        aiAnalysisSummary,
        tier,
        tierLabel,
        tierMessage,
        approvalStatus,
      });
    } catch (err) {
      console.error('Email sending failed:', err);
    }

    // ------------------ 9) Response ------------------
    return res.status(201).json({
      message: 'Eligibility form submitted successfully.',
      submissionId: submission._id,
      score: rawScore,
      eligibilityPassed,
      approvalStatus,
      operationalStatus,
      tier,
      tierLabel,
      tierMessage,
    });
  } catch (error) {
    console.error('Eligibility submission error:', error);
    return res.status(500).json({
      message: 'Unable to submit eligibility form. Please try again.',
    });
  }
};
