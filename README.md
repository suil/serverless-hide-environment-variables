# Serverless plugin to hide environment variables
Serverless plugin that hides environment variables for AWS Lambda functions using AWS Key Management Service (KMS) before deployment

## Introduction
Checking-in environment variables in serverless.yml into repositories is a very convenient and popular way to manage runtime configurations for serverless applications. With this approach, however, sensitive information like API keys and secret tokens will be exposed publicly. This pratice is probably against security policies in every organization.

This plugin is to hide sensitive environment variables in both provider's environment section and functions's environment section using KMS encrypted string. Then, the serverless framework's deployment process will decrypt them using KMS keys in a specified region, so that Lambda function can consume them from `process.env.SECRET_API_KEY` in the runtime.

## Usage

### Encrypt your sensitive environment variable using AWS KMS service
Follow the instruction https://docs.aws.amazon.com/cli/latest/reference/kms/encrypt.html to encrypt your sensitive environment variable using a KMS key from a region.

### Add the environment variable using this format
Put your encrypted string to the provider's environment section or function's environment session in serverless.yml in this following format:

```
provider:
  ...
  environment:
    GENERAL_ENCRYPTED_API_KEY_WITH_OBJECT_CIPHER_FORMAT:
      encrypted: AQICAHinIKhx8yV+y97+qS5naGEB...
      kmsKeyRegion: us-east-1

    GENERAL_ENCRYPTED_API_KEY_WITH_DATA_CIPHER_FORMAT:
      encrypted: data:aws/kms;us-east-1,AQICAHinIKhx8yV+y97+qS5naGEB...

    GENERAL_NORMAL_API_KEY: unencrypted-key-value

functions:
  yourLambdaFunction:
    environment:
      FUNCTION_SPECIFIC_ENCRYPTED_API_KEY_WITH_OBJECT_CIPHER_FORMAT:
        encrypted: AQICAHinIKhx8yV+y97+qS5naGEB...
        kmsKeyRegion: us-west-2

      FUNCTION_SPECIFIC_ENCRYPTED_API_KEY_WITH_DATA_CIPHER_FORMAT:
        encrypted: data:aws/kms;us-east-1,AQICAHinIKhx8yV+y97+qS5naGEB...
        kmsKeyRegion: us-west-2

      FUNCTION_SPECIFIC_NORMAL_API_KEY: unencrypted-key-value

plugins:
  - serverless-hide-environment-variables
  ...
```

If an environment variable is a encrypted string, it can be put as an object cipher format or a data cipher format. These two formats are described as follows:

#### Object Cipher Format ####
This format has to be an object that contains a required key `encrypted` and an optional key `kmsKeyRegion`. `encrypted` should be assigned with encrypted cipher texts. And `kmsKeyRegion` is the region where the value has been encrypted with your KMS key. `kmsKeyRegion` key is optional. If it's missing, the region from command line will be used. If the region from command line is even missing, `'us-east-1'` will be used.

#### Data Cipher Format ####
This format is a pure JavaScript string with certain pattern. It has a prefix string that starts with `data:aws/kms;` followed by an optional AWS region string. And then, a comma separates the prefix and encrypted value. If the the a region is not provided, the comma seperator can be skipped. The following are all valid data cipher format:
```
data:aws/kms;us-east-1,AQICAHinIKhx8yV+y97+qS5naGEB...
```
```
data:aws/kms;,AQICAHinIKhx8yV+y97+qS5naGEB...
```
```
data:aws/kms;AQICAHinIKhx8yV+y97+qS5naGEB...
```
In the case where the region is missing, it follows the same rule as Object Cipher Format when filling default region value.

### Local invocation of a lambda function
The decryption does actually work in the local invocation for a lambda function. Once the environment variables are configured correctly, `process.env.SECRET_API_KEY` will have decrypted value as if it's in deployed Lambda environtment.

### Working with serverless-offline plugin
This plugin can work with serverless-offline plugin to provide decryption functionality of environment variables in the offline scenario. But this will work only when `serverless-hide-environment-variables` is configured above `serverless-offline` in the `plugins` section in `serverless.yml`. This is to ensure that `serverless-hide-environment-variables` can register the event of `serverless-offline` correctly.

```
plugins:
  - serverless-hide-environment-variables
  - serverless-offline
  ...
```