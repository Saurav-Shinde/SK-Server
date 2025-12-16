import dotenv from 'dotenv'

dotenv.config()

const {
  SENDGRID_API_KEY,
  SENDGRID_TEMPLATE_ID,
  EMAIL_FROM,
  SENDGRID_FROM_NAME,
  INTERNAL_ELIGIBILITY_EMAIL,
} = process.env

// Fallback internal email
const DEFAULT_INTERNAL_EMAIL = 'sanjuktha@skopekitchens.com'

// Basic safety check
if (!SENDGRID_API_KEY) {
  console.warn(
    'WARNING: SENDGRID_API_KEY is not set. Emails will NOT be sent.'
  )
}

if (!SENDGRID_TEMPLATE_ID) {
  console.warn(
    'WARNING: SENDGRID_TEMPLATE_ID is not set. Emails will NOT be sent.'
  )
}

/**
 * Low-level SendGrid sender using Dynamic Templates
 */
const sendViaSendGrid = async ({ to, dynamicData }) => {
  if (!SENDGRID_API_KEY || !SENDGRID_TEMPLATE_ID || !to) return

  const fromEmail = EMAIL_FROM || 'no-reply@skopekitchens.com'
  const fromName = SENDGRID_FROM_NAME || 'Skope Kitchens'

  const body = {
    personalizations: [
      {
        to: [{ email: to }],
        dynamic_template_data: dynamicData,
      },
    ],
    from: {
      email: fromEmail,
      name: fromName,
    },
    template_id: SENDGRID_TEMPLATE_ID,
  }

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (res.status !== 202) {
      const errText = await res.text().catch(() => '')
      console.error('SendGrid email failed:', res.status, errText)
    } else {
      console.log(`SendGrid email sent to ${to}`)
    }
  } catch (err) {
    console.error('SendGrid email error:', err)
  }
}

/**
 * Public API: Send Eligibility Result Emails
 */
export const sendEligibilityEmails = async ({
  submission,
  scoreResult,
  aiAnalysisSummary,
}) => {
  const userEmail = submission?.submittedByEmail
  const internalEmail =
    INTERNAL_ELIGIBILITY_EMAIL || DEFAULT_INTERNAL_EMAIL

  if (!userEmail && !internalEmail) {
    console.warn('No recipient email configured.')
    return
  }

  const { total_score_0_to_10, decision, section_scores } =
    scoreResult || {}

  const brandName = submission?.brandName || 'Unknown Brand'

  const decisionLabel =
    decision === 'MOVE_FORWARD'
      ? 'Approved'
      : 'Needs Review'

  const formatValue = (val) => {
    if (Array.isArray(val)) return val.join(', ')
    if (val === undefined || val === null || val === '') return 'Not provided'
    return String(val)
  }

  // Build dynamic template payload
  const dynamicTemplateData = {
    submittedBy: submission?.submittedByEmail,
    brandName,
    overallScore: total_score_0_to_10?.toFixed(2),
    decision: decisionLabel,
    aiAnalysisSummary,

    mappingScore: ((section_scores?.mapping?.normalized || 0) * 100).toFixed(1),
    operatingScore: ((section_scores?.operating?.normalized || 0) * 100).toFixed(1),
    expansionScore: ((section_scores?.expansion?.normalized || 0) * 100).toFixed(1),
    specialScore: ((section_scores?.special_conditions?.normalized || 0) * 100).toFixed(1),

    locationMapping: formatValue(submission?.locationMapping),
    brandStrength: formatValue(submission?.brandStrength),
    socialMedia: formatValue(submission?.socialMediaEngagement),
    swiggyRating: formatValue(submission?.swiggyRating),
    zomatoRating: formatValue(submission?.zomatoRating),
    dspRate: formatValue(submission?.dspRatePercent),
    dspRateType: formatValue(submission?.dspRateType),
    dailySales: formatValue(submission?.bmDeliverySales),
    deliveryAov: formatValue(submission?.deliveryAOV),
    cogs: formatValue(submission?.cogsAnalysis),
    menuItems: formatValue(submission?.numberOfMenuItems),
    packagingType: formatValue(submission?.packagingType),

    activationOpportunities: formatValue(submission?.activationOpportunities),
    domesticOpportunities: formatValue(submission?.domesticOpportunities),
    marketingCommitment: formatValue(submission?.dspMarketingCommitment),
  }

  // Send to brand / client
  if (userEmail) {
    await sendViaSendGrid({
      to: userEmail,
      dynamicData: dynamicTemplateData,
    })
  }

  // Send to internal team
  if (internalEmail) {
    await sendViaSendGrid({
      to: internalEmail,
      dynamicData: dynamicTemplateData,
    })
  }
}
