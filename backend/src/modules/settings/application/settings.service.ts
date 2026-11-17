import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  CertificateTemplateSettings,
  PlatformSettingsEntity,
  PublicPlatformSettings,
} from '../domain/platform-settings.entity';

export const DEFAULT_CERTIFICATE_TEMPLATE: CertificateTemplateSettings = {
  version: 'v1',
  primaryColor: '#0ea5e9',
  academyLabel: 'ACADEMIA VIRTUAL',
  completionTitle: 'CERTIFICADO DE FINALIZACIÓN',
  gradesTitle: 'CERTIFICADO DE NOTAS',
  signatureLabel: 'Dirección Académica',
};

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(): Promise<PlatformSettingsEntity> {
    let settings = await this.prisma.platformSettings.findFirst();
    if (!settings) {
      // Return default if empty
      const newSettings = await this.prisma.platformSettings.create({
        data: {
          academyName: 'Academia Virtual',
        },
      });
      return this.toEntity(newSettings, DEFAULT_CERTIFICATE_TEMPLATE);
    }
    if (
      settings.whatsappNumber === '51999999999' ||
      settings.supportEmail === 'soporte@academia.com'
    ) {
      settings = await this.prisma.platformSettings.update({
        where: { id: settings.id },
        data: {
          whatsappNumber:
            settings.whatsappNumber === '51999999999'
              ? null
              : settings.whatsappNumber,
          supportEmail:
            settings.supportEmail === 'soporte@academia.com'
              ? null
              : settings.supportEmail,
        },
      });
    }
    return this.toEntity(settings, {
      ...DEFAULT_CERTIFICATE_TEMPLATE,
      ...((settings.certificateTemplate as Partial<CertificateTemplateSettings> | null) ??
        {}),
    });
  }

  async getPublicSettings(): Promise<PublicPlatformSettings> {
    const settings = await this.getSettings();
    return {
      academyName: settings.academyName,
      legalName: settings.legalName,
      tagline: settings.tagline,
      description: settings.description,
      logoUrl: settings.logoUrl,
      faviconUrl: settings.faviconUrl,
      primaryColor: settings.primaryColor,
      whatsappNumber: settings.whatsappNumber,
      supportEmail: settings.supportEmail,
      facebookUrl: settings.facebookUrl,
      instagramUrl: settings.instagramUrl,
      linkedinUrl: settings.linkedinUrl,
      youtubeUrl: settings.youtubeUrl,
      tiktokUrl: settings.tiktokUrl,
      xUrl: settings.xUrl,
      heroEyebrow: settings.heroEyebrow,
      heroTitle: settings.heroTitle,
      heroSubtitle: settings.heroSubtitle,
      termsUrl: settings.termsUrl,
      privacyUrl: settings.privacyUrl,
    };
  }

  async updateSettings(data: {
    academyName?: string;
    legalName?: string;
    taxId?: string;
    tagline?: string;
    description?: string;
    logoUrl?: string;
    faviconUrl?: string;
    primaryColor?: string;
    whatsappNumber?: string;
    supportEmail?: string;
    salesEmail?: string;
    address?: string;
    facebookUrl?: string;
    instagramUrl?: string;
    linkedinUrl?: string;
    youtubeUrl?: string;
    tiktokUrl?: string;
    xUrl?: string;
    heroEyebrow?: string;
    heroTitle?: string;
    heroSubtitle?: string;
    termsUrl?: string;
    privacyUrl?: string;
    certificateTemplate?: Partial<CertificateTemplateSettings>;
  }): Promise<PlatformSettingsEntity> {
    const settings = await this.getSettings();
    const clean = Object.fromEntries(
      Object.entries(data).map(([key, value]) => [
        key,
        typeof value === 'string' ? value.trim() || null : value,
      ]),
    ) as Prisma.PlatformSettingsUpdateInput;
    if (data.certificateTemplate) {
      clean.certificateTemplate = {
        ...DEFAULT_CERTIFICATE_TEMPLATE,
        ...data.certificateTemplate,
        version: 'v2',
      };
    }
    const updated = await this.prisma.platformSettings.update({
      where: { id: settings.id },
      data: clean,
    });
    return this.toEntity(updated, {
      ...DEFAULT_CERTIFICATE_TEMPLATE,
      ...((updated.certificateTemplate as Partial<CertificateTemplateSettings> | null) ??
        {}),
    });
  }

  private toEntity(
    row: Prisma.PlatformSettingsGetPayload<Prisma.PlatformSettingsDefaultArgs>,
    certificateTemplate: CertificateTemplateSettings,
  ): PlatformSettingsEntity {
    return {
      id: row.id,
      academyName: row.academyName,
      legalName: row.legalName ?? undefined,
      taxId: row.taxId ?? undefined,
      tagline: row.tagline ?? undefined,
      description: row.description ?? undefined,
      logoUrl: row.logoUrl ?? undefined,
      faviconUrl: row.faviconUrl ?? undefined,
      primaryColor: row.primaryColor ?? undefined,
      whatsappNumber: row.whatsappNumber ?? undefined,
      supportEmail: row.supportEmail ?? undefined,
      salesEmail: row.salesEmail ?? undefined,
      address: row.address ?? undefined,
      facebookUrl: row.facebookUrl ?? undefined,
      instagramUrl: row.instagramUrl ?? undefined,
      linkedinUrl: row.linkedinUrl ?? undefined,
      youtubeUrl: row.youtubeUrl ?? undefined,
      tiktokUrl: row.tiktokUrl ?? undefined,
      xUrl: row.xUrl ?? undefined,
      heroEyebrow: row.heroEyebrow ?? undefined,
      heroTitle: row.heroTitle ?? undefined,
      heroSubtitle: row.heroSubtitle ?? undefined,
      termsUrl: row.termsUrl ?? undefined,
      privacyUrl: row.privacyUrl ?? undefined,
      certificateTemplate,
      updatedAt: row.updatedAt,
    };
  }
}
