import { Stack, StackProps } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';

export class CdkAppStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const designBucket = new s3.Bucket(this, `${id}-design-bucket`, {
      bucketName: `design-bucket`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: false,
      publicReadAccess: false,
      encryption: s3.BucketEncryption.S3_MANAGED,
      accessControl: s3.BucketAccessControl.PRIVATE,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      lifecycleRules: [
        {
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],
    });
    const bucketPrincipals = [
      new iam.ArnPrincipal(
        '*',
      ),
    ];
    designBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: bucketPrincipals,
        actions: ['s3:GetObject', 's3:PutObject'],
        resources: [`${designBucket.bucketArn}/*`],
      }),
    );
    designBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: bucketPrincipals,
        actions: ['s3:ListBucket'],
        resources: [`${designBucket.bucketArn}`],
      }),
    );
    designBucket.grantRead(new iam.AccountRootPrincipal());

    const cloudFrontOAI = new cloudfront.OriginAccessIdentity(
      this,
      `OriginAccessIdentityID ${id}`,
    );

    // Creating a custom response headers policy -- all parameters optional
    const myResponseHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, 'ResponseHeadersPolicy', {
      responseHeadersPolicyName: 'MyPolicy',
      comment: 'A default policy',
      corsBehavior: {
        accessControlAllowCredentials: false,
        accessControlAllowHeaders: ['X-Custom-Header-1', 'X-Custom-Header-2'],
        accessControlAllowMethods: ['GET', 'POST'],
        accessControlAllowOrigins: ['*'],
        accessControlExposeHeaders: ['X-Custom-Header-1', 'X-Custom-Header-2'],
        accessControlMaxAge: cdk.Duration.seconds(600),
        originOverride: true,
      },
      customHeadersBehavior: {
        customHeaders: [
          { header: 'X-Amz-Date', value: 'some-value', override: true },
          { header: 'X-Amz-Security-Token', value: 'some-value', override: false },
        ],
      },
      securityHeadersBehavior: {
        contentSecurityPolicy: { contentSecurityPolicy: 'default-src https:;', override: true },
        contentTypeOptions: { override: true },
        frameOptions: { frameOption: cloudfront.HeadersFrameOption.DENY, override: true },
        referrerPolicy: { referrerPolicy: cloudfront.HeadersReferrerPolicy.NO_REFERRER, override: true },
        strictTransportSecurity: { accessControlMaxAge: cdk.Duration.seconds(600), includeSubdomains: true, override: true },
        xssProtection: { protection: true, modeBlock: true, reportUri: 'https://example.com/csp-report', override: true },
      },
    });
    new cloudfront.Distribution(this, 'myDistCustomPolicy', {
      defaultBehavior: {
        origin: new origins.S3Origin(designBucket, {
          originAccessIdentity: cloudFrontOAI,
          originPath: '',
        }),
        responseHeadersPolicy: myResponseHeadersPolicy,
      },
    });
  }
}
