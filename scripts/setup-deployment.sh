#!/bin/bash
set -e

# VTT Deployment Setup Script
# This script helps you set up AWS resources and GitHub secrets

echo "🚀 VTT Deployment Setup"
echo "======================"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not installed. Please install it first:"
    echo "   https://docs.aws.amazon.com/cli/latest/userguide/install-cliv2.html"
    exit 1
fi

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "⚠️  GitHub CLI not installed. You'll need to add secrets manually."
    echo "   Install: https://cli.github.com/"
    GITHUB_CLI=false
else
    GITHUB_CLI=true
fi

echo
echo "📋 Prerequisites Checklist:"
echo "  ✓ AWS CLI installed"
echo "  ✓ AWS credentials configured"
if [ "$GITHUB_CLI" = true ]; then
    echo "  ✓ GitHub CLI installed"
else
    echo "  ⚠️  GitHub CLI not installed (manual setup required)"
fi

# Get user inputs
echo
echo "🔧 Configuration Setup"
read -p "Enter your AWS Account ID (12 digits): " AWS_ACCOUNT_ID
read -p "Enter your domain (e.g., yourdomain.com): " DOMAIN
read -p "Enter S3 bucket name for Terraform state: " TERRAFORM_BUCKET

# Validate inputs
if [[ ! $AWS_ACCOUNT_ID =~ ^[0-9]{12}$ ]]; then
    echo "❌ Invalid AWS Account ID format"
    exit 1
fi

if [[ -z "$DOMAIN" ]]; then
    echo "❌ Domain is required"
    exit 1
fi

if [[ -z "$TERRAFORM_BUCKET" ]]; then
    echo "❌ Terraform bucket name is required"
    exit 1
fi

# Create S3 bucket for Terraform state
echo
echo "📦 Creating S3 bucket for Terraform state..."
if aws s3 ls "s3://$TERRAFORM_BUCKET" 2>&1 | grep -q 'NoSuchBucket'; then
    aws s3 mb "s3://$TERRAFORM_BUCKET"
    aws s3api put-bucket-versioning --bucket "$TERRAFORM_BUCKET" --versioning-configuration Status=Enabled
    echo "✅ Created S3 bucket: $TERRAFORM_BUCKET"
else
    echo "ℹ️  S3 bucket already exists: $TERRAFORM_BUCKET"
fi

# Request ACM certificate
echo
echo "🔒 Requesting SSL certificate..."
CERT_ARN=$(aws acm request-certificate \
    --domain-name "*.$DOMAIN" \
    --validation-method DNS \
    --region us-east-1 \
    --query 'CertificateArn' \
    --output text)
echo "✅ Certificate requested: $CERT_ARN"
echo "⚠️  Don't forget to validate the certificate in AWS Console!"

# Generate GitHub secrets
echo
echo "🔑 GitHub Secrets to Add:"
echo "========================"
echo "AWS_ACCOUNT_ID=$AWS_ACCOUNT_ID"
echo "TERRAFORM_STATE_BUCKET=$TERRAFORM_BUCKET"
echo "ACM_CERTIFICATE_ID=$CERT_ARN"
echo
echo "📝 GitHub Variables to Add:"
echo "==========================="
echo "PROD_CLIENT_DOMAIN=vtt.$DOMAIN"
echo "PROD_API_DOMAIN=api.vtt.$DOMAIN"

# Add secrets via GitHub CLI if available
if [ "$GITHUB_CLI" = true ]; then
    echo
    read -p "Do you want to add these secrets to GitHub now? (y/n): " ADD_SECRETS
    if [[ $ADD_SECRETS =~ ^[Yy]$ ]]; then
        echo "Adding secrets to GitHub..."
        gh secret set AWS_ACCOUNT_ID --body "$AWS_ACCOUNT_ID"
        gh secret set TERRAFORM_STATE_BUCKET --body "$TERRAFORM_BUCKET"
        gh secret set ACM_CERTIFICATE_ID --body "$CERT_ARN"
        gh variable set PROD_CLIENT_DOMAIN --body "vtt.$DOMAIN"
        gh variable set PROD_API_DOMAIN --body "api.vtt.$DOMAIN"
        echo "✅ Secrets added to GitHub!"
    fi
fi

echo
echo "🎉 Setup Complete!"
echo
echo "📋 Next Steps:"
echo "1. Add your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to GitHub secrets"
echo "2. Validate your SSL certificate in AWS Console"
echo "3. Set up EKS clusters (vtt-staging and vtt-production)"
echo "4. Optional: Add SLACK_WEBHOOK for notifications"
echo "5. Push to main branch to trigger deployment"
echo
echo "📖 See docs/DEPLOYMENT_SETUP.md for detailed instructions"
