export class PlatformSettingsEntity {
  id: string;
  academyName: string;
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
  certificateTemplate?: CertificateTemplateSettings | null;
  updatedAt: Date;
}

export type PublicPlatformSettings = Pick<
  PlatformSettingsEntity,
  | 'academyName'
  | 'legalName'
  | 'tagline'
  | 'description'
  | 'logoUrl'
  | 'faviconUrl'
  | 'primaryColor'
  | 'whatsappNumber'
  | 'supportEmail'
  | 'facebookUrl'
  | 'instagramUrl'
  | 'linkedinUrl'
  | 'youtubeUrl'
  | 'tiktokUrl'
  | 'xUrl'
  | 'heroEyebrow'
  | 'heroTitle'
  | 'heroSubtitle'
  | 'termsUrl'
  | 'privacyUrl'
>;

export interface CertificateTemplateSettings {
  version: string;
  primaryColor: string;
  academyLabel: string;
  completionTitle: string;
  gradesTitle: string;
  signatureLabel: string;
}
