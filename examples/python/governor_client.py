"""
Governor Python Integration Example

This example shows how to integrate Governor into a Python application
to control escalation pressure across different channels.
"""

import os
import requests
from typing import Dict, Optional, Any


class GovernorClient:
    """Client for interacting with the Governor API"""
    
    def __init__(self, api_url: Optional[str] = None):
        """
        Initialize Governor client
        
        Args:
            api_url: Governor API URL (defaults to env var or production URL)
        """
        self.api_url = (api_url or os.getenv(
            'GOVERNOR_API_URL',
            'http://localhost:3000'
        )).rstrip('/')
        host = self.api_url.split('://', 1)[-1].split('/', 1)[0]
        self.prefix = '/v1' if host.startswith('localhost') or host.startswith('127.0.0.1') else '/api'
    
    def check(
        self,
        user_id: str,
        action_type: str,
        surface: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Check if escalation is allowed for a user
        
        Args:
            user_id: Unique user identifier
            action_type: Type of escalation (urgency|discount|interruption|reminder)
            surface: Where the escalation will appear (email|sms|push|in-app)
            context: Additional context
            
        Returns:
            Decision object with allowed, reason, decisionId
            
        Example:
            >>> governor = GovernorClient()
            >>> decision = governor.check(
            ...     user_id='user_123',
            ...     action_type='urgency',
            ...     surface='email'
            ... )
            >>> if decision['allowed']:
            ...     send_email(user_id)
        """
        payload = {
            'userId': user_id,
            'actionType': action_type,
        }
        
        if surface:
            payload['surface'] = surface
        if context:
            payload['context'] = context
            
        response = requests.post(
            f'{self.api_url}{self.prefix}/check',
            json=payload,
            headers={'Content-Type': 'application/json'}
        )
        response.raise_for_status()
        return response.json()
    
    def record(
        self,
        decision_id: str,
        user_id: str,
        action_type: str,
        outcome: str,
        signals: Optional[Dict[str, bool]] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Record the outcome of an escalation attempt
        
        Args:
            decision_id: Decision ID from check()
            user_id: User identifier
            action_type: Type of escalation
            outcome: What happened (executed|downgraded|blocked)
            signals: User response signals
                - dismissed: User dismissed the message
                - ignored: User ignored the message
                - hesitated: User hesitated before acting
            context: Additional context
            
        Returns:
            Result with ok status
            
        Example:
            >>> governor.record(
            ...     decision_id=decision['decisionId'],
            ...     user_id='user_123',
            ...     action_type='urgency',
            ...     outcome='executed',
            ...     signals={'dismissed': False}
            ... )
        """
        payload = {
            'decisionId': decision_id,
            'userId': user_id,
            'actionType': action_type,
            'outcome': outcome
        }
        
        if signals:
            payload['signals'] = signals
        if context:
            payload['context'] = context
            
        response = requests.post(
            f'{self.api_url}{self.prefix}/record',
            json=payload,
            headers={'Content-Type': 'application/json'}
        )
        response.raise_for_status()
        return response.json()


# ============================================================================
# Example Use Cases
# ============================================================================

def send_marketing_email(user_id: str, email_type: str):
    """
    Example 1: Email Marketing Campaign
    Check before sending an urgent email
    """
    governor = GovernorClient()
    
    print(f"\n📧 Attempting to send {email_type} email to user {user_id}")
    
    # Check with Governor first
    action_type = 'urgency' if email_type == 'urgent' else 'reminder'
    decision = governor.check(
        user_id=user_id,
        action_type=action_type,
        surface='email',
        context={
            'campaign': 'holiday_sale_2026',
            'emailType': email_type
        }
    )
    
    print(f"   Decision: {'✅ ALLOWED' if decision['allowed'] else '❌ BLOCKED'}")
    print(f"   Reason: {decision['reason']}")
    
    if decision['allowed']:
        # Send the email
        print(f"   Sending {email_type} email...")
        send_email(user_id, email_type)  # Your email sending logic
        
        # Record that it was executed
        governor.record(
            decision_id=decision['decisionId'],
            user_id=user_id,
            action_type=action_type,
            outcome='executed',
            context={
                'emailId': 'email_12345',
                'sent': True
            }
        )
        print("   ✅ Email sent and recorded")
    else:
        # Respect Governor's decision
        if decision.get('suggestedActionType'):
            print(f"   💡 Suggestion: Try \"{decision['suggestedActionType']}\" instead")
        
        # Record that it was blocked
        governor.record(
            decision_id=decision['decisionId'],
            user_id=user_id,
            action_type=action_type,
            outcome='blocked'
        )


def show_upgrade_modal(user_id: str):
    """
    Example 2: In-App Upgrade Modal
    Check before showing an interruption
    """
    governor = GovernorClient()
    
    print(f"\n💬 Attempting to show upgrade modal to user {user_id}")
    
    decision = governor.check(
        user_id=user_id,
        action_type='interruption',
        surface='in-app',
        context={
            'feature': 'upgrade_modal',
            'trigger': 'feature_limit_reached'
        }
    )
    
    print(f"   Decision: {'✅ ALLOWED' if decision['allowed'] else '❌ BLOCKED'}")
    print(f"   Reason: {decision['reason']}")
    
    if decision['allowed']:
        # Show the modal
        print("   Displaying modal...")
        user_dismissed = display_modal(user_id)  # Your modal logic
        
        # Record the outcome with user signals
        governor.record(
            decision_id=decision['decisionId'],
            user_id=user_id,
            action_type='interruption',
            outcome='executed',
            signals={'dismissed': user_dismissed},
            context={
                'modalShown': True,
                'userUpgraded': False
            }
        )
        print("   ✅ Modal shown and outcome recorded")
    else:
        # Don't show the modal
        print("   Modal blocked - user needs a break")
        governor.record(
            decision_id=decision['decisionId'],
            user_id=user_id,
            action_type='interruption',
            outcome='blocked'
        )


def send_discount_sms(user_id: str, discount_amount: int):
    """
    Example 3: SMS Campaign
    Check before sending SMS with discount
    """
    governor = GovernorClient()
    
    print(f"\n💬 Attempting to send {discount_amount}% discount SMS to user {user_id}")
    
    decision = governor.check(
        user_id=user_id,
        action_type='discount',
        surface='sms',
        context={
            'discountPercent': discount_amount,
            'campaign': 'flash_sale'
        }
    )
    
    print(f"   Decision: {'✅ ALLOWED' if decision['allowed'] else '❌ BLOCKED'}")
    print(f"   Reason: {decision['reason']}")
    
    if decision['allowed']:
        print("   Sending SMS...")
        send_sms(user_id, f"Get {discount_amount}% off now!")  # Your SMS logic
        
        governor.record(
            decision_id=decision['decisionId'],
            user_id=user_id,
            action_type='discount',
            outcome='executed',
            context={'smsDelivered': True}
        )
        print("   ✅ SMS sent")
    else:
        # Downgrade to a reminder without discount urgency
        if decision.get('suggestedActionType') == 'reminder':
            print("   Downgrading to gentle reminder...")
            send_sms(user_id, "Our sale is still on!")  # Softer message
            
            governor.record(
                decision_id=decision['decisionId'],
                user_id=user_id,
                action_type='discount',
                outcome='downgraded',
                context={'downgraded_to': 'reminder'}
            )
            print("   ✅ Sent downgraded message")
        else:
            governor.record(
                decision_id=decision['decisionId'],
                user_id=user_id,
                action_type='discount',
                outcome='blocked'
            )


# ============================================================================
# Mock Functions (Replace with your actual implementation)
# ============================================================================

def send_email(user_id: str, email_type: str):
    """Replace with your email sending logic (SendGrid, AWS SES, etc.)"""
    pass


def display_modal(user_id: str) -> bool:
    """
    Replace with your modal display logic
    Returns True if user dismissed, False if they took action
    """
    import random
    return random.choice([True, False])  # Simulated


def send_sms(user_id: str, message: str):
    """Replace with your SMS sending logic (Twilio, etc.)"""
    pass


# ============================================================================
# Run Examples
# ============================================================================

def run_examples():
    """Run all integration examples"""
    print('=' * 60)
    print('Governor Python Integration Examples')
    print('=' * 60)
    
    try:
        # Example 1: Send urgent email
        send_marketing_email('user_001', 'urgent')
        
        # Try again immediately - should be blocked by cooldown
        send_marketing_email('user_001', 'urgent')
        
        # Example 2: Show upgrade modal
        show_upgrade_modal('user_002')
        
        # Example 3: Send discount SMS
        send_discount_sms('user_003', 20)
        
        print('\n' + '=' * 60)
        print('✅ Examples completed successfully!')
        print('=' * 60)
        print('\nCheck your Supabase dashboard to see logged events:')
        print('https://supabase.com/dashboard/project/xutgikcqbjdubwveidir/editor')
        
    except requests.exceptions.RequestException as e:
        print(f'\n❌ Error: {e}')
        print('\nMake sure:')
        print('1. Governor API is deployed and accessible')
        print('2. Environment variables are set in Vercel')
        print('3. Database migration has been run')


if __name__ == '__main__':
    run_examples()
