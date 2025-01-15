import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthenticationError } from './errors';
import { getUserByEmail, insertUser, User } from '../clients/users';
import { ApiKey, UnregisteredApiKey } from '../clients/apiKeys';

const saltRounds = 10;
const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key';

interface ApiKeyConfig {
    key: string;
    permissions: string[];
    userId: string;
}

interface JwtPayload {
    permissions: string[];
    userId: string;
}

export interface DecodedJWT extends JwtPayload {
    iat: number;
    exp: number;
}

interface TokenResponse {
    token: string;
    expiresIn: string;
}

const hardcodedApiKey: ApiKey = {
    id: 'superadmin',
    key: 'supersecretkey',
    permissions: ['create', 'customName', 'admin'],
    userId: 'superadmin',
    createdAt: new Date(),
    updatedAt: new Date()
};

const EXPECTED_API_KEY: ApiKey[] = [hardcodedApiKey];

/**
 * Register a new user
 */
export async function register(
    user: Omit<User, 'id' | 'created_at' | 'updated_at'>
): Promise<any> {
    const existingUser = await getUserByEmail(user.email);
    if (existingUser) {
        console.log('User already exists', { existingUser });
        throw new AuthenticationError('User already exists');
    }
    
    const salt = await bcrypt.genSalt(saltRounds);
    const hash = await bcrypt.hash(user.password, salt);
    const id = await insertUser({ ...user, password: hash });
    return id;
}

/**
 * Login a user
 */
export async function login(
    email: string,
    password: string
): Promise<TokenResponse> {
    const user = await getUserByEmail(email);
    console.log('user login', user, { email, password });
    
    if (!user || !await bcrypt.compare(password, user.password)) {
        throw new AuthenticationError('Invalid password');
    }
    
    return generateToken({userId: user.id, permissions: user.permissions});
}

/**
 * Validate an API key
 */
export function validateApiKey(apiKey: string): ApiKey | null {
    const storedApiKey = EXPECTED_API_KEY.find(k => k.key === apiKey);
    if (storedApiKey === undefined) {
        throw new Error('Invalid API key');
    }
    return storedApiKey;
}

/**
 * Generate a JWT token
 */
export function generateToken(
    {userId, permissions}: Partial<ApiKey>,
    expiresIn: string = '60d'
): TokenResponse {
    const payload: JwtPayload = {
        permissions: permissions ?? [],
        userId: userId ?? ''
    };
    
    const token = jwt.sign(payload, SECRET_KEY, { expiresIn });
    console.log(token);
    
    return { token, expiresIn };
}


/**
 * Middleware to validate JWT tokens
 */
export const validateToken = (requiredPermissions: string[] = []) => {
    return (req: FastifyRequest, res: FastifyReply, next: () => void) => {
        console.log(requiredPermissions);
        console.log(req.headers);
        
        const authHeader = req.headers.authorization;
        
        if (authHeader) {
            try {
                const user = jwt.verify(authHeader, SECRET_KEY) as JwtPayload;
                console.log({ user, requiredPermissions });
                
                if (requiredPermissions.some(p => !user.permissions.includes(p))) {
                    throw new AuthenticationError('Unauthorized');
                }
                
                (req as any).user = user;
                (req as any).isAdmin = user.permissions.includes('admin');
                next();
            } catch (error) {
                throw new AuthenticationError('Invalid token');
            }
        } else if (requiredPermissions.length === 0) {
            next();
        } else {
            throw new AuthenticationError('No token provided');
        }
    };
}; 