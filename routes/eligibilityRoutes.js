import express from 'express'
import EligibilitySubmission from '../models/eligibility.js'
import { scoreEligibility } from '../utils/scoreEligibility.js'
import { generateAnalysisSummary } from '../utils/geminiService.js'
import { sendEligibilityEmails } from '../utils/emailService.js'
import Brand from '../models/brand.js'
import User from '../models/user.js'

const router = express.Router()

// Fields that should be stored as numbers
const numericFields = ['deliveryAOV', 'numberOfMenuItems']

router.post('/', async (req, res) => {
  try {
    const payload = { ...req.body }

    // ----------------------------------------------------
    // 0) Validate required fields
    // ----------------------------------------------------
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
    ]

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

    // ----------------------------------------------------
    // 1) Normalize & cast data
    // ----------------------------------------------------
    numericFields.forEach((field) => {
      if (payload[field] !== undefined) {
        const num = Number(payload[field])
        if (!Number.isNaN(num)) payload[field] = num
      }
    })

    if (typeof payload.brandName === 'string') {
      payload.brandName = payload.brandName.trim()
    }

    if (payload.submittedByEmail) {
      payload.submittedByEmail = payload.submittedByEmail.toLowerCase().trim()
    }

    // ----------------------------------------------------
    // 2) Calculate eligibility score
    // ----------------------------------------------------
    const scoreResult = scoreEligibility(payload)
    const rawScore =
      scoreResult.total_score_0_to_10 ??
      scoreResult.total_score_1_to_10 ??
      0

    const meetsThreshold = rawScore >= 8.5
    const onboardingStatus = meetsThreshold ? 'ONBOARDED' : 'NOT_ONBOARDED'

    // ----------------------------------------------------
    // 3) Tier calculation
    // ----------------------------------------------------
    let tier = ''
    let tierLabel = ''
    let tierMessage = ''

    if (rawScore < 4) {
      tier = 'tier_1'
      tierLabel = 'Needs Significant Improvement'
      tierMessage =
        'Your brand is not yet ready for onboarding. Improve core metrics and reapply.'
    } else if (rawScore < 6) {
      tier = 'tier_2'
      tierLabel = 'Promising but Needs Improvement'
      tierMessage =
        'Your brand shows promise but needs improvements to qualify.'
    } else if (rawScore < 8) {
      tier = 'tier_3'
      tierLabel = 'Strong Candidate'
      tierMessage =
        'Your brand is strong and close to onboarding readiness.'
    } else {
      tier = 'tier_4'
      tierLabel = 'Top Tier Brand'
      tierMessage =
        'Excellent performance! Your brand qualifies for onboarding.'
    }

    // ----------------------------------------------------
    // 4) AI summary
    // ----------------------------------------------------
    let aiAnalysisSummary = ''
    try {
      aiAnalysisSummary = await generateAnalysisSummary(payload, scoreResult)
    } catch (err) {
      aiAnalysisSummary = `Your brand scored ${rawScore}/10 based on operational and growth metrics.`
    }

    // ----------------------------------------------------
    // 5) Attach derived data to payload
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
    // 6) Save eligibility submission
    // ----------------------------------------------------
    const submission = await EligibilitySubmission.create(payload)

    // ----------------------------------------------------
    // 7) 🔥 AUTO-CREATE BRAND IF APPROVED
    // ----------------------------------------------------
    if (meetsThreshold) {
      let brand = await Brand.findOne({ brandName: payload.brandName })

      if (!brand) {
        brand = await Brand.create({
          brandName: payload.brandName,
          status: 'Approved',
          eligibilityScore: rawScore,
          createdBy: submission.submittedBy,
        })
      }

      if (submission.submittedBy) {
        await User.findByIdAndUpdate(
          submission.submittedBy,
          { brandName: payload.brandName },
          { new: true }
        )
      }
    }

    // ----------------------------------------------------
    // 8) Send emails (non-blocking)
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
    } catch (emailErr) {
      console.error('Email sending failed:', emailErr)
    }

    // ----------------------------------------------------
    // 9) Final response (ONLY ONE RESPONSE)
    // ----------------------------------------------------
    return res.status(201).json({
      message: 'Eligibility form submitted successfully.',
      submissionId: submission._id,
      score: rawScore,
      meetsThreshold,
      tier,
      tierLabel,
      tierMessage,
      onboardingStatus,
    })
  } catch (error) {
    console.error('Eligibility submission error:', error)
    return res.status(500).json({
      message: 'Unable to submit eligibility form. Please try again.',
    })
  }
})

export default router
