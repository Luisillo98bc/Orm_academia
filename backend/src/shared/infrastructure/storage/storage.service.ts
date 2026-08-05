import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private supabaseClient: SupabaseClient | null = null;
  private provider: 'local' | 'supabase' = 'local';

  constructor(private configService: ConfigService) {
    const provider = this.configService.get<string>(
      'STORAGE_PROVIDER',
      'local',
    );
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey =
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      this.configService.get<string>('SUPABASE_ANON_KEY');

    if (provider === 'supabase' && supabaseUrl && supabaseKey) {
      this.provider = 'supabase';
      this.supabaseClient = createClient(supabaseUrl, supabaseKey);
      this.logger.log('✅ StorageService inicializado con Supabase Storage');
    } else {
      this.provider = 'local';
      this.logger.log(
        '📁 StorageService inicializado con Almacenamiento Local (uploads/)',
      );
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    bucketName: string = 'uploads',
  ): Promise<string> {
    const extension = path.extname(file.originalname);
    const fileName = `${crypto.randomUUID()}${extension}`;

    if (this.provider === 'supabase' && this.supabaseClient) {
      const fileBuffer = file.buffer || fs.readFileSync(file.path);
      const { data, error } = await this.supabaseClient.storage
        .from(bucketName)
        .upload(fileName, fileBuffer, {
          contentType: file.mimetype,
          upsert: true,
        });

      if (error) {
        this.logger.error(
          `Error subiendo archivo a Supabase Storage bucket [${bucketName}]: ${error.message}`,
        );
        throw error;
      }

      const { data: publicUrlData } = this.supabaseClient.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      return publicUrlData.publicUrl;
    } else {
      const uploadDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const filePath = path.join(uploadDir, fileName);
      if (file.buffer) {
        fs.writeFileSync(filePath, file.buffer);
      } else if (file.path && file.path !== filePath) {
        fs.copyFileSync(file.path, filePath);
      }

      return `/uploads/${fileName}`;
    }
  }
}
