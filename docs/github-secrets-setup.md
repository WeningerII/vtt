# GitHub Secrets Setup Guide

This guide explains how to set up the required GitHub repository secrets for the VTT platform's CI/CD pipeline.

## Required Secrets

The production deployment workflow requires these secrets:

| Secret Name | Purpose | Example Value |
|-------------|---------|---------------|
| `KUBE_CONFIG_STAGING` | Base64-encoded Kubernetes config for staging | `YXBpVmVyc2lvbjogdjEK...` |
| `KUBE_CONFIG_PRODUCTION` | Base64-encoded Kubernetes config for production | `YXBpVmVyc2lvbjogdjEK...` |
| `SLACK_WEBHOOK` | Slack webhook URL for deployment notifications | `https://hooks.slack.com/services/...` |
| `GRAFANA_WEBHOOK` | Grafana API endpoint for dashboard updates | `https://grafana.example.com/api/annotations` |
| `DEPLOYMENT_TRACKING_URL` | Custom deployment tracking endpoint | `https://tracker.example.com/api/deployments` |

## Quick Setup

Run the automated setup script:

```bash
./scripts/setup-github-secrets.sh
```

This script will:
1. Check GitHub CLI authentication
2. Create template kubeconfig files 
3. Add all required secrets with placeholder values
4. Provide next steps for customization

## Manual Setup

### 1. Kubernetes Configuration Secrets

Create service account tokens for your clusters:

```bash
# For staging cluster
kubectl create serviceaccount vtt-deployer -n vtt-staging
kubectl create clusterrolebinding vtt-deployer --clusterrole=cluster-admin --serviceaccount=vtt-staging:vtt-deployer

# Get the token (Kubernetes 1.24+)
kubectl create token vtt-deployer -n vtt-staging --duration=8760h

# For production cluster  
kubectl create serviceaccount vtt-deployer -n vtt-production
kubectl create clusterrolebinding vtt-deployer --clusterrole=cluster-admin --serviceaccount=vtt-production:vtt-deployer
kubectl create token vtt-deployer -n vtt-production --duration=8760h
```

Create kubeconfig files and encode them:

```bash
# Create kubeconfig file with your cluster details
# Then encode it
base64 -w 0 kubeconfig-staging.yaml | gh secret set KUBE_CONFIG_STAGING
base64 -w 0 kubeconfig-production.yaml | gh secret set KUBE_CONFIG_PRODUCTION
```

### 2. Slack Webhook

1. Go to your Slack workspace → **Apps** → **Incoming Webhooks**
2. Create webhook for `#deployments` channel
3. Copy the webhook URL

```bash
gh secret set SLACK_WEBHOOK
# Paste: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

### 3. Grafana Webhook

Set up Grafana API access:

```bash
# Using Grafana API endpoint
gh secret set GRAFANA_WEBHOOK
# Paste: https://your-grafana.com/api/annotations
```

### 4. Deployment Tracking

Configure your deployment tracking endpoint:

```bash
gh secret set DEPLOYMENT_TRACKING_URL  
# Paste: https://your-tracker.com/api/deployments
```

## Security Best Practices

- **Rotate tokens regularly** (every 90 days recommended)
- **Use least privilege access** for service accounts
- **Enable audit logging** for secret access
- **Monitor webhook usage** for suspicious activity
- **Use environment-specific namespaces** in Kubernetes

## Troubleshooting

### Common Issues

**Secret not found errors:**
```bash
# List all secrets
gh secret list

# Check specific secret
gh secret set SECRET_NAME --body "new-value"
```

**Kubernetes authentication failures:**
- Verify service account exists: `kubectl get sa vtt-deployer -n vtt-staging`
- Check token expiry: `kubectl describe secret $(kubectl get sa vtt-deployer -n vtt-staging -o jsonpath='{.secrets[0].name}') -n vtt-staging`
- Validate kubeconfig: `kubectl --kubeconfig=test-config.yaml get pods`

**Webhook failures:**
- Test Slack webhook: `curl -X POST -H 'Content-type: application/json' --data '{"text":"Test"}' YOUR_WEBHOOK_URL`
- Verify Grafana endpoint: `curl -H "Authorization: Bearer TOKEN" https://grafana.com/api/health`

## Updating Secrets

### Via GitHub CLI
```bash
# Update individual secrets
gh secret set KUBE_CONFIG_STAGING < new-kubeconfig.yaml
gh secret set SLACK_WEBHOOK --body "new-webhook-url"
```

### Via GitHub Web Interface
1. Go to repository **Settings** → **Secrets and variables** → **Actions**
2. Click **Update** next to the secret name
3. Enter new value and **Save**

## Monitoring

Monitor secret usage in GitHub Actions:
- Check workflow run logs for authentication errors
- Review failed deployments for secret-related issues
- Set up alerts for deployment pipeline failures

## Backup & Recovery

Keep secure backups of:
- Kubeconfig files (encrypted)
- Service account creation commands
- Webhook URLs and credentials
- Documentation of secret rotation procedures
