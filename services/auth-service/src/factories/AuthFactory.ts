import { AuthService } from '../services/AuthService';
import { AuthController } from '../controllers/AuthController';

export const createAuthController = () => {
  const service = new AuthService();
  return new AuthController(service);
};