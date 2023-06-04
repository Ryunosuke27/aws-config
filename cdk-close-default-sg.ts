// @ts-nocheck
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as iam from "aws-cdk-lib/aws-iam";
import * as config from "aws-cdk-lib/aws-config";

export class CloseDefaultSgStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // Configルール
    const defaultSgClosedRule = new config.ManagedRule(
      this,
      "DefaultSgClosedRule",
      {
        // デフォルトのセキュリティグループが無効化されているか確認するルールを指定
        identifier:
          config.ManagedRuleIdentifiers.VPC_DEFAULT_SECURITY_GROUP_CLOSED,
      }
    );
    // 自動修復実行ロール
    const role = new iam.Role(this, "DefaultSgClosedRole", {
      assumedBy: new iam.ServicePrincipal("ssm.amazonaws.com"),
      inlinePolicies: {
        policy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: [
                // セキュリティグループのルールの削除に必要な権限
                "ec2:RevokeSecurityGroupIngress",
                "ec2:RevokeSecurityGroupEgress",
                "ec2:DescribeSecurityGroups",
              ],
              resources: ["*"],
            }),
          ],
        }),
      },
    });

    // 修復設定
    new config.CfnRemediationConfiguration(this, "DefaultSgClosedRemediation", {
      configRuleName: defaultSgClosedRule.configRuleName,
      targetId: "AWS-CloseSecurityGroup", // AWSが所有するSSMドキュメントを指定
      targetType: "SSM_DOCUMENT",
      automatic: true, // 自動修復
      maximumAutomaticAttempts: 5,
      retryAttemptSeconds: 60,
      parameters: {
        AutomationAssumeRole: {
          StaticValue: {
            Values: [role.roleArn],
          },
        },
        SecurityGroupId: {
          ResourceValue: {
            Value: "RESOURCE_ID",
          },
        },
      },
      targetVersion: "1",
    });
  }
}
