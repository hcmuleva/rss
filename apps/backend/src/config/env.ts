import dotenv from 'dotenv'

dotenv.config()

export const env = {
  port: Number(process.env.PORT ?? 3300),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  dbHost: process.env.DB_HOST ?? 'localhost',
  dbPort: Number(process.env.DB_PORT ?? 5432),
  dbName: process.env.DB_NAME ?? 'rss',
  dbUser: process.env.DB_USER ?? 'postgres',
  dbPassword: process.env.DB_PASSWORD ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'change-me',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'change-me-too',
  awsRegion: process.env.AWS_REGION ?? 'ap-south-1',
  awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
  awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
  s3BucketName: process.env.S3_BUCKET_NAME ?? '',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3300',
  useS3: (process.env.USE_S3 ?? 'true') === 'true'
}
