import type { Express, Request, Response } from "express";
import express from "express";
import * as db from "./db";

/**
 * Stripe webhook handler.
 * Must be registered BEFORE body parsers because Stripe requires the raw body.
 * 
 * Required env vars:
 * - STRIPE_SECRET_KEY: Stripe secret API key
 * - STRIPE_WEBHOOK_SECRET: Webhook signing secret from Stripe dashboard
 */
export function setupStripeWebhook(app: Express) {
  app.post("/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!stripeKey || !webhookSecret) {
        console.warn("[Stripe] Webhook not configured - skipping");
        res.status(200).send("Webhook not configured");
        return;
      }

      try {
        const { default: Stripe } = await import("stripe");
        const stripe = new Stripe(stripeKey);
        const sig = req.headers["stripe-signature"];

        if (!sig) {
          res.status(400).send("Missing stripe-signature header");
          return;
        }

        const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

        switch (event.type) {
          case "checkout.session.completed": {
            const session = event.data.object as any;
            const userId = Number(session.metadata?.userId);
            if (!Number.isInteger(userId) || userId <= 0) {
              console.warn(`[Stripe] Invalid userId in checkout.session.completed: ${session.metadata?.userId}`);
              break;
            }
            // Validate user exists before upgrading
            const targetUser = await db.getUserById(userId);
            if (!targetUser) {
              console.warn(`[Stripe] User ${userId} not found in database for checkout.session.completed`);
              break;
            }
            {
              // Retrieve subscription to get the actual current_period_end
              let premiumUntil: Date;
              if (session.subscription) {
                const subscription = await stripe.subscriptions.retrieve(session.subscription as string) as any;
                premiumUntil = new Date(subscription.current_period_end * 1000);
              } else {
                // One-time payment fallback: use plan interval from metadata
                const interval = session.metadata?.planInterval;
                premiumUntil = new Date();
                if (interval === "month") {
                  premiumUntil.setMonth(premiumUntil.getMonth() + 1);
                } else {
                  premiumUntil.setFullYear(premiumUntil.getFullYear() + 1);
                }
              }
              await db.updateUserProfile(userId, {
                isPremium: true,
                premiumUntil,
                readReceipts: true,
                profileBoostsRemaining: 5,
              } as any);
              console.log(`[Stripe] User ${userId} upgraded to premium until ${premiumUntil.toISOString()}`);
            }
            break;
          }

          case "customer.subscription.updated": {
            const subscription = event.data.object as any;
            let userId = Number(subscription.metadata?.userId);
            // Fallback: look up user by Stripe customer email if metadata is missing
            if ((!Number.isInteger(userId) || userId <= 0) && subscription.customer) {
              try {
                const customer = await stripe.customers.retrieve(subscription.customer as string) as any;
                if (customer.email) {
                  const foundUser = await db.getUserByEmail(customer.email);
                  if (foundUser) userId = foundUser.id;
                }
              } catch { /* ignore lookup failure */ }
            }
            if (Number.isInteger(userId) && userId > 0 && subscription.current_period_end) {
              const premiumUntil = new Date(subscription.current_period_end * 1000);
              await db.updateUserProfile(userId, {
                isPremium: subscription.status === "active",
                premiumUntil,
              } as any);
              console.log(`[Stripe] User ${userId} subscription updated, active=${subscription.status === "active"}`);
            }
            break;
          }

          case "customer.subscription.deleted": {
            const subscription = event.data.object as any;
            let userId = Number(subscription.metadata?.userId);
            // Fallback: look up user by Stripe customer email if metadata is missing
            if ((!Number.isInteger(userId) || userId <= 0) && subscription.customer) {
              try {
                const customer = await stripe.customers.retrieve(subscription.customer as string) as any;
                if (customer.email) {
                  const foundUser = await db.getUserByEmail(customer.email);
                  if (foundUser) userId = foundUser.id;
                }
              } catch { /* ignore lookup failure */ }
            }
            if (Number.isInteger(userId) && userId > 0) {
              await db.updateUserProfile(userId, {
                isPremium: false,
                premiumUntil: null,
              } as any);
              console.log(`[Stripe] User ${userId} subscription cancelled`);
            }
            break;
          }

          case "invoice.payment_failed": {
            const invoice = event.data.object as any;
            console.warn(`[Stripe] Payment failed for customer ${invoice.customer}`);
            break;
          }
        }

        res.status(200).json({ received: true });
      } catch (err: any) {
        console.error("[Stripe] Webhook error:", err.message);
        res.status(400).send("Webhook processing error");
      }
    }
  );
}
