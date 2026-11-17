import { Injectable } from '@nestjs/common';

type RevocationHandler = (userId: string) => void;

/** Notifica a los gateways del mismo proceso para cortar sockets al cerrar sesión. */
@Injectable()
export class AuthRevocationService {
  private readonly handlers = new Set<RevocationHandler>();

  subscribe(handler: RevocationHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  revoke(userId: string): void {
    for (const handler of this.handlers) handler(userId);
  }
}
