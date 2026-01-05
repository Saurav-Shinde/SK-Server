import stream from "stream";
import EligibilitySubmission from "../models/eligibility.js";
import { scoreEligibility } from "../utils/scoreEligibility.js";
import { generateAnalysisSummary } from "../utils/geminiService.js";
import { sendEligibilityEmails } from "../utils/emailService.js";
import Brand from "../models/brand.js";
import User from "../models/user.js";
import cloudinary from "../config/cloudinary.js";

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {}
    return value.split(",").map(v => v.trim()).filter(Boolean);
  }
  return [];
}

export const submitEligibility = async (req, res) => {
  try {
    console.log("Incoming eligibility request");

    let attachmentLinks = [];

    // ---------- FILE UPLOAD ----------
    if (req.files?.length) {
      const uploadToCloudinary = (fileBuffer, filename) =>
        new Promise((resolve, reject) => {
          const pass = new stream.PassThrough();

          const cloudStream = cloudinary.uploader.upload_stream(
            {
              resource_type: "raw",
              folder: "eligibility_uploads",
              public_id: filename,
            },
            (err, result) => {
              if (err) return reject(err);
              resolve(result);
            }
          );

          pass.end(fileBuffer);
          pass.pipe(cloudStream);
        });

      for (const f of req.files) {
        const uploaded = await uploadToCloudinary(f.buffer, f.originalname);
        attachmentLinks.push(uploaded.secure_url);
      }
    }

    // ---------- MERGE PAYLOAD ----------
    const payload = {
      ...req.body,
      attachments: attachmentLinks,
    };

    // ---------- NORMALIZE ARRAYS ----------
    payload.activationOpportunities = toArray(payload.activationOpportunities);
    payload.domesticOpportunities = toArray(payload.domesticOpportunities);
    payload.menuSupplyChainComplexity = toArray(payload.menuSupplyChainComplexity);

    // ---------- CONVERT NUMBERS ----------
    payload.deliveryAOV = Number(payload.deliveryAOV || 0);
    payload.numberOfMenuItems = Number(payload.numberOfMenuItems || 0);

    // ---------- CLEAN STRINGS ----------
    payload.brandName = payload.brandName?.trim();
    payload.submittedByEmail = payload.submittedByEmail?.toLowerCase().trim() || null;

    // ---------- VALIDATION ----------
    const requiredFields = [
      "brandName",
      "locationMapping",
      "brandStrength",
      "socialMediaEngagement",
      "bmDeliverySales",
      "deliveryAOV",
      "cogsAnalysis",
      "dspRateType",
      "wastageRisk",
      "numberOfMenuItems",
      "packagingType",
      "activationOpportunities",
      "domesticOpportunities",
      "dspMarketingCommitment",
      "howDidYouHear",
    ];

    for (const field of requiredFields) {
      if (!payload[field] || payload[field].length === 0) {
        return res.status(400).json({
          message: `Field "${field}" is required`,
        });
      }
    }

    // ---------- SCORE ----------
    const scoreResult = scoreEligibility(payload);
    const rawScore = scoreResult.total_score_0_to_10 || 0;

    payload.totalScore = rawScore;
    payload.eligibilityPassed = rawScore >= 5.5;

    // ---------- AI SUMMARY ----------
    try {
      payload.aiAnalysisSummary = await generateAnalysisSummary(payload, scoreResult);
    } catch {
      payload.aiAnalysisSummary = `Score: ${rawScore}/10`;
    }

    // ---------- SAVE ----------
    const submission = await EligibilitySubmission.create(payload);

    return res.status(201).json({
      message: "Submitted",
      submissionId: submission._id,
      score: rawScore,
      attachments: attachmentLinks,
    });

  } catch (err) {
    console.error("ELIGIBILITY ERROR:", err);
    res.status(500).json({
      message: err.message || "Internal server error",
    });
  }
};
