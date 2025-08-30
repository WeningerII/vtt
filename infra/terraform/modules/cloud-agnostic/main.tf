# Cloud-agnostic infrastructure module
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

# Local values for cloud-specific mappings
locals {
  # Instance type mappings
  instance_types = {
    aws = {
      small  = "t3.small"
      medium = "t3.medium"
      large  = "t3.large"
    }
    gcp = {
      small  = "e2-small"
      medium = "e2-medium"
      large  = "e2-standard-2"
    }
    azure = {
      small  = "Standard_B1s"
      medium = "Standard_B2s"
      large  = "Standard_B4ms"
    }
  }

  # Database instance mappings
  db_instance_types = {
    aws = {
      small  = "db.t3.micro"
      medium = "db.t3.small"
      large  = "db.t3.medium"
    }
    gcp = {
      small  = "db-f1-micro"
      medium = "db-g1-small"
      large  = "db-custom-2-7680"
    }
    azure = {
      small  = "GP_Gen5_2"
      medium = "GP_Gen5_4"
      large  = "GP_Gen5_8"
    }
  }

  # Cache instance mappings
  cache_instance_types = {
    aws = {
      small  = "cache.t3.micro"
      medium = "cache.t3.small"
      large  = "cache.t3.medium"
    }
    gcp = {
      small  = "BASIC"
      medium = "STANDARD_HA"
      large  = "STANDARD_HA"
    }
    azure = {
      small  = "C0"
      medium = "C1"
      large  = "C2"
    }
  }

  # Common tags
  common_tags = merge(var.tags, {
    Environment = var.environment
    Project     = var.project_name
    ManagedBy   = "terraform"
    CloudProvider = var.cloud_provider
  })
}

# Networking module
module "networking" {
  source = "./modules/${var.cloud_provider}/networking"
  
  project_name           = var.project_name
  environment           = var.environment
  region                = var.region
  vpc_cidr              = var.vpc_cidr
  public_subnet_cidrs   = var.public_subnet_cidrs
  private_subnet_cidrs  = var.private_subnet_cidrs
  tags                  = local.common_tags
}

# Kubernetes cluster module
module "kubernetes" {
  source = "./modules/${var.cloud_provider}/kubernetes"
  
  project_name         = var.project_name
  environment         = var.environment
  region              = var.region
  kubernetes_version  = var.kubernetes_version
  node_instance_type  = local.instance_types[var.cloud_provider][var.node_instance_type]
  min_nodes          = var.min_nodes
  max_nodes          = var.max_nodes
  desired_nodes      = var.desired_nodes
  
  # Networking inputs
  vpc_id             = module.networking.vpc_id
  subnet_ids         = module.networking.private_subnet_ids
  public_subnet_ids  = module.networking.public_subnet_ids
  
  tags = local.common_tags
}

# Database module
module "database" {
  source = "./modules/${var.cloud_provider}/database"
  
  project_name           = var.project_name
  environment           = var.environment
  region                = var.region
  instance_class        = local.db_instance_types[var.cloud_provider][var.database_instance_class]
  allocated_storage     = var.database_allocated_storage
  engine_version        = var.database_engine_version
  backup_retention_days = var.backup_retention_days
  enable_backup         = var.enable_backup
  enable_encryption     = var.enable_encryption
  
  # Networking inputs
  vpc_id     = module.networking.vpc_id
  subnet_ids = module.networking.private_subnet_ids
  
  tags = local.common_tags
}

# Cache module
module "cache" {
  source = "./modules/${var.cloud_provider}/cache"
  
  project_name     = var.project_name
  environment     = var.environment
  region          = var.region
  node_type       = local.cache_instance_types[var.cloud_provider][var.cache_node_type]
  num_nodes       = var.cache_num_nodes
  enable_backup   = var.enable_backup
  
  # Networking inputs
  vpc_id     = module.networking.vpc_id
  subnet_ids = module.networking.private_subnet_ids
  
  tags = local.common_tags
}

# Object storage module
module "storage" {
  source = "./modules/${var.cloud_provider}/storage"
  
  project_name      = var.project_name
  environment      = var.environment
  region           = var.region
  bucket_name      = var.bucket_name != "" ? var.bucket_name : "${var.project_name}-${var.environment}-storage"
  enable_encryption = var.enable_encryption
  
  tags = local.common_tags
}

# Monitoring module (conditional)
module "monitoring" {
  count  = var.enable_monitoring ? 1 : 0
  source = "./modules/${var.cloud_provider}/monitoring"
  
  project_name = var.project_name
  environment = var.environment
  region      = var.region
  
  # Resource inputs for monitoring
  cluster_name     = module.kubernetes.cluster_name
  database_id      = module.database.database_id
  cache_cluster_id = module.cache.cluster_id
  
  tags = local.common_tags
}

# Security and encryption module
module "security" {
  source = "./modules/${var.cloud_provider}/security"
  
  project_name      = var.project_name
  environment      = var.environment
  region           = var.region
  enable_encryption = var.enable_encryption
  
  # Networking inputs
  vpc_id = module.networking.vpc_id
  
  tags = local.common_tags
}

# DNS and certificate management (conditional)
module "dns" {
  count  = var.domain_name != "" ? 1 : 0
  source = "./modules/${var.cloud_provider}/dns"
  
  project_name = var.project_name
  environment = var.environment
  region      = var.region
  domain_name = var.domain_name
  enable_ssl  = var.enable_ssl
  
  tags = local.common_tags
}
