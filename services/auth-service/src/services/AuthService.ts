import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { UserModel } from '../models/User';
import dotenv from 'dotenv';

dotenv.config();

export class AuthService {
  async login(email: string, password: string): Promise<string> {
    const user = await UserModel.findOne({ email });

    if (!user) throw new Error('User not found');

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) throw new Error('Invalid password');

    const payload = { id: user._id, email: user.email, role: user.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET as string, {
      expiresIn: '1h',
    });

    return token;
  }
}