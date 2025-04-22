import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

type MinioServiceConfig = {
  fileUrl: string;
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  bucketName: string;
  endpoint: string;
  additionalClientConfig?: {
    forcePathStyle?: boolean;
  };
};

class MinioService {
  private client: S3Client;
  private bucketName: string;

  constructor() {
    const config:MinioServiceConfig = {
        fileUrl: process.env.S3_FILE_URL!,
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
        region: process.env.S3_REGION,
        bucketName: process.env.S3_BUCKET!,
        endpoint: process.env.S3_ENDPOINT!,
        additionalClientConfig: {
          forcePathStyle: true,
        },
    }
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region || 'ru-1',
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: config.additionalClientConfig?.forcePathStyle || true,
    });

    this.bucketName = config.bucketName;
  }

  async listFiles(prefix = '') {
    try {
      let allFiles: string[] = [];
      let ContinuationToken: string | undefined = undefined;

      do {
        const command = new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: prefix,
          ContinuationToken,
        });

        const response = await this.client.send(command);

        if (response.Contents) {
          allFiles = allFiles.concat(response.Contents.map(item => item.Key || '').filter(Boolean));
        }

        ContinuationToken = response.NextContinuationToken;
      } while (ContinuationToken);

      return allFiles;
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  }
}

export default MinioService;
