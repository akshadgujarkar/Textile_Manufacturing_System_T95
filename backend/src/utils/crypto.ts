import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { env } from '../config/environment';
import { AuthUser } from '../types';

export class CryptoUtil {
  /**
   * Hashes a plaintext password using Argon2id (RFC 9106)
   * Parameters: Memory: 64MB (65536 KB), Time cost: 3 iterations, Parallelism: 4
   */
  static async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  /**
   * Verifies a candidate password against an Argon2id hash
   */
  static async verifyPassword(hash: string, candidate: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, candidate);
    } catch {
      return false;
    }
  }

  /**
   * Generates JWT Access Token
   */
  static generateAccessToken(user: AuthUser): string {
    return jwt.sign(
      {
        userId: user.userId,
        username: user.username,
        employeeId: user.employeeId,
        roles: user.roles,
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as any }
    );
  }

  /**
   * Generates JWT Refresh Token
   */
  static generateRefreshToken(userId: number): string {
    return jwt.sign({ userId }, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as any,
    });
  }

  /**
   * Verifies JWT Access Token
   */
  static verifyAccessToken(token: string): AuthUser {
    return jwt.verify(token, env.JWT_SECRET) as AuthUser;
  }
}
