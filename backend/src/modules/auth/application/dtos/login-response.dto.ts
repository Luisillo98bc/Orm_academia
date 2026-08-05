// ============================================================================
// LoginResponseDto — DTO de respuesta del Login
// ============================================================================

/**
 * DTO de respuesta que contiene el token JWT y la información
 * del usuario autenticado, incluyendo sus permisos aplanados.
 */
export class LoginResponseDto {
  /** Token JWT firmado */
  readonly accessToken: string;

  /** Tipo de token (siempre "Bearer") */
  readonly tokenType: string;

  /** Información básica del usuario */
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly fullName: string;
    readonly roles: string[];
  };

  /** Lista plana de permisos en formato "subject:action" */
  readonly permissions: string[];

  constructor(props: {
    accessToken: string;
    user: { id: string; email: string; fullName: string; roles: string[] };
    permissions: string[];
  }) {
    this.accessToken = props.accessToken;
    this.tokenType = 'Bearer';
    this.user = props.user;
    this.permissions = props.permissions;
  }
}
