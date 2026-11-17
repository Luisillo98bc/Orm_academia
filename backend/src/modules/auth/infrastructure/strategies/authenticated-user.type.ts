/** Claims disponibles en los controladores después de validar el JWT. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
}
