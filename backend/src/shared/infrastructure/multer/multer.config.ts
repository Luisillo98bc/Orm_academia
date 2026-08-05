import { diskStorage } from 'multer';
import { extname } from 'path';
import * as crypto from 'crypto';
import { HttpException, HttpStatus } from '@nestjs/common';

export const multerConfig = {
  storage: diskStorage({
    destination: './uploads',
    filename: (req, file, cb) => {
      const filename = `${crypto.randomUUID()}${extname(file.originalname)}`;
      cb(null, filename);
    },
  }),

  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype.match(/\/(jpg|jpeg|png|gif|webp|svg\+xml)$/)) {
      cb(null, true);
    } else {
      cb(
        new HttpException('Unsupported file type', HttpStatus.BAD_REQUEST),
        false,
      );
    }
  },
};
