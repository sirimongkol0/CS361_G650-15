#!/usr/bin/env bash
# Add the Module 10 target-tracking policy to the fallback ASG.
# Run after the fallback stack is CREATE_COMPLETE.
set -euo pipefail

STACK="${STACK:-cs361-scaling-fallback}"
TARGET="${TARGET:-48}"
POLICY="${POLICY:-cs361-cpu-target}"

ASG=$(aws cloudformation describe-stacks \
  --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='AutoScalingGroupName'].OutputValue" \
  --output text)
if [[ -z "$ASG" || "$ASG" == "None" ]]; then
  echo "Could not find AutoScalingGroupName in stack $STACK" >&2
  exit 1
fi

echo "ASG: $ASG"
echo "Target CPU: ${TARGET}%"

aws autoscaling put-scaling-policy \
  --auto-scaling-group-name "$ASG" \
  --policy-name "$POLICY" \
  --policy-type TargetTrackingScaling \
  --target-tracking-configuration "{
    \"TargetValue\": ${TARGET}.0,
    \"PredefinedMetricSpecification\": {
      \"PredefinedMetricType\": \"ASGCAverageCPUUtilization\"
    },
    \"ScaleInCooldown\": 120,
    \"ScaleOutCooldown\": 60
  }"

echo "Policy $POLICY applied."
aws autoscaling describe-policies \
  --auto-scaling-group-name "$ASG" \
  --policy-names "$POLICY" \
  --query 'ScalingPolicies[0].[PolicyName,PolicyType,TargetTrackingConfiguration.TargetValue]' \
  --output table
