/**
 * Governor Node.js Integration Example
 * 
 * This example shows how to integrate Governor into a Node.js application
 * to control escalation pressure across different channels.
 */

const fetch = require('node-fetch');

// Configuration
const GOVERNOR_API_URL = process.env.GOVERNOR_API_URL || 'https://governer.vercel.app';

/**
 * Governor Client
 */
class GovernorClient {
  constructor(apiUrl = GOVERNOR_API_URL) {
    this.apiUrl = apiUrl;
  }

  /**
   * Check if escalation is allowed for a user
   * 
   * @param {Object} options
   * @param {string} options.userId - Unique user identifier
   * @param {string} options.actionType - Type of escalation (urgency|discount|interruption|reminder)
   * @param {string} [options.surface] - Where the escalation will appear (email|sms|push|in-app)
   * @param {Object} [options.context] - Additional context
   * @returns {Promise<Object>} Decision object with allowed, reason, decisionId
   */
  async check({ userId, actionType, surface, context = {} }) {
    const response = await fetch(`${this.apiUrl}/api/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        actionType,
        surface,
        context
      })
    });

    if (!response.ok) {
      throw new Error(`Governor check failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Record the outcome of an escalation attempt
   * 
   * @param {Object} options
   * @param {string} options.decisionId - Decision ID from check()
   * @param {string} options.userId - User identifier
   * @param {string} options.actionType - Type of escalation
   * @param {string} options.outcome - What happened (executed|downgraded|blocked)
   * @param {Object} [options.signals] - User response signals
   * @param {boolean} [options.signals.dismissed] - User dismissed the message
   * @param {boolean} [options.signals.ignored] - User ignored the message
   * @param {boolean} [options.signals.hesitated] - User hesitated before acting
   * @param {Object} [options.context] - Additional context
   * @returns {Promise<Object>} Result with ok status
   */
  async record({ decisionId, userId, actionType, outcome, signals = {}, context = {} }) {
    const response = await fetch(`${this.apiUrl}/api/record`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decisionId,
        userId,
        actionType,
        outcome,
        signals,
        context
      })
    });

    if (!response.ok) {
      throw new Error(`Governor record failed: ${response.statusText}`);
    }

    return response.json();
  }
}

// ============================================================================
// Example Use Cases
// ============================================================================

/**
 * Example 1: Email Marketing Campaign
 * Check before sending an urgent email
 */
async function sendMarketingEmail(userId, emailType) {
  const governor = new GovernorClient();

  console.log(`\n📧 Attempting to send ${emailType} email to user ${userId}`);

  // Check with Governor first
  const decision = await governor.check({
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
    // Send the email
    console.log(`   Sending ${emailType} email...`);
    await sendEmail(userId, emailType); // Your email sending logic
    
    // Record that it was executed
    await governor.record({
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
    // Respect Governor's decision
    if (decision.suggestedActionType) {
      console.log(`   💡 Suggestion: Try "${decision.suggestedActionType}" instead`);
    }
    
    // Record that it was blocked
    await governor.record({
      decisionId: decision.decisionId,
      userId,
      actionType: emailType === 'urgent' ? 'urgency' : 'reminder',
      outcome: 'blocked'
    });
  }
}

/**
 * Example 2: In-App Upgrade Modal
 * Check before showing an interruption
 */
async function showUpgradeModal(userId) {
  const governor = new GovernorClient();

  console.log(`\n💬 Attempting to show upgrade modal to user ${userId}`);

  const decision = await governor.check({
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
    // Show the modal
    console.log(`   Displaying modal...`);
    const userDismissed = await displayModal(userId); // Your modal logic
    
    // Record the outcome with user signals
    await governor.record({
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
    // Don't show the modal
    console.log(`   Modal blocked - user needs a break`);
    await governor.record({
      decisionId: decision.decisionId,
      userId,
      actionType: 'interruption',
      outcome: 'blocked'
    });
  }
}

/**
 * Example 3: SMS Campaign
 * Check before sending SMS with discount
 */
async function sendDiscountSMS(userId, discountAmount) {
  const governor = new GovernorClient();

  console.log(`\n💬 Attempting to send ${discountAmount}% discount SMS to user ${userId}`);

  const decision = await governor.check({
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
    await sendSMS(userId, `Get ${discountAmount}% off now!`); // Your SMS logic
    
    await governor.record({
      decisionId: decision.decisionId,
      userId,
      actionType: 'discount',
      outcome: 'executed',
      context: {
        smsDelivered: true
      }
    });
    console.log(`   ✅ SMS sent`);
  } else {
    // Downgrade to a reminder without discount urgency
    if (decision.suggestedActionType === 'reminder') {
      console.log(`   Downgrading to gentle reminder...`);
      await sendSMS(userId, 'Our sale is still on!'); // Softer message
      
      await governor.record({
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
      await governor.record({
        decisionId: decision.decisionId,
        userId,
        actionType: 'discount',
        outcome: 'blocked'
      });
    }
  }
}

// ============================================================================
// Mock Functions (Replace with your actual implementation)
// ============================================================================

async function sendEmail(userId, type) {
  // Replace with your email sending logic (SendGrid, Mailgun, etc.)
  return Promise.resolve();
}

async function displayModal(userId) {
  // Replace with your modal display logic
  // Return true if user dismissed, false if they took action
  return Promise.resolve(Math.random() > 0.5); // Simulated
}

async function sendSMS(userId, message) {
  // Replace with your SMS sending logic (Twilio, etc.)
  return Promise.resolve();
}

// ============================================================================
// Run Examples
// ============================================================================

async function runExamples() {
  console.log('='.repeat(60));
  console.log('Governor Node.js Integration Examples');
  console.log('='.repeat(60));

  try {
    // Example 1: Send urgent email
    await sendMarketingEmail('user_001', 'urgent');
    
    // Try again immediately - should be blocked by cooldown
    await sendMarketingEmail('user_001', 'urgent');
    
    // Example 2: Show upgrade modal
    await showUpgradeModal('user_002');
    
    // Example 3: Send discount SMS
    await sendDiscountSMS('user_003', 20);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Examples completed successfully!');
    console.log('='.repeat(60));
    console.log('\nCheck your Supabase dashboard to see logged events:');
    console.log('https://supabase.com/dashboard/project/xutgikcqbjdubwveidir/editor');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nMake sure:');
    console.error('1. Governor API is deployed and accessible');
    console.error('2. Environment variables are set in Vercel');
    console.error('3. Database migration has been run');
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples();
}

// Export for use in other modules
module.exports = { GovernorClient };
