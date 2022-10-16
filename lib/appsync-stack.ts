import * as cdk from '@aws-cdk/core';
import * as appsync from '@aws-cdk/aws-appsync';
import { MappingTemplate } from '@aws-cdk/aws-appsync';

export class AppsyncStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // create app sync api
    const api = new appsync.GraphqlApi(this, 'Api', {
      name: 'cdk-realtime-api',
      schema: appsync.Schema.fromAsset('graphql/schema.graphql'),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
          apiKeyConfig: {
            expires: cdk.Expiration.after(cdk.Duration.days(365)),
          },
        },
      },
      xrayEnabled: true,
    });

    // print output of graphql api
    new cdk.CfnOutput(this, 'GraphQLAPIURL', {
      value: api.graphqlUrl,
    });

    // print region
    new cdk.CfnOutput(this, 'Stack Region', {
      value: this.region,
    });

    // add none source
    const nonDataSource = api.addNoneDataSource('LocalSource', {
      name: 'LocalResolver',
      description: 'Local resolver (Not going out of appsync)',
    });

    // create local resolver
    nonDataSource.createResolver({
      typeName: 'Mutation',
      fieldName: 'dataChanged',
      requestMappingTemplate: MappingTemplate.fromString(`
      {
        "version": "2017-02-28",
        "payload": {
         "id": "$context.arguments.input.id",
         "category": "$context.arguments.input.category"
         }
      }`),
      responseMappingTemplate: MappingTemplate.fromString(
        `$util.toJson($context.result)`
      ),
    });
  }
}
