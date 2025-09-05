#!/bin/bash

# GitHub Secrets Setup Script for VTT Platform
# This script adds all required secrets to the GitHub repository

set -e

echo "🔐 Setting up GitHub Secrets for VTT Platform..."

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed. Please install it first:"
    echo "   https://cli.github.com/"
    exit 1
fi

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
    echo "❌ Please authenticate with GitHub CLI first:"
    echo "   gh auth login"
    exit 1
fi

echo "✅ GitHub CLI is ready"

# Function to create base64 encoded kubeconfig template
create_kubeconfig_template() {
    local env_name=$1
    cat > /tmp/kubeconfig-${env_name}.yaml << EOF
apiVersion: v1
kind: Config
clusters:
- cluster:
    certificate-authority-data: LS0tLS1CRUdJTiBDRVJUSUZJQ0FURS0tLS0t...  # Your cluster CA certificate
    server: https://your-k8s-cluster-${env_name}.example.com
  name: vtt-${env_name}
contexts:
- context:
    cluster: vtt-${env_name}
    namespace: vtt-${env_name}
    user: vtt-deployer
  name: vtt-${env_name}
current-context: vtt-${env_name}
users:
- name: vtt-deployer
  user:
    token: eyJhbGciOiJSUzI1NiIsImtpZCI6Ii4uLiJ9...  # Your service account token
EOF
    base64 -w 0 /tmp/kubeconfig-${env_name}.yaml
    rm /tmp/kubeconfig-${env_name}.yaml
}

echo ""
echo "📝 Creating Kubernetes configuration secrets..."

# Generate base64 encoded kubeconfig for staging
echo "Creating KUBE_CONFIG_STAGING..."
STAGING_KUBECONFIG=$(create_kubeconfig_template "staging")
echo $STAGING_KUBECONFIG | gh secret set KUBE_CONFIG_STAGING

# Generate base64 encoded kubeconfig for production  
echo "Creating KUBE_CONFIG_PRODUCTION..."
PRODUCTION_KUBECONFIG=$(create_kubeconfig_template "production")
echo $PRODUCTION_KUBECONFIG | gh secret set KUBE_CONFIG_PRODUCTION

echo ""
echo "📡 Creating webhook secrets..."

# Slack webhook for deployment notifications
echo "Creating SLACK_WEBHOOK..."
SLACK_WEBHOOK="https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX"
echo $SLACK_WEBHOOK | gh secret set SLACK_WEBHOOK

# Grafana webhook for monitoring dashboards
echo "Creating GRAFANA_WEBHOOK..."
GRAFANA_WEBHOOK="https://your-grafana-instance.com/api/annotations"
echo $GRAFANA_WEBHOOK | gh secret set GRAFANA_WEBHOOK

# Deployment tracking webhook
echo "Creating DEPLOYMENT_TRACKING_URL..."
DEPLOYMENT_TRACKING_URL="https://your-deployment-tracker.com/api/deployments"
echo $DEPLOYMENT_TRACKING_URL | gh secret set DEPLOYMENT_TRACKING_URL

echo ""
echo "✅ All GitHub secrets have been created!"
echo ""
echo "🔧 Next Steps:"
echo "1. Update the kubeconfig files with your actual cluster details:"
echo "   - Replace certificate-authority-data with your cluster CA"
echo "   - Replace server URLs with your actual cluster endpoints"
echo "   - Replace tokens with actual service account tokens"
echo ""
echo "2. Update webhook URLs:"
echo "   - Get your actual Slack webhook from: https://api.slack.com/messaging/webhooks"
echo "   - Update Grafana webhook with your Grafana instance URL"
echo "   - Set up your deployment tracking endpoint"
echo ""
echo "3. Test the deployment pipeline:"
echo "   gh workflow run production-deployment.yml"
echo ""
echo "📋 To update any secret later:"
echo "   gh secret set SECRET_NAME"
echo "   # Then paste the new value when prompted"
