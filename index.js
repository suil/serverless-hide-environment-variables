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
            'before:offline:start': this.replaceEnvironmentVariables.bind(this),
            'before:offline:start:init': this.replaceEnvironmentVariables.bind(this)
        };
    }

    async awsKmsDecrypt(value, region) {
        try {
            const kms = new AWS.KMS({
                apiVersion: '2014-11-01',
                region: region || this.region || 'us-east-1'
            });
            const { Plaintext: plaintext } = await kms.decrypt({ CiphertextBlob: new Buffer(value, 'base64') }).promise();
            this.serverless.cli.consoleLog(`Decrypted cipher ${value} to ${plaintext} using a key in region ${region}`);
            return plaintext.toString('ascii');
        } catch (error) {
            this.serverless.cli.consoleLog(`AWS KMS service cannot decrypt value: ${value}`);
            throw error;
        }
    }

    async decryptObjectCipher(objectCipher) {
        if (typeof objectCipher !== 'object' || !objectCipher.encrypted) {
            this.serverless.cli.consoleLog('Object cipher format is not correct:', objectCipher);
            throw new Error('Object cipher format is not correct:', objectCipher);
        }
        const { encrypted, kmsKeyRegion } = environmentVariable;
        const decrypted = await this.awsKmsDecrypt(encrypted, kmsKeyRegion || this.region || 'us-east-1');
        return decrypted;
    }

    async replaceVariables(environmentVariables) {
        if (!environmentVariables || typeof environmentVariables !== 'object') {
            return;
        }
        return Promise.all(
            Object.keys(environmentVariables)
                .reduce((memo, variableName) => {
                    const variableValue = environmentVariables[variableName];
                    const promisedDecrypt = async (cipher, region) => {
                        const decryptedValue = await this.awsKmsDecrypt(cipher, region);
                        environmentVariables[variableName] = decryptedValue;
                    };

                    // found object cipher format
                    const parsedObjectCipher = this.parseObjectCipherFormat(variableValue);
                    if (parsedObjectCipher !== false) {
                        const { region, cipher } = parsedObjectCipher;
                        memo.push(promisedDecrypt(cipher, region));
                        return memo;
                    }

                    // found data cipher format
                    const parsedDataCipher = this.parseDataCipherFormat(variableValue);
                    if (parsedDataCipher !== false) {
                        const { region, cipher } = parsedDataCipher;
                        memo.push(promisedDecrypt(cipher, region));
                        return memo;
                    }

                    return memo;
                }, [])
        );
    }

    parseObjectCipherFormat(objectCipherFormat) {
        if (typeof objectCipherFormat !== 'object' || !objectCipherFormat.hasOwnProperty('encrypted')) {
            return false;
        }
        const { encrypted, kmsKeyRegion } = objectCipherFormat;
        if (typeof encrypted !== 'string' || encrypted.trim() === '') {
            throw new Error(`Object cipher format is not correct ${JSON.stringify(objectCipherFormat, null, 2)}`)
        }
        return {
            cipher: encrypted,
            region: kmsKeyRegion
        };
    }

    parseDataCipherFormat(cipherFormat) {
        if (typeof cipherFormat !== 'string') {
            return false;
        }

        const match = cipherFormat.match(/^data:aws\/kms;([\w-]*,?.*)/im);
        if (!match) {
            return false;
        }

        const [, regionAndCipherData = ''] = match;
        const splittedRegionAndCipherData = regionAndCipherData
            .split(',')
            .filter(Boolean);

        if (
            splittedRegionAndCipherData &&
            splittedRegionAndCipherData.length === 1
        ) {
            return {
                region: 'us-east-1',
                cipher: splittedRegionAndCipherData[0]
            };
        }

        if (
            splittedRegionAndCipherData &&
            splittedRegionAndCipherData.length === 2
        ) {
            return {
                region: splittedRegionAndCipherData[0],
                cipher: splittedRegionAndCipherData[1]
            };
        }

        throw 'WRONG_CIPHER_VALUE';
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
