const AWS = require('aws-sdk');

module.exports = class HideEnvironmentVariablesPlugin {
    constructor(serverless, options) {
        this.serverless = serverless;
        this.region = options.region;
        this.options = options;
        this.hooks = {
            'before:deploy:functions': this.replaceEnvironmentVariables.bind(this),
            'package:createDeploymentArtifacts': this.replaceEnvironmentVariables.bind(this),
            'before:deploy:function:packageFunction': this.replaceEnvironmentVariables.bind(this),
            'before:invoke:local:invoke': this.replaceProcessEnvVariablesForFunction.bind(this),
            'before:invoke:local:loadEnvVars': this.replaceEnvironmentVariables.bind(this),
            'before:offline:start:init': this.replaceEnvironmentVariables.bind(this)
        };
    }

    async awsKmsDecrypt(value, region) {
        try {
            const kms = new AWS.KMS({ apiVersion: '2014-11-01', region });
            const { Plaintext: plaintext } = await kms.decrypt({ CiphertextBlob: new Buffer(value, 'base64') }).promise();
            return plaintext.toString('ascii');
        } catch (error) {
            this.serverless.cli.consoleLog('AWS KMS service cannot decrypt');
            throw error;
        }
    }

    async decryptVariable(environmentVariable) {
        if (typeof environmentVariable !== 'object' || !environmentVariable.encrypted) {
            return environmentVariable;
        }
        const { encrypted, kmsKeyRegion } = environmentVariable;
        const decrypted = await this.awsKmsDecrypt(encrypted, kmsKeyRegion || this.region || 'us-east-1');
        return decrypted;
    }
    
    async replaceVariables(environmentVariables) {
        if (!environmentVariables) {
            return;
        }
        return Promise.all(
            Object.keys(environmentVariables)
                .filter(variableName => typeof environmentVariables[variableName] === 'object' && environmentVariables[variableName].encrypted)
                .map(async variableName => {
                    environmentVariables[variableName] = await this.decryptVariable(environmentVariables[variableName]);
                    this.serverless.cli.consoleLog(`Decrypted variable ${variableName} to ${environmentVariables[variableName]}`);
                })
        );
    }
    
    async replaceEnvironmentVariables() {
        return Promise.all([
            this.replaceVariables(this.serverless.service.provider.environment),
            ...Object.keys(this.serverless.service.functions).map(async func => {
                await this.replaceVariables(this.serverless.service.functions[func].environment);
            })]
        );
    }

    replaceProcessEnvVariablesForFunction() {
        // replace shared provider environment variables
        if (this.serverless.service.provider.environment) {
            Object.keys(this.serverless.service.provider.environment).forEach(envVarName => {
                process.env[envVarName] = this.serverless.service.provider.environment[envVarName];
            });
        }
        
        const func = this.options.function;
        // replace function's environment variables
        const funcConfig = this.serverless.service.functions[func];
        if (funcConfig && funcConfig.environment) {
            Object.keys(funcConfig.environment).forEach(envVarName => {
                process.env[envVarName] = funcConfig.environment[envVarName];
            });
        }
    }
};
