/**
 * SoftStop Node.js Integration Example
 *
 * Uses the softstop SDK (packages/sdk-js).
 * Local first: SOFTSTOP_API_URL / GOVERNOR_API_URL = http://localhost:3000
 */

const { SoftStop, GovernorClient } = require('softstop');

const API_URL =
  process.env.SOFTSTOP_API_URL ||
  process.env.GOVERNOR_API_URL ||
  'http://localhost:3000';

/**
 * Example 1: Email Marketing Campaign
 * Check before sending an urgent email
 */
async function sendMarketingEmail(userId, emailType) {
  const ss = new SoftStop({ url: API_URL });

  console.log(`\n📧 Attempting to send ${emailType} email to user ${userId}`);

  const decision = await ss.check({
    userId,
    actionType: emailType === 'urgent' ? 'urgency' : 'reminder',
    surface: 'email',
    context: {
      campaign: 'holiday_sale_2026',
      emailType
    }
  });

  console.log(`   Decision: ${decision.allowed ? '✅ ALLOWED' : '❌ BLOCKED'}`);
  console.log(`   Reason: ${decision.reason}`);

  if (decision.allowed) {
    console.log(`   Sending ${emailType} email...`);
    await sendEmail(userId, emailType);

    await ss.record({
      decisionId: decision.decisionId,
      userId,
      actionType: emailType === 'urgent' ? 'urgency' : 'reminder',
      outcome: 'executed',
      context: {
        emailId: 'email_12345',
        sent: true
      }
    });
    console.log(`   ✅ Email sent and recorded`);
  } else {
    if (decision.suggestedActionType) {
      console.log(`   💡 Suggestion: Try "${decision.suggestedActionType}" instead`);
    }

    await ss.record({
      decisionId: decision.decisionId,
      userId,
      actionType: emailType === 'urgent' ? 'urgency' : 'reminder',
      outcome: 'blocked',
      blockReason: decision.reason
    });
  }
}

/**
 * Example 2: In-App Upgrade Modal
 */
async function showUpgradeModal(userId) {
  const ss = new SoftStop({ url: API_URL });

  console.log(`\n💬 Attempting to show upgrade modal to user ${userId}`);

  const decision = await ss.check({
    userId,
    actionType: 'interruption',
    surface: 'in-app',
    context: {
      feature: 'upgrade_modal',
      trigger: 'feature_limit_reached'
    }
  });

  console.log(`   Decision: ${decision.allowed ? '✅ ALLOWED' : '❌ BLOCKED'}`);
  console.log(`   Reason: ${decision.reason}`);

  if (decision.allowed) {
    console.log(`   Displaying modal...`);
    const userDismissed = await displayModal(userId);

    await ss.record({
      decisionId: decision.decisionId,
      userId,
      actionType: 'interruption',
      outcome: 'executed',
      signals: {
        dismissed: userDismissed
      },
      context: {
        modalShown: true,
        userUpgraded: false
      }
    });
    console.log(`   ✅ Modal shown and outcome recorded`);
  } else {
    console.log(`   Modal blocked - user needs a break`);
    await ss.record({
      decisionId: decision.decisionId,
      userId,
      actionType: 'interruption',
      outcome: 'blocked',
      blockReason: decision.reason
    });
  }
}

/**
 * Example 3: SMS Campaign
 */
async function sendDiscountSMS(userId, discountAmount) {
  const ss = new SoftStop({ url: API_URL });

  console.log(`\n💬 Attempting to send ${discountAmount}% discount SMS to user ${userId}`);

  const decision = await ss.check({
    userId,
    actionType: 'discount',
    surface: 'sms',
    context: {
      discountPercent: discountAmount,
      campaign: 'flash_sale'
    }
  });

  console.log(`   Decision: ${decision.allowed ? '✅ ALLOWED' : '❌ BLOCKED'}`);
  console.log(`   Reason: ${decision.reason}`);

  if (decision.allowed) {
    console.log(`   Sending SMS...`);
    await sendSMS(userId, `Get ${discountAmount}% off now!`);

    await ss.record({
      decisionId: decision.decisionId,
      userId,
      actionType: 'discount',
      outcome: 'executed',
      context: {
        smsDelivered: true
      }
    });
    console.log(`   ✅ SMS sent`);
  } else if (decision.suggestedActionType === 'reminder') {
    console.log(`   Downgrading to gentle reminder...`);
    await sendSMS(userId, 'Our sale is still on!');

    await ss.record({
      decisionId: decision.decisionId,
      userId,
      actionType: 'discount',
      outcome: 'downgraded',
      context: {
        downgraded_to: 'reminder'
      }
    });
    console.log(`   ✅ Sent downgraded message`);
  } else {
    await ss.record({
      decisionId: decision.decisionId,
      userId,
      actionType: 'discount',
      outcome: 'blocked',
      blockReason: decision.reason
    });
  }
}

async function sendEmail() {
  return Promise.resolve();
}

async function displayModal() {
  return Promise.resolve(Math.random() > 0.5);
}

async function sendSMS() {
  return Promise.resolve();
}

async function runExamples() {
  console.log('='.repeat(60));
  console.log('SoftStop Node.js Integration Examples');
  console.log('='.repeat(60));

  try {
    await sendMarketingEmail('user_001', 'urgent');
    await sendMarketingEmail('user_001', 'urgent');
    await showUpgradeModal('user_002');
    await sendDiscountSMS('user_003', 20);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Examples completed successfully!');
    console.log('='.repeat(60));
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nMake sure SoftStop is running: pnpm dev (http://localhost:3000)');
  }
}

if (require.main === module) {
  runExamples();
}

module.exports = { SoftStop, GovernorClient };
