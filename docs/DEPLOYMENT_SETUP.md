# VTT Deployment Setup Guide

This guide walks you through setting up the deployment pipeline for the VTT project.

## GitHub Repository Configuration

### Step 1: Repository Secrets

Navigate to your GitHub repository: `Settings` → `Secrets and variables` → `Actions` → `Secrets`

Add these secrets one by one:

#### AWS Deployment Secrets

```bash
# Required for AWS deployments
AWS_ACCESS_KEY_ID=AKIA...            # Your AWS access key
AWS_SECRET_ACCESS_KEY=wJalrXUt...    # Your AWS secret key
AWS_ACCOUNT_ID=123456789012          # Your 12-digit AWS account ID
TERRAFORM_STATE_BUCKET=vtt-terraform-state  # S3 bucket for Terraform state
```

#### Security & SSL

```bash
# Optional - for HTTPS and security
ACM_CERTIFICATE_ID=arn:aws:acm:us-east-1:123456789012:certificate/abc123...
WAF_WEB_ACL_ID=arn:aws:wafv2:us-east-1:123456789012:global/webacl/vtt-waf/abc123...
```

#### Notifications

```bash
# Optional - for Slack notifications
SLACK_WEBHOOK=https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX
```

### Step 2: Repository Variables

Navigate to: `Settings` → `Secrets and variables` → `Actions` → `Variables`

Add these variables:

```bash
PROD_CLIENT_DOMAIN=vtt.yourdomain.com      # Your production client domain
PROD_API_DOMAIN=api.vtt.yourdomain.com     # Your production API domain
```

## AWS Prerequisites

Before deployment, you need these AWS resources:

### 1. AWS Account Setup

- AWS account with deployment permissions
- IAM user with programmatic access
- Appropriate IAM policies attached

### 2. S3 Bucket for Terraform State

```bash
aws s3 mb s3://vtt-terraform-state
aws s3api put-bucket-versioning --bucket vtt-terraform-state --versioning-configuration Status=Enabled
```

### 3. EKS Clusters (if using Kubernetes)

- `vtt-staging` - Staging environment cluster
- `vtt-production` - Production environment cluster

### 4. ACM Certificate (for HTTPS)

```bash
aws acm request-certificate \
  --domain-name "*.yourdomain.com" \
  --validation-method DNS \
  --region us-east-1
```

## Deployment Workflow Behavior

The workflow will:

✅ **Always run**: Build, test, security scan
⚠️ **Skip if missing secrets**: AWS deployment steps
⚠️ **Skip if missing secrets**: Terraform infrastructure steps  
⚠️ **Skip if missing secrets**: Slack notifications

## Manual Setup Steps

1. **Create AWS Resources** (using AWS CLI or Console)
2. **Add GitHub Secrets** (copy from this guide)
3. **Update Domain Variables** (replace yourdomain.com)
4. **Test Deployment** (push to main branch)

## Quick Start (Minimal Setup)

To get started without full AWS setup:

1. Skip AWS secrets initially
2. The workflow will build and test code
3. Add AWS secrets later when ready to deploy

## Security Notes

- Never commit secrets to code
- Use environment-specific secrets for staging vs production
- Regularly rotate AWS credentials
- Use least-privilege IAM policies

## Need Help?

- Check GitHub Actions logs for specific errors
- Verify AWS permissions if deployment fails
- Test AWS CLI access locally first
