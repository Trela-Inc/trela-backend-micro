import express from 'express';
import { createAuthController } from '../../factories/AuthFactory';

const router = express.Router();
const controller = createAuthController();

router.post('/login', (req, res) => controller.login(req, res));

export default router;