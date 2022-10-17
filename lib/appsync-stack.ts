import { CfnOutput, Stack, StackProps } from 'aws-cdk-lib';
import {
  CfnGraphQLApi,
  CfnGraphQLSchema,
  CfnDataSource,
  CfnResolver,
  CfnApiKey,
} from 'aws-cdk-lib/aws-appsync';
import { CfnUserPool, ClientAttributes, OAuthScope, UserPool, UserPoolClient, UserPoolClientIdentityProvider } from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
import { readFileSync } from 'fs';

export class AppsyncStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const userpool = new UserPool(this, 'user-pool', {
      userPoolName: 'pool-for-app-sync',
      autoVerify: {
        email: true,
      },
      passwordPolicy: {
        minLength: 6,
        requireLowercase: true,
        requireDigits: true,
        requireUppercase: false,
        requireSymbols: false,
      },
    });
    const appClient = new UserPoolClient(this, 'user-client', {
      userPoolClientName: 'appsync-client',
      userPool: userpool,
      authFlows: {
        adminUserPassword: true,
        custom: true,
        userSrp: true,
        userPassword: true,
      },
      supportedIdentityProviders: [
        UserPoolClientIdentityProvider.COGNITO,
      ],
      oAuth: {
        callbackUrls: ['app://test'],
        logoutUrls: ['app://test'],
        scopes: [OAuthScope.EMAIL, OAuthScope.PHONE, OAuthScope.OPENID, OAuthScope.PROFILE, OAuthScope.COGNITO_ADMIN],
        flows: { authorizationCodeGrant: true, implicitCodeGrant: true },
      },
    })
    // create app sync api
    const api = new CfnGraphQLApi(this, 'Api', {
      name: 'cdk-realtime-api',
      authenticationType: 'AMAZON_COGNITO_USER_POOLS',
      userPoolConfig: {
        userPoolId: userpool.userPoolId,
        awsRegion: Stack.of(this).region,
        defaultAction: 'ALLOW'
      },
      xrayEnabled: true,
    });

    const apiKey = new CfnApiKey(this, 'app-sync-api-key', {
      apiId: api.attrApiId,
    });
    
    const schema = new CfnGraphQLSchema(this, 'GraphSchema', {
      apiId: api.attrApiId,
      definition: readFileSync('graphql/schema.graphql').toString(),
    });

    // print output of graphql api
    new CfnOutput(this, 'GraphQLAPIURL', {
      value: api.attrGraphQlUrl,
    });

    // print region
    new CfnOutput(this, 'Stack Region', {
      value: this.region,
    });

    const nonDataSource = new CfnDataSource(this, 'NonDataSource', {
      apiId: api.attrApiId,
      name: 'NonDataSource',
      type: 'NONE',
    });

    const localResolver = new CfnResolver(this, 'LocalResolver', {
      apiId: api.attrApiId,
      dataSourceName: nonDataSource.attrName,
      typeName: 'Mutation',
      fieldName: 'dataChanged',
      requestMappingTemplate: `
      {
        "version": "2017-02-28",
        "payload": {
         "id": "$context.arguments.input.id",
         "type": "$context.arguments.input.type",
         "datetime": $context.arguments.input.datetime,
         "device_id": "$context.arguments.input.device_id",
         }
      }`,
      responseMappingTemplate: `$util.toJson($context.result)`,
    });

    localResolver.addDependsOn(schema);
  }
}
