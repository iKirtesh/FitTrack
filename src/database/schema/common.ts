import { integer, text } from 'drizzle-orm/sqlite-core';

/** UUID text primary key. Generated in the app, never by the database. */
export const pk = () => text('id').primaryKey();

/** Epoch milliseconds, UTC. */
export const createdAt = () => integer('created_at').notNull();
export const updatedAt = () => integer('updated_at').notNull();

/** Local calendar day as YYYY-MM-DD in the user's timezone at write time. */
export const day = (name: string) => text(name);
