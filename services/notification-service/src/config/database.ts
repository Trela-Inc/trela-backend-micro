import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../models/schema';

const connectionString = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/notification_db';

// Create the connection
const client = postgres(connectionString);

// Create the database instance
export const db = drizzle(client, { schema });

export default db; 