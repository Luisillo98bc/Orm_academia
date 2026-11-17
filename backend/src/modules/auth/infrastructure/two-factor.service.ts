import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const ENCRYPTED_PREFIX = 'enc:v1:';

@Injectable()
export class TwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async setup(userId: string, email: string) {
    const secret = this.generateSecret();
    const updated = await this.prisma.user.updateMany({
      where: { id: userId, deletedAt: null, twoFactorEnabled: false },
      data: {
        twoFactorSecret: this.encryptSecret(secret),
        twoFactorEnabled: false,
      },
    });
    if (updated.count !== 1) {
      throw new ForbiddenException(
        'No se puede reiniciar la configuración de un 2FA activo',
      );
    }

    const issuer = 'Academia Virtual';
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(`${issuer}:${email}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      margin: 1,
      width: 240,
      color: { dark: '#0f172a', light: '#ffffff' },
    });

    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  async status(userId: string) {
    const user = await this.findUser(userId);
    return {
      enabled: user.twoFactorEnabled,
      hasSecret: Boolean(user.twoFactorSecret),
    };
  }

  async enable(userId: string, code: string) {
    const user = await this.findUser(userId);
    if (
      !user.twoFactorSecret ||
      !this.verifyStoredCode(user.twoFactorSecret, code)
    ) {
      throw new BadRequestException('El código 2FA no es válido');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: this.encryptSecret(
          this.decryptSecret(user.twoFactorSecret),
        ),
      },
    });
    return { enabled: true };
  }

  async disable(userId: string, code: string) {
    if (this.configService.get<string>('NODE_ENV') === 'production') {
      throw new ForbiddenException(
        '2FA es obligatorio para las cuentas administrativas en producción',
      );
    }
    const user = await this.findUser(userId);
    if (
      user.twoFactorEnabled &&
      (!user.twoFactorSecret ||
        !this.verifyStoredCode(user.twoFactorSecret, code))
    ) {
      throw new BadRequestException(
        'Debes ingresar un código 2FA válido para desactivarlo',
      );
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
    return { enabled: false };
  }

  verifyCode(secret: string, code: string): boolean {
    if (!/^\d{6}$/.test(String(code || ''))) return false;
    const counter = Math.floor(Date.now() / 1000 / 30);
    return [-1, 0, 1].some(
      (offset) => this.generateCode(secret, counter + offset) === code,
    );
  }

  verifyStoredCode(storedSecret: string, code: string): boolean {
    try {
      return this.verifyCode(this.decryptSecret(storedSecret), code);
    } catch {
      return false;
    }
  }

  async upgradeLegacySecret(
    userId: string,
    storedSecret: string,
  ): Promise<void> {
    if (storedSecret.startsWith(ENCRYPTED_PREFIX)) return;
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: this.encryptSecret(storedSecret) },
    });
  }

  private async findUser(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    });
    if (!user) throw new BadRequestException('Usuario no encontrado');
    return user;
  }

  private generateSecret() {
    return this.toBase32(crypto.randomBytes(20));
  }

  private encryptionKey(): Buffer {
    const configuredKey = this.configService.get<string>(
      'TWO_FACTOR_ENCRYPTION_KEY',
    );
    const fallbackKey = this.configService.get<string>('JWT_SECRET');
    if (!configuredKey && !fallbackKey) {
      throw new Error('TWO_FACTOR_ENCRYPTION_KEY no está configurada');
    }
    return crypto
      .createHash('sha256')
      .update(configuredKey || fallbackKey || '')
      .digest();
  }

  private encryptSecret(secret: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      this.encryptionKey(),
      iv,
    );
    const encrypted = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return [
      ENCRYPTED_PREFIX.slice(0, -1),
      iv.toString('base64url'),
      authTag.toString('base64url'),
      encrypted.toString('base64url'),
    ].join(':');
  }

  private decryptSecret(storedSecret: string): string {
    if (!storedSecret.startsWith(ENCRYPTED_PREFIX)) {
      // Compatibilidad temporal con secretos creados antes del cifrado.
      return storedSecret;
    }
    const [, version, ivEncoded, authTagEncoded, encryptedEncoded] =
      storedSecret.split(':');
    if (
      version !== 'v1' ||
      !ivEncoded ||
      !authTagEncoded ||
      !encryptedEncoded
    ) {
      throw new Error('Secreto 2FA inválido');
    }
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey(),
      Buffer.from(ivEncoded, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(authTagEncoded, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedEncoded, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  private generateCode(secret: string, counter: number) {
    const key = this.fromBase32(secret);
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(counter));
    const digest = crypto.createHmac('sha1', key).update(buffer).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const binary =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);
    return String(binary % 1_000_000).padStart(6, '0');
  }

  private toBase32(buffer: Buffer) {
    let bits = 0;
    let value = 0;
    let output = '';
    for (const byte of buffer) {
      value = (value << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    return output;
  }

  private fromBase32(value: string) {
    let bits = 0;
    let accumulator = 0;
    const bytes: number[] = [];
    for (const char of value.replace(/=+$/, '').toUpperCase()) {
      const index = BASE32_ALPHABET.indexOf(char);
      if (index < 0) throw new BadRequestException('Secreto 2FA inválido');
      accumulator = (accumulator << 5) | index;
      bits += 5;
      if (bits >= 8) {
        bytes.push((accumulator >>> (bits - 8)) & 0xff);
        bits -= 8;
      }
    }
    return Buffer.from(bytes);
  }
}
