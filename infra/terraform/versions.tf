terraform {
  required_version = ">= 1.6.0"
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.29"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.13"
    }
    # Add your cloud provider when ready, e.g. AWS/GCP/Azure
    # aws = {
    #   source  = "hashicorp/aws"
    #   version = "~> 5.60"
    # }
  }
}
