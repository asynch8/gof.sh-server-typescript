import dotenv from 'dotenv';
dotenv.config();

interface fsConfig {
  adapterName: string;
  adapterOptions: any;
}

interface awsConfig {
  region: string;
  s3: {
    bucket: string;
  }
}

export interface Config {
  env: string;
  host: string;
  publicUrl: string;
  port: number;
  dbLocation: string;
  seed: boolean;
  migrate: boolean;
  fsConfig: fsConfig;
  awsConfig: awsConfig;
}

const config: Config = {
  env: process.env.NODE_ENV ?? 'development',
  host: process.env.HOST ?? '0.0.0.0',
  publicUrl: process.env.PUBLIC_URL ?? 'http://localhost:8080',
  port: process.env.PORT ? Number(process.env.PORT) : 8080,
  seed: process.env.SEED?.toLocaleLowerCase() === 'true',
  migrate: process.env.MIGRATE?.toLowerCase() === 'true',
  dbLocation: process.env.DB_LOCATION ?? './data/db.sqlite3',
  fsConfig: {
    adapterName: process.env.FS_ADAPTER_NAME ?? 'local',
    adapterOptions: process.env.FS_ADAPTER_OPTIONS ?? {
      root: './data/uploads'
    }
  },
  awsConfig: {
    region: process.env.AWS_REGION ?? 'eu-north-1',
    s3: {
      bucket: process.env.AWS_S3_BUCKET ?? 'gof.sh-storage-01'
    }
  }
};

export default config;
