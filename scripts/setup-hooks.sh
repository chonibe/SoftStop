#!/bin/bash
#
# Setup Governor Git Hooks
# 
# Installs local git hooks to enforce tenets

echo "Setting up Governor git hooks..."

# Copy pre-push hook
cp .git/hooks/pre-push.sample .git/hooks/pre-push 2>/dev/null || true
cat > .git/hooks/pre-push << 'EOF'
#!/bin/sh
#
# Governor Pre-Push Hook v1.0
# 
# Enforces Governor tenets before allowing push.

echo "🛡️  Governor Pre-Push Check"
echo "=========================="

while read local_ref local_sha remote_ref remote_sha
do
  if [ "$remote_ref" = "refs/heads/main" ] || [ "$remote_ref" = "refs/heads/master" ]; then
    echo ""
    echo "⚠️  Attempting to push directly to main branch"
    
    if [ "$remote_sha" = "0000000000000000000000000000000000000000" ]; then
      CHANGED_FILES=$(git diff --name-only origin/main...HEAD 2>/dev/null || git diff --name-only HEAD)
    else
      CHANGED_FILES=$(git diff --name-only "$remote_sha".."$local_sha")
    fi
    
    CORE_CHANGED=$(echo "$CHANGED_FILES" | grep -E '^(governor/(api/src|core)|packages/(api|core))/' || true)
    
    if [ -n "$CORE_CHANGED" ]; then
      echo "❌ BLOCKED: Core files changed"
      echo ""
      echo "$CORE_CHANGED"
      echo ""
      echo "Core changes MUST go through PR process."
      echo "Create a branch and PR instead."
      echo ""
      exit 1
    fi
    
    for file in $CHANGED_FILES; do
      if [ -f "$file" ]; then
        VIOLATIONS=$(grep -n "from.*resend\|from.*sendgrid\|from.*twilio" "$file" 2>/dev/null || true)
        if [ -n "$VIOLATIONS" ]; then
          echo "❌ TENET VIOLATION: Execution imports detected in $file"
          exit 1
        fi
      fi
    done
  fi
done

echo "✅ Pre-push check passed"
exit 0
EOF

chmod +x .git/hooks/pre-push

echo "✅ Git hooks installed"
echo ""
echo "The pre-push hook will:"
echo "  - Block direct pushes to main with Core changes"
echo "  - Check for tenet violations"
echo "  - Enforce PR workflow for Core changes"
