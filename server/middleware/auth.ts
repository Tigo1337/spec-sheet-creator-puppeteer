/**
 * Authentication and authorization middleware/helpers
 * Provides admin verification and AI credit management functions
 */

import { clerkClient } from "@clerk/express";
import { storage } from "../storage";

/**
 * Check if a user has admin privileges
 * Checks both environment variable and Clerk user metadata
 */
export async function checkAdmin(userId: string): Promise<boolean> {
  if (process.env.ADMIN_USER_ID && process.env.ADMIN_USER_ID.trim().length > 0 && userId === process.env.ADMIN_USER_ID) {
    return true;
  }
  try {
    const user = await clerkClient.users.getUser(userId);
    return user.publicMetadata?.role === "admin";
  } catch (error) {
    console.error("Failed to verify admin role:", error);
    return false;
  }
}

/**
 * Check if user has sufficient AI credits and deduct them
 * Handles monthly credit reset logic
 */
export async function checkAndDeductAiCredits(userId: string, costCents: number): Promise<boolean> {
  const user = await storage.getUser(userId);
  if (!user) return false;

  let currentCredits = user.aiCredits || 0;
  const lastReset = user.aiCreditsResetDate ? new Date(user.aiCreditsResetDate) : new Date(0);
  const now = new Date();
  const oneDay = 1000 * 60 * 60 * 24;
  const daysSinceReset = (now.getTime() - lastReset.getTime()) / oneDay;

  if (daysSinceReset >= 30) {
    const limit = user.aiCreditsLimit || 0;
    currentCredits = limit;
    if (currentCredits < costCents) return false;
    await storage.updateUser(userId, { aiCredits: currentCredits - costCents, aiCreditsResetDate: now });
    return true;
  }

  if (currentCredits < costCents) return false;
  await storage.updateUser(userId, { aiCredits: currentCredits - costCents });
  return true;
}
