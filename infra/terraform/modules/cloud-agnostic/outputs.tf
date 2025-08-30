# Cloud-agnostic infrastructure outputs
output "vpc_id" {
  description = "VPC/Virtual Network ID"
  value       = module.networking.vpc_id
}

output "vpc_cidr" {
  description = "VPC CIDR block"
  value       = module.networking.vpc_cidr
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = module.networking.public_subnet_ids
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = module.networking.private_subnet_ids
}

output "cluster_name" {
  description = "Kubernetes cluster name"
  value       = module.kubernetes.cluster_name
}

output "cluster_endpoint" {
  description = "Kubernetes cluster endpoint"
  value       = module.kubernetes.cluster_endpoint
}

output "cluster_certificate_authority" {
  description = "Kubernetes cluster certificate authority"
  value       = module.kubernetes.cluster_certificate_authority
  sensitive   = true
}

output "cluster_oidc_issuer_url" {
  description = "Kubernetes cluster OIDC issuer URL"
  value       = module.kubernetes.cluster_oidc_issuer_url
}

output "node_group_arn" {
  description = "Kubernetes node group ARN/ID"
  value       = module.kubernetes.node_group_arn
}

output "database_endpoint" {
  description = "Database endpoint"
  value       = module.database.database_endpoint
}

output "database_port" {
  description = "Database port"
  value       = module.database.database_port
}

output "database_name" {
  description = "Database name"
  value       = module.database.database_name
}

output "database_username" {
  description = "Database master username"
  value       = module.database.database_username
  sensitive   = true
}

output "cache_endpoint" {
  description = "Cache cluster endpoint"
  value       = module.cache.cache_endpoint
}

output "cache_port" {
  description = "Cache cluster port"
  value       = module.cache.cache_port
}

output "storage_bucket_name" {
  description = "Object storage bucket name"
  value       = module.storage.bucket_name
}

output "storage_bucket_domain" {
  description = "Object storage bucket domain"
  value       = module.storage.bucket_domain
}

output "storage_bucket_arn" {
  description = "Object storage bucket ARN/ID"
  value       = module.storage.bucket_arn
}

output "kms_key_id" {
  description = "KMS/encryption key ID"
  value       = module.security.kms_key_id
}

output "kms_key_arn" {
  description = "KMS/encryption key ARN"
  value       = module.security.kms_key_arn
}

# Conditional outputs
output "monitoring_dashboard_url" {
  description = "Monitoring dashboard URL"
  value       = var.enable_monitoring ? module.monitoring[0].dashboard_url : null
}

output "domain_name" {
  description = "Domain name"
  value       = var.domain_name != "" ? module.dns[0].domain_name : null
}

output "certificate_arn" {
  description = "SSL certificate ARN/ID"
  value       = var.domain_name != "" && var.enable_ssl ? module.dns[0].certificate_arn : null
}

# Cloud provider specific outputs
output "cloud_provider" {
  description = "Cloud provider used"
  value       = var.cloud_provider
}

output "region" {
  description = "Cloud region"
  value       = var.region
}

output "environment" {
  description = "Environment name"
  value       = var.environment
}
