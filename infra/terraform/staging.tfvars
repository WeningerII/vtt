# Staging environment configuration
environment = "staging"
aws_region  = "us-east-1"

# VPC Configuration
vpc_cidr             = "10.1.0.0/16"
public_subnet_cidrs  = ["10.1.1.0/24", "10.1.2.0/24", "10.1.3.0/24"]
private_subnet_cidrs = ["10.1.10.0/24", "10.1.20.0/24", "10.1.30.0/24"]

# EKS Configuration
kubernetes_version                     = "1.28"
cluster_endpoint_public_access_cidrs  = ["0.0.0.0/0"]
node_group_instance_types             = ["t3.medium"]
node_group_desired_capacity           = 2
node_group_max_capacity              = 6
node_group_min_capacity              = 1

# RDS Configuration
postgres_version              = "15.4"
postgres_instance_class       = "db.t3.small"
postgres_allocated_storage    = 20
postgres_max_allocated_storage = 100
postgres_database_name        = "vtt_platform_staging"
postgres_username            = "vtt_admin"
# postgres_password is set via environment variable

# Redis Configuration
redis_node_type         = "cache.t3.micro"
redis_num_cache_nodes  = 1
# redis_auth_token is set via environment variable

# Application Configuration
domain_name = "staging.vtt.platform.com"
# certificate_arn is set via environment variable

# Monitoring and Logging
enable_monitoring      = true
log_retention_days     = 14
backup_retention_days  = 7
enable_point_in_time_recovery = false

# Security
enable_waf = false
allowed_cidr_blocks = ["0.0.0.0/0"]

# Cost Optimization
enable_spot_instances      = true
enable_cluster_autoscaler = true
