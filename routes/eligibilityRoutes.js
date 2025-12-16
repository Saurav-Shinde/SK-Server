
// backend/Routes/eligibilityRoutes.js

import express from 'express'
import EligibilitySubmission from '../models/eligibility.js'
import { scoreEligibility } from '../utils/scoreEligibility.js'
import { generateAnalysisSummary } from '../utils/geminiService.js'
import { sendEligibilityEmails } from '../utils/emailService.js'

const router = express.Router()

// Fields that should be stored as numbers
const numericFields = ['deliveryAOV', 'numberOfMenuItems']

router.post('/', async (req, res) => {
  try {
    const payload = { ...req.body }

    // Required fields (must be present in the request body)
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

      // these are also required in your schema
      'launchCapex',
      'smallwaresCost',
      'additionalSpaceRequired',
      'procurementSuppliers',
      'additionalTrainingTravel',
      'launchTravelCosts',
      'specialReportingIntegrations',
    ]

    // Basic presence check (empty string / undefined / null)
    const missingField = requiredFields.find(
      (field) =>
        payload[field] === undefined ||
        payload[field] === null ||
        payload[field] === ''
    )

    if (missingField) {
      return res
        .status(400)
        .json({ message: `Field "${missingField}" is required.` })
    }

    // Cast numeric fields
    numericFields.forEach((field) => {
      if (
        payload[field] !== undefined &&
        payload[field] !== null &&
        payload[field] !== ''
      ) {
        const num = Number(payload[field])
        if (!Number.isNaN(num)) {
          payload[field] = num
        }
      }
    })

    // Normalize some fields
    if (typeof payload.brandName === 'string') {
      payload.brandName = payload.brandName.trim()
    }

    if (
      payload.submittedByEmail &&
      typeof payload.submittedByEmail === 'string'
    ) {
      payload.submittedByEmail = payload.submittedByEmail
        .toLowerCase()
        .trim()
    }

    // ----------------------------------------------------
    // 1) Calculate eligibility score
    // ----------------------------------------------------
    const scoreResult = scoreEligibility(payload)
    const rawScore =
      scoreResult.total_score_0_to_10 ??
      scoreResult.total_score_1_to_10 ??
      0

    // keep your existing threshold logic (>= 8.5)
    const meetsThreshold = rawScore >= 8.5

    // ----------------------------------------------------
    // 1.1) Derive tier / band messaging
    // ----------------------------------------------------
    let tier = ''
    let tierLabel = ''
    let tierMessage = ''

    if (rawScore < 4) {
      tier = 'tier_1'
      tierLabel = 'Needs Significant Improvement'
      tierMessage =
        'Your current score indicates the brand is not yet ready for onboarding. We recommend working on core performance areas and revisiting after improvements.'
    } else if (rawScore >= 4 && rawScore < 6) {
      tier = 'tier_2'
      tierLabel = 'Promising but Needs Improvement'
      tierMessage =
        'Your score is good, but there is still room for improvement. Please schedule a call with our internal team to understand how you can meet the onboarding criteria.'
    } else if (rawScore >= 6 && rawScore < 8) {
      tier = 'tier_3'
      tierLabel = 'Strong Candidate'
      tierMessage =
        'Your brand is performing well and is close to onboarding readiness. A discussion with our team can help unlock the remaining potential.'
    } else {
      tier = 'tier_4'
      tierLabel = 'Top Tier Brand'
      tierMessage =
        'Excellent performance! Your brand falls in our highest tier. Our team will reach out to complete onboarding, or you can schedule a call at your convenience.'
    }

    const onboardingStatus = meetsThreshold ? 'ONBOARDED' : 'NOT_ONBOARDED'

    // ----------------------------------------------------
    // 2) Generate AI analysis summary with Gemini
    // ----------------------------------------------------
    let aiAnalysisSummary = ''
    try {
      aiAnalysisSummary = await generateAnalysisSummary(payload, scoreResult)
    } catch (error) {
      console.error('Failed to generate AI summary:', error)

      const { total_score_0_to_10 = rawScore, brand_name } = scoreResult
      aiAnalysisSummary = meetsThreshold
        ? `Your brand "${brand_name}" demonstrates excellent consistency across mapping, operations, and expansion potential. With a score of ${total_score_0_to_10}/10, your current scale and partner portfolio align perfectly with Skope Kitchens standards.`
        : `We've reviewed your brand "${brand_name}" and identified several areas that need attention. With a score of ${total_score_0_to_10}/10, we recommend addressing the highlighted gaps in your profile before resubmission.`
    }

    // ----------------------------------------------------
    // 3) Attach scoring + AI summary + tier info to payload for DB
    // ----------------------------------------------------
    payload.totalScore = rawScore
    payload.meetsThreshold = meetsThreshold
    payload.decision = scoreResult.decision
    payload.sectionScores = scoreResult.section_scores
    payload.aiAnalysisSummary = aiAnalysisSummary
    payload.tier = tier
    payload.tierLabel = tierLabel
    payload.tierMessage = tierMessage
    payload.onboardingStatus = onboardingStatus

    // ----------------------------------------------------
    // 4) Save submission to MongoDB
    // ----------------------------------------------------
    const submission = await EligibilitySubmission.create(payload)

    // ----------------------------------------------------
    // 5) Fire emails (non-blocking for client)
    // ----------------------------------------------------
    try {
      await sendEligibilityEmails({
        submission: payload,
        scoreResult,
        aiAnalysisSummary,
        tier,
        tierLabel,
        tierMessage,
        onboardingStatus,
      })
    } catch (emailError) {
      console.error('Failed to send eligibility emails:', emailError)
    }

    // ----------------------------------------------------
    // 6) Respond to client
    // ----------------------------------------------------
    res.status(201).json({
      message: 'Eligibility form submitted successfully.',
      submissionId: submission._id,
      score: rawScore,
      meetsThreshold,
      decision: scoreResult.decision,
      sectionScores: scoreResult.section_scores,
      aiAnalysisSummary,
      tier,
      tierLabel,
      tierMessage,
      onboardingStatus,
    })
  } catch (error) {
    console.error('Eligibility submission error:', error)
    res.status(500).json({
      message: 'Unable to submit eligibility form. Please try again.',
    })
  }
})

export default router
