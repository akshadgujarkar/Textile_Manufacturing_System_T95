import { TxManager } from '../../database/tx-manager';
import { CryptoUtil } from '../../utils/crypto';
import { AuthUser, BusinessRole } from '../../types';

export class AuthService {
  /**
   * Authenticates user against PostgreSQL app_user and user_role tables
   */
  static async login(username: string, passwordCandidate: string): Promise<{ accessToken: string; refreshToken: string; user: AuthUser }> {
    const userRow = await TxManager.queryOne<{
      user_id: string;
      username: string;
      password_hash: string;
      employee_id: string | null;
      is_active: boolean;
    }>(
      `SELECT user_id, username, password_hash, employee_id, is_active
       FROM app_user 
       WHERE lower(username) = lower($1);`,
      [username]
    );

    if (!userRow) {
      throw new Error('INVALID_CREDENTIALS');
    }

    if (!userRow.is_active) {
      throw new Error('USER_ACCOUNT_DEACTIVATED');
    }

    const isValid = await CryptoUtil.verifyPassword(userRow.password_hash, passwordCandidate);
    if (!isValid) {
      throw new Error('INVALID_CREDENTIALS');
    }

    // Fetch user roles
    const roleRows = await TxManager.query<{ role_name: string }>(
      `SELECT r.role_name 
       FROM user_role ur
       JOIN role r ON ur.role_id = r.role_id
       WHERE ur.user_id = $1;`,
      [userRow.user_id]
    );

    const user: AuthUser = {
      userId: parseInt(userRow.user_id, 10),
      username: userRow.username,
      employeeId: userRow.employee_id ? parseInt(userRow.employee_id, 10) : null,
      roles: roleRows.map((r) => r.role_name as BusinessRole),
    };

    // Update last login timestamp asynchronously
    await TxManager.query(
      `UPDATE app_user SET last_login_at = now() WHERE user_id = $1;`,
      [userRow.user_id]
    );

    const accessToken = CryptoUtil.generateAccessToken(user);
    const refreshToken = CryptoUtil.generateRefreshToken(user.userId);

    return { accessToken, refreshToken, user };
  }

  /**
   * Creates a new user with hashed password and role assignment
   */
  static async createUser(
    dto: { username: string; passwordPlain: string; employeeId?: number; roleNames: BusinessRole[] },
    adminUserId: number
  ): Promise<AuthUser> {
    const hashedPassword = await CryptoUtil.hashPassword(dto.passwordPlain);

    return await TxManager.withTransaction(
      { userId: adminUserId, source: 'admin:create-user', reason: 'New staff user creation' },
      async (client) => {
        const userInsert = await client.query(
          `INSERT INTO app_user (username, password_hash, employee_id)
           VALUES ($1, $2, $3)
           RETURNING user_id, username, employee_id;`,
          [dto.username, hashedPassword, dto.employeeId || null]
        );

        const newUserId = parseInt(userInsert.rows[0].user_id, 10);

        for (const roleName of dto.roleNames) {
          await client.query(
            `INSERT INTO user_role (user_id, role_id)
             SELECT $1, role_id FROM role WHERE role_name = $2;`,
            [newUserId, roleName]
          );
        }

        return {
          userId: newUserId,
          username: userInsert.rows[0].username,
          employeeId: userInsert.rows[0].employee_id ? parseInt(userInsert.rows[0].employee_id, 10) : null,
          roles: dto.roleNames,
        };
      }
    );
  }
}
