# VTT Platform Deployment Runbook

## Overview
This runbook covers deployment procedures for the VTT platform's staging and production environments using Kubernetes blue-green deployment strategy.

## Architecture
- **Staging**: Single environment in `vtt-staging` namespace
- **Production**: Blue-green deployment in `vtt-production` namespace
- **Services**: Client (Next.js), Server (Node.js API), Bots (Discord integration)

## Staging Deployment

### Automatic Deployment
Staging deploys automatically on pushes to `main` branch via GitHub Actions.

### Manual Deployment
```bash
# Update kubeconfig
aws eks update-kubeconfig --region us-east-1 --name vtt-staging

# Update image tags
sed -i "s|IMAGE_TAG|${IMAGE_TAG}|g" infra/k8s/staging/*.yaml

# Apply manifests
kubectl apply -f infra/k8s/staging/

# Monitor rollout
kubectl rollout status deployment/vtt-client -n vtt-staging
kubectl rollout status deployment/vtt-server -n vtt-staging
kubectl rollout status deployment/vtt-bots -n vtt-staging
```

### Staging Health Checks
```bash
# Get ingress hosts
STAGING_CLIENT=$(kubectl get ingress vtt-staging -n vtt-staging -o jsonpath='{.spec.rules[0].host}')
STAGING_API=$(kubectl get ingress vtt-staging -n vtt-staging -o jsonpath='{.spec.rules[1].host}')

# Test endpoints
curl -f https://$STAGING_CLIENT/health
curl -f https://$STAGING_API/api/v1/health
```

## Production Blue-Green Deployment

### Deployment Process
Production uses blue-green deployment with traffic switching via service selectors.

#### 1. Deploy Green Version
```bash
# Update kubeconfig
aws eks update-kubeconfig --region us-east-1 --name vtt-production

# Update image tags
sed -i "s|IMAGE_TAG|${IMAGE_TAG}|g" infra/k8s/production/*.yaml

# Apply all manifests (both blue and green)
kubectl apply -f infra/k8s/production/

# Wait for green deployments
kubectl rollout status deployment/vtt-client-green -n vtt-production
kubectl rollout status deployment/vtt-server-green -n vtt-production
```

#### 2. Health Check Green Environment
```bash
# Get a green server pod
GREEN_POD=$(kubectl get pod -n vtt-production -l app.kubernetes.io/name=vtt-platform,app.kubernetes.io/component=server,version=green -o jsonpath='{.items[0].metadata.name}')

# Port-forward to pod and test
kubectl port-forward pod/$GREEN_POD -n vtt-production 3001:3001 &
PF_PID=$!
sleep 5
curl -f http://localhost:3001/api/v1/health
kill $PF_PID
```

#### 3. Switch Traffic to Green
```bash
# Patch service selectors to point to green
kubectl patch service vtt-client -n vtt-production -p '{"spec":{"selector":{"app.kubernetes.io/name":"vtt-platform","app.kubernetes.io/component":"client","version":"green"}}}'
kubectl patch service vtt-server -n vtt-production -p '{"spec":{"selector":{"app.kubernetes.io/name":"vtt-platform","app.kubernetes.io/component":"server","version":"green"}}}'
kubectl patch service vtt-websocket -n vtt-production -p '{"spec":{"selector":{"app.kubernetes.io/name":"vtt-platform","app.kubernetes.io/component":"server","version":"green"}}}'
```

#### 4. Verify Production Traffic
```bash
# Get ingress hosts
PROD_CLIENT=$(kubectl get ingress vtt-production -n vtt-production -o jsonpath='{.spec.rules[0].host}')
PROD_API=$(kubectl get ingress vtt-production -n vtt-production -o jsonpath='{.spec.rules[1].host}')

# Test production endpoints
curl -f https://$PROD_CLIENT/health
curl -f https://$PROD_API/api/v1/health
```

#### 5. Scale Down Blue Environment
```bash
# Scale down blue deployments
kubectl scale deployment/vtt-client-blue -n vtt-production --replicas=0
kubectl scale deployment/vtt-server-blue -n vtt-production --replicas=0

# Suspend blue HPAs to prevent auto-scaling
kubectl patch hpa vtt-client-hpa -n vtt-production --type merge -p '{"spec":{"minReplicas":0}}'
kubectl patch hpa vtt-server-hpa -n vtt-production --type merge -p '{"spec":{"minReplicas":0}}'
```

## Rollback Procedures

### Emergency Rollback
If issues are detected after traffic switch, immediately rollback:

```bash
# Switch service selectors back to blue
kubectl patch service vtt-client -n vtt-production -p '{"spec":{"selector":{"app.kubernetes.io/name":"vtt-platform","app.kubernetes.io/component":"client","version":"blue"}}}'
kubectl patch service vtt-server -n vtt-production -p '{"spec":{"selector":{"app.kubernetes.io/name":"vtt-platform","app.kubernetes.io/component":"server","version":"blue"}}}'
kubectl patch service vtt-websocket -n vtt-production -p '{"spec":{"selector":{"app.kubernetes.io/name":"vtt-platform","app.kubernetes.io/component":"server","version":"blue"}}}'

# Restore blue capacity
kubectl patch hpa vtt-client-hpa -n vtt-production --type merge -p '{"spec":{"minReplicas":3}}'
kubectl patch hpa vtt-server-hpa -n vtt-production --type merge -p '{"spec":{"minReplicas":3}}'
kubectl scale deployment/vtt-client-blue -n vtt-production --replicas=3
kubectl scale deployment/vtt-server-blue -n vtt-production --replicas=3

# Scale down green
kubectl scale deployment/vtt-client-green -n vtt-production --replicas=0
kubectl scale deployment/vtt-server-green -n vtt-production --replicas=0

# Wait for rollback completion
kubectl rollout status deployment/vtt-client-blue -n vtt-production
kubectl rollout status deployment/vtt-server-blue -n vtt-production
```

## Monitoring and Troubleshooting

### Check Deployment Status
```bash
# View all deployments
kubectl get deployments -n vtt-production
kubectl get deployments -n vtt-staging

# Check pod status
kubectl get pods -n vtt-production -l app.kubernetes.io/name=vtt-platform
kubectl get pods -n vtt-staging -l app.kubernetes.io/name=vtt-platform

# View service selectors
kubectl get service vtt-client -n vtt-production -o yaml | grep -A5 selector
kubectl get service vtt-server -n vtt-production -o yaml | grep -A5 selector
kubectl get service vtt-websocket -n vtt-production -o yaml | grep -A5 selector
```

### View Logs
```bash
# Production logs
kubectl logs -n vtt-production -l app.kubernetes.io/component=client,version=green --tail=100
kubectl logs -n vtt-production -l app.kubernetes.io/component=server,version=green --tail=100

# Staging logs
kubectl logs -n vtt-staging -l app.kubernetes.io/component=client --tail=100
kubectl logs -n vtt-staging -l app.kubernetes.io/component=server --tail=100
```

### Check HPA Status
```bash
# View autoscaler status
kubectl get hpa -n vtt-production
kubectl get hpa -n vtt-staging

# Detailed HPA info
kubectl describe hpa vtt-client-hpa -n vtt-production
kubectl describe hpa vtt-server-hpa -n vtt-production
```

### Network and Ingress
```bash
# Check ingress status
kubectl get ingress -n vtt-production
kubectl get ingress -n vtt-staging

# View ALB status
kubectl describe ingress vtt-production -n vtt-production
kubectl describe ingress vtt-staging -n vtt-staging
```

## Configuration Updates

### Updating ConfigMaps
```bash
# Edit staging config
kubectl edit configmap vtt-config -n vtt-staging

# Edit production config
kubectl edit configmap vtt-config -n vtt-production

# Restart deployments to pick up changes
kubectl rollout restart deployment/vtt-client -n vtt-staging
kubectl rollout restart deployment/vtt-server -n vtt-staging
```

### Updating Secrets
```bash
# Secrets are managed via external-secrets operator
# Update values in AWS Secrets Manager, then restart pods
kubectl rollout restart deployment/vtt-server -n vtt-staging
kubectl rollout restart deployment/vtt-bots -n vtt-staging
```

## Scaling

### Manual Scaling
```bash
# Scale staging
kubectl scale deployment/vtt-client -n vtt-staging --replicas=3
kubectl scale deployment/vtt-server -n vtt-staging --replicas=3

# Scale production (current active version)
kubectl scale deployment/vtt-client-green -n vtt-production --replicas=5
kubectl scale deployment/vtt-server-green -n vtt-production --replicas=5
```

### HPA Adjustment
```bash
# Update HPA limits
kubectl patch hpa vtt-client-hpa -n vtt-production --type merge -p '{"spec":{"maxReplicas":20}}'
kubectl patch hpa vtt-server-hpa -n vtt-production --type merge -p '{"spec":{"maxReplicas":25}}'
```

## Emergency Procedures

### Complete Environment Reset
```bash
# Delete all resources in staging (DESTRUCTIVE)
kubectl delete namespace vtt-staging
kubectl apply -f infra/k8s/staging/namespace.yaml
kubectl apply -f infra/k8s/staging/

# Reset production to blue only (DESTRUCTIVE)
kubectl scale deployment/vtt-client-green -n vtt-production --replicas=0
kubectl scale deployment/vtt-server-green -n vtt-production --replicas=0
kubectl patch service vtt-client -n vtt-production -p '{"spec":{"selector":{"version":"blue"}}}'
kubectl patch service vtt-server -n vtt-production -p '{"spec":{"selector":{"version":"blue"}}}'
kubectl patch service vtt-websocket -n vtt-production -p '{"spec":{"selector":{"version":"blue"}}}'
```

## GitHub Actions Integration

### Manual Workflow Dispatch
```bash
# Deploy to staging only
gh workflow run deploy-production.yml -f environment=staging

# Deploy to production
gh workflow run deploy-production.yml -f environment=production
```

### Workflow Status
```bash
# Check recent workflow runs
gh run list --workflow=deploy-production.yml --limit=5

# View specific run
gh run view <run-id>
```

## Best Practices

1. **Always test in staging first** before production deployment
2. **Monitor metrics** during and after deployment
3. **Keep rollback window short** - rollback within 15 minutes if issues detected
4. **Verify health checks** pass before traffic switch
5. **Scale gradually** when adjusting capacity
6. **Document incidents** and update runbook as needed

## Contact Information

- **On-call Engineer**: Check PagerDuty rotation
- **Slack Channel**: `#deployments`
- **Incident Response**: `#incidents`
