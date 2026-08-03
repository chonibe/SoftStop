/**
 * Governor Browser/JavaScript Integration Example
 * 
 * This example shows how to integrate Governor into a browser-based application
 * to control escalation pressure for in-app modals, popups, and user interactions.
 * 
 * Usage:
 *   <script src="governor.js"></script>
 *   <script>
 *     const governor = new GovernorClient();
 *     const decision = await governor.check({
 *       userId: 'user_123',
 *       actionType: 'interruption'
 *     });
 *   </script>
 */

class GovernorClient {
  /**
   * Initialize Governor client
   * @param {string} apiUrl - Governor API URL (defaults to local self-host)
   */
  constructor(apiUrl = (typeof window !== 'undefined' && window.GOVERNOR_API_URL) || 'http://localhost:3000') {
    this.apiUrl = String(apiUrl).replace(/\/$/, '');
    try {
      const host = new URL(this.apiUrl).hostname;
      this.prefix = /localhost|127\.0\.0\.1/.test(host) ? '/v1' : '/api';
    } catch {
      this.prefix = '/v1';
    }
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
   * 
   * @example
   * const decision = await governor.check({
   *   userId: 'user_123',
   *   actionType: 'interruption',
   *   surface: 'in-app',
   *   context: { feature: 'upgrade_modal' }
   * });
   * 
   * if (decision.allowed) {
   *   showModal();
   * }
   */
  async check({ userId, actionType, surface, context = {} }) {
    try {
      const response = await fetch(`${this.apiUrl}${this.prefix}/check`, {
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

      return await response.json();
    } catch (error) {
      console.error('Governor check error:', error);
      // Fail open - allow the action if Governor is unavailable
      return {
        allowed: true,
        reason: 'governor_unavailable',
        decisionId: null
      };
    }
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
   * 
   * @example
   * await governor.record({
   *   decisionId: decision.decisionId,
   *   userId: 'user_123',
   *   actionType: 'interruption',
   *   outcome: 'executed',
   *   signals: { dismissed: true }
   * });
   */
  async record({ decisionId, userId, actionType, outcome, signals = {}, context = {} }) {
    if (!decisionId) {
      // If there's no decision ID (e.g., Governor was unavailable), skip recording
      return { ok: true };
    }

    try {
      const response = await fetch(`${this.apiUrl}${this.prefix}/record`, {
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

      return await response.json();
    } catch (error) {
      console.error('Governor record error:', error);
      return { ok: false, error: error.message };
    }
  }
}

// ============================================================================
// Example Use Cases
// ============================================================================

/**
 * Example 1: Upgrade Modal with Governor Protection
 */
async function showProtectedUpgradeModal(userId) {
  const governor = new GovernorClient();

  console.log(`💬 Checking if we can show upgrade modal to ${userId}...`);

  const decision = await governor.check({
    userId,
    actionType: 'interruption',
    surface: 'in-app',
    context: {
      feature: 'upgrade_modal',
      trigger: 'feature_limit_reached'
    }
  });

  console.log(`Decision: ${decision.allowed ? '✅ ALLOWED' : '❌ BLOCKED'}`);
  console.log(`Reason: ${decision.reason}`);

  if (decision.allowed) {
    // Show the modal
    const modal = document.createElement('div');
    modal.className = 'governor-modal';
    modal.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-content">
          <h2>Upgrade to Pro</h2>
          <p>Unlock unlimited features!</p>
          <button onclick="this.closest('.governor-modal').remove()">
            Maybe Later
          </button>
          <button onclick="window.location='/upgrade'">
            Upgrade Now
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Track if user dismissed
    const dismissBtn = modal.querySelector('button:first-of-type');
    dismissBtn.addEventListener('click', async () => {
      await governor.record({
        decisionId: decision.decisionId,
        userId,
        actionType: 'interruption',
        outcome: 'executed',
        signals: { dismissed: true },
        context: { modalShown: true, userUpgraded: false }
      });
    });

    console.log('✅ Modal shown');
  } else {
    // Respect Governor's decision - don't show the modal
    console.log('Modal blocked - showing subtle banner instead');
    
    // Maybe show a non-intrusive banner instead
    showBanner('Upgrade to unlock more features');

    await governor.record({
      decisionId: decision.decisionId,
      userId,
      actionType: 'interruption',
      outcome: 'blocked'
    });
  }
}

/**
 * Example 2: Limited-Time Offer Banner
 */
async function showLimitedTimeOffer(userId, discountPercent) {
  const governor = new GovernorClient();

  console.log(`🎁 Checking if we can show ${discountPercent}% offer to ${userId}...`);

  const decision = await governor.check({
    userId,
    actionType: 'discount',
    surface: 'in-app',
    context: {
      discountPercent,
      campaign: 'flash_sale'
    }
  });

  if (decision.allowed) {
    // Show the offer
    const banner = document.createElement('div');
    banner.className = 'offer-banner';
    banner.innerHTML = `
      <div class="banner-content">
        <span>🎉 ${discountPercent}% OFF - Limited Time!</span>
        <button onclick="this.closest('.offer-banner').remove()">×</button>
      </div>
    `;
    document.body.appendChild(banner);

    // Track dismissal
    const closeBtn = banner.querySelector('button');
    closeBtn.addEventListener('click', async () => {
      await governor.record({
        decisionId: decision.decisionId,
        userId,
        actionType: 'discount',
        outcome: 'executed',
        signals: { dismissed: true }
      });
    });

    console.log('✅ Offer banner shown');
  } else {
    console.log('❌ Offer blocked - user has seen too many discounts');
    
    await governor.record({
      decisionId: decision.decisionId,
      userId,
      actionType: 'discount',
      outcome: 'blocked'
    });
  }
}

/**
 * Example 3: Feature Announcement Popup
 */
async function announceNewFeature(userId, featureName) {
  const governor = new GovernorClient();

  console.log(`📢 Checking if we can announce "${featureName}" to ${userId}...`);

  const decision = await governor.check({
    userId,
    actionType: 'interruption',
    surface: 'in-app',
    context: {
      feature: 'announcement',
      featureName
    }
  });

  if (decision.allowed) {
    // Show announcement
    const popup = document.createElement('div');
    popup.className = 'feature-announcement';
    popup.innerHTML = `
      <div class="announcement-content">
        <h3>🎉 New Feature: ${featureName}</h3>
        <p>Check it out now!</p>
        <button onclick="this.closest('.feature-announcement').remove()">
          Got it
        </button>
      </div>
    `;
    document.body.appendChild(popup);

    popup.querySelector('button').addEventListener('click', async () => {
      await governor.record({
        decisionId: decision.decisionId,
        userId,
        actionType: 'interruption',
        outcome: 'executed',
        signals: { dismissed: true }
      });
    });

    console.log('✅ Announcement shown');
  } else {
    console.log('❌ Announcement blocked - user needs a break from popups');
    
    // Fall back to a less intrusive notification
    console.log('Showing notification badge instead');
    
    await governor.record({
      decisionId: decision.decisionId,
      userId,
      actionType: 'interruption',
      outcome: 'blocked'
    });
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

function showBanner(message) {
  const banner = document.createElement('div');
  banner.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #f3f4f6;
    border: 1px solid #e5e7eb;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    z-index: 9999;
  `;
  banner.textContent = message;
  document.body.appendChild(banner);

  setTimeout(() => banner.remove(), 5000);
}

// ============================================================================
// Auto-run Examples (for demo purposes)
// ============================================================================

// Uncomment to run examples when page loads:
/*
window.addEventListener('DOMContentLoaded', async () => {
  const userId = 'demo_user_' + Math.random().toString(36).substr(2, 9);
  
  // Example 1: Show upgrade modal
  await showProtectedUpgradeModal(userId);
  
  // Wait a bit, then try to show an offer
  setTimeout(async () => {
    await showLimitedTimeOffer(userId, 20);
  }, 2000);
  
  // Try to show another modal - should be blocked by stacking protection
  setTimeout(async () => {
    await announceNewFeature(userId, 'Dark Mode');
  }, 3000);
});
*/

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GovernorClient };
}
