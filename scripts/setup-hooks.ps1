# Setup Governor Git Hooks (PowerShell)
# 
# Installs local git hooks to enforce tenets

Write-Host "Setting up Governor git hooks..." -ForegroundColor Cyan

$hookContent = @'
#!/bin/sh
# Governor Pre-Push Hook v1.0

echo "🛡️  Governor Pre-Push Check"
echo "=========================="

while read local_ref local_sha remote_ref remote_sha
do
  if [ "$remote_ref" = "refs/heads/main" ] || [ "$remote_ref" = "refs/heads/master" ]; then
    if [ "$remote_sha" = "0000000000000000000000000000000000000000" ]; then
      CHANGED_FILES=$(git diff --name-only origin/main...HEAD 2>/dev/null || git diff --name-only HEAD)
    else
      CHANGED_FILES=$(git diff --name-only "$remote_sha".."$local_sha")
    fi
    
    CORE_CHANGED=$(echo "$CHANGED_FILES" | grep -E '^(governor/(api/src|core)|packages/(api|core))/' || true)
    
    if [ -n "$CORE_CHANGED" ]; then
      echo "❌ BLOCKED: Core files changed - use PR workflow"
      echo "$CORE_CHANGED"
      exit 1
    fi
    
    for file in $CHANGED_FILES; do
      if [ -f "$file" ]; then
        VIOLATIONS=$(grep -n "from.*resend\|from.*sendgrid\|from.*twilio" "$file" 2>/dev/null || true)
        if [ -n "$VIOLATIONS" ]; then
          echo "❌ TENET VIOLATION: Execution imports in $file"
          exit 1
        fi
      fi
    done
  fi
done

echo "✅ Pre-push check passed"
exit 0
'@

$hookPath = ".git\hooks\pre-push"
$hookContent | Out-File -FilePath $hookPath -Encoding UTF8 -NoNewline

Write-Host "✅ Git hooks installed" -ForegroundColor Green
Write-Host ""
Write-Host "The pre-push hook will:" -ForegroundColor Yellow
Write-Host "  - Block direct pushes to main with Core changes"
Write-Host "  - Check for tenet violations"
Write-Host "  - Enforce PR workflow for Core changes"
