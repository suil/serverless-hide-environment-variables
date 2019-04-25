# Serverless plugin to hide environment variables
Serverless plugin that hides environment variables for AWS Lambda functions using AWS Key Management Service (KMS) before deployment

## Introduction
Checking-in environment variables in serverless.yml into repositories is a very convenient and popular way to manage runtime configurations for serverless applications. With this approach, however, sensitive information like API keys and secret tokens will be exposed publicly. This pratice is probably against security policies in every organization.

This plgin is to hide sensitive environment variables in both provider's environment section and functions's environment section using KMS encrypted string. Then, the serverless framework's deployment process will decrypt them using KMS keys in a specified region, so that Lambda function can consume them from `process.env.SECRET_API_KEY` in the runtime.

## Usage

### Encrypt your sensitive environment variable using AWS KMS service
Follow the instruction https://docs.aws.amazon.com/cli/latest/reference/kms/encrypt.html to encrypt your sensitive environment variable using a KMS key from a region.

### Add the environment variable using this format
Put your encrypted string to the provider's environment section or function's environment session in serverless.yml in this following format:

```
provider:
  ...
  environment:
    GENERAL_ENCRYPTED_API_KEY:
      encrypted: AQICAHinIKhx8yV+y97+qS5naGEB...
      kmsKeyRegion: us-east-1
    GENERAL_NORMAL_API_KEY: unencrypted-key-value

functions:
  yourLambdaFunction:
    environment:
      FUNCTION_SPECIFIC_ENCRYPTED_API_KEY:
        encrypted: AQICAHinIKhx8yV+y97+qS5naGEB...
        kmsKeyRegion: us-west-2
      FUNCTION_SPECIFIC_NORMAL_API_KEY: unencrypted-key-value

plugins:
  - serverless-hide-environment-variables
  ...
```

If an environment variable is a encrypted string, it has to be put as an object that has `encrypted` key. `kmsKeyRegion` key in the object is the region where the KMS key you use for encrypting the variable value. `kmsKeyRegion` key is optional. If it's missing, the region from command line will be used. If the region from command line is even missing, `'us-east-1'` will be used.

### Local invocation of a lambda function.
The decryption does actually work in the local invocation for a lambda function. Once the environment variables are configured correctly, `process.env.SECRET_API_KEY` will have decrypted value as if it's in deployed Lambda environtment.

    

