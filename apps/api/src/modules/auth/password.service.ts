import { randomInt } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

// OWASP baseline. @node-rs/argon2 uses Argon2id by default.
const OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;
// No 0/O, 1/l/I: temporary passwords are read out over the phone.
const READABLE = 'abcdefghjkmnpqrstuvwxyz23456789';

@Injectable()
export class PasswordService {
  private readonly dummy = hash('timing-equaliser-not-a-credential', OPTIONS);

  hash(password: string): Promise<string> {
    return hash(password, OPTIONS);
  }

  /** Unknown users cost the same time as known ones. */
  async verify(storedHash: string | undefined, password: string): Promise<boolean> {
    const ok = await verify(storedHash ?? (await this.dummy), password);
    return ok && storedHash !== undefined;
  }

  generateTemporary(): string {
    const group = () => Array.from({ length: 4 }, () => READABLE[randomInt(READABLE.length)]).join('');
    return `${group()}-${group()}-${group()}`;
  }
}
