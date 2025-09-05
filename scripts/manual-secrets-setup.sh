#!/bin/bash

# Manual GitHub Secrets Setup Commands
# Run these after authenticating with: gh auth login

echo "🔐 Manual GitHub Secrets Setup Commands"
echo "========================================"
echo ""

echo "First, authenticate with GitHub:"
echo "gh auth login"
echo ""

echo "Then run these commands to create the secrets:"
echo ""

echo "# 1. Kubernetes Staging Config (base64 encoded)"
echo 'echo "YXBpVmVyc2lvbjogdjEKa2luZDogQ29uZmlnCmNsdXN0ZXJzOgotIGNsdXN0ZXI6CiAgICBjZXJ0aWZpY2F0ZS1hdXRob3JpdHktZGF0YTogTFMwdExTMUNSVWRKVGlCRFJWSlVTVVpKUTBGVVJTMHRMUzB0Li4uICAjIFlvdXIgY2x1c3RlciBDQSBjZXJ0aWZpY2F0ZQogICAgc2VydmVyOiBodHRwczovL3lvdXItazhzLWNsdXN0ZXItc3RhZ2luZy5leGFtcGxlLmNvbQogIG5hbWU6IHZ0dC1zdGFnaW5nCmNvbnRleHRzOgotIGNvbnRleHQ6CiAgICBjbHVzdGVyOiB2dHQtc3RhZ2luZwogICAgbmFtZXNwYWNlOiB2dHQtc3RhZ2luZwogICAgdXNlcjogdnR0LWRlcGxveWVyCiAgbmFtZTogdnR0LXN0YWdpbmcKY3VycmVudC1jb250ZXh0OiB2dHQtc3RhZ2luZwp1c2VyczoKLSBuYW1lOiB2dHQtZGVwbG95ZXIKICB1c2VyOgogICAgdG9rZW46IGV5SmhiR2NpT2lKU1V6STFOaUlzSW10cFpDSTZJaTV1YVNJOUxpNHVJZzQuLi4gICMgWW91ciBzZXJ2aWNlIGFjY291bnQgdG9rZW4K" | gh secret set KUBE_CONFIG_STAGING'
echo ""

echo "# 2. Kubernetes Production Config (base64 encoded)"
echo 'echo "YXBpVmVyc2lvbjogdjEKa2luZDogQ29uZmlnCmNsdXN0ZXJzOgotIGNsdXN0ZXI6CiAgICBjZXJ0aWZpY2F0ZS1hdXRob3JpdHktZGF0YTogTFMwdExTMUNSVWRKVGlCRFJWSlVTVVpKUTBGVVJTMHRMUzB0Li4uICAjIFlvdXIgY2x1c3RlciBDQSBjZXJ0aWZpY2F0ZQogICAgc2VydmVyOiBodHRwczovL3lvdXItazhzLWNsdXN0ZXItcHJvZHVjdGlvbi5leGFtcGxlLmNvbQogIG5hbWU6IHZ0dC1wcm9kdWN0aW9uCmNvbnRleHRzOgotIGNvbnRleHQ6CiAgICBjbHVzdGVyOiB2dHQtcHJvZHVjdGlvbgogICAgbmFtZXNwYWNlOiB2dHQtcHJvZHVjdGlvbgogICAgdXNlcjogdnR0LWRlcGxveWVyCiAgbmFtZTogdnR0LXByb2R1Y3Rpb24KY3VycmVudC1jb250ZXh0OiB2dHQtcHJvZHVjdGlvbgp1c2VyczoKLSBuYW1lOiB2dHQtZGVwbG95ZXIKICB1c2VyOgogICAgdG9rZW46IGV5SmhiR2NpT2lKU1V6STFOaUlzSW10cFpDSTZJaTV1YVNJOUxpNHVJZzQuLi4gICMgWW91ciBzZXJ2aWNlIGFjY291bnQgdG9rZW4K" | gh secret set KUBE_CONFIG_PRODUCTION'
echo ""

echo "# 3. Slack Webhook URL"
echo 'echo "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX" | gh secret set SLACK_WEBHOOK'
echo ""

echo "# 4. Grafana Webhook URL"  
echo 'echo "https://your-grafana-instance.com/api/annotations" | gh secret set GRAFANA_WEBHOOK'
echo ""

echo "# 5. Deployment Tracking URL"
echo 'echo "https://your-deployment-tracker.com/api/deployments" | gh secret set DEPLOYMENT_TRACKING_URL'
echo ""

echo "# Verify all secrets were created:"
echo "gh secret list"
echo ""

echo "📝 Remember to update the placeholder values with your actual:"
echo "- Kubernetes cluster endpoints and certificates"
echo "- Service account tokens"  
echo "- Slack webhook URL from your workspace"
echo "- Grafana instance API endpoint"
echo "- Your deployment tracking system URL"
