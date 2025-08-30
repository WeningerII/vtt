# Production environment configuration
environment = "production"
aws_region  = "us-east-1"

# VPC Configuration
vpc_cidr             = "10.0.0.0/16"
public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
private_subnet_cidrs = ["10.0.10.0/24", "10.0.20.0/24", "10.0.30.0/24"]

# EKS Configuration
kubernetes_version                     = "1.28"
cluster_endpoint_public_access_cidrs  = ["0.0.0.0/0"]
node_group_instance_types             = ["t3.large", "t3.xlarge"]
node_group_desired_capacity           = 3
node_group_max_capacity              = 20
node_group_min_capacity              = 2

# RDS Configuration
postgres_version              = "15.4"
postgres_instance_class       = "db.r6g.large"
postgres_allocated_storage    = 100
postgres_max_allocated_storage = 1000
postgres_database_name        = "vtt_platform_prod"
postgres_username            = "vtt_admin"
# postgres_password is set via environment variable

# Redis Configuration
redis_node_type         = "cache.r6g.large"
redis_num_cache_nodes  = 3
# redis_auth_token is set via environment variable

# Application Configuration
domain_name = "vtt.platform.com"
# certificate_arn is set via environment variable

# Monitoring and Logging
enable_monitoring      = true
log_retention_days     = 90
backup_retention_days  = 30
enable_point_in_time_recovery = true

# Security
enable_waf = true
allowed_cidr_blocks = ["0.0.0.0/0"]

# Cost Optimization
enable_spot_instances      = false
enable_cluster_autoscaler = true
