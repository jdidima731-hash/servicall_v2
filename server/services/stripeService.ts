/**
 * Stripe Service - Facturation SaaS
 * Module 10: Facturation SaaS
 * ✅ BLOC 9: Lazy initialization
 */

import Stripe from "stripe";
import { logger } from "../infrastructure/logger";

let _stripe: Stripe | null = null;

/**
 * Lazy initialization of Stripe client
 */
export function getStripeClient(): Stripe {
  if (!_stripe) {
    // ✅ FIX TS2345: Utiliser ?? '' pour éviter l'erreur (string | undefined non assignable à string)
    const apiKey = process.env['STRIPE_SECRET_KEY'] ?? '';
    _stripe = new Stripe(apiKey, {
      apiVersion: "2026-02-25.clover",
    });
    logger.info("[Stripe] Client initialized");
  }
  return _stripe;
}

// ============================================
// CUSTOMER MANAGEMENT
// ============================================

/**
 * Create Stripe customer
 */
export async function createStripeCustomer(
  email: string,
  name: string,
  tenantId: number,
  metadata?: Record<string, string>
): Promise<string> {
  try {
    const stripe = getStripeClient();
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        tenantId: tenantId.toString(),
        ...metadata,
      },
    });

    return customer.id;
  } catch (error: unknown) {
    logger.error("[Stripe Service] Error creating customer:", error);
    throw new Error("Failed to create Stripe customer");
  }
}

/**
 * Update Stripe customer
 */
export async function updateStripeCustomer(
  customerId: string,
  data: {
    email?: string;
    name?: string;
    metadata?: Record<string, string>;
  }
): Promise<void> {
  try {
    const stripe = getStripeClient();
    await stripe.customers.update(customerId, data);
  } catch (error: unknown) {
    logger.error("[Stripe Service] Error updating customer:", error);
    throw new Error("Failed to update Stripe customer");
  }
}

/**
 * Get Stripe customer
 */
export async function getStripeCustomer(customerId: string): Promise<Stripe.Customer> {
  try {
    const stripe = getStripeClient();
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      throw new Error("Customer has been deleted");
    }
    return customer as Stripe.Customer;
  } catch (error: unknown) {
    logger.error("[Stripe Service] Error retrieving customer:", error);
    throw new Error("Failed to retrieve Stripe customer");
  }
}

// ============================================
// SUBSCRIPTION MANAGEMENT
// ============================================

export interface SubscriptionPlan {
  id: string;
  name: string;
  priceId: string;
  amount: number;
  currency: string;
  interval: "month" | "year";
  features: {
    agentSeats: number;
    callsIncluded: number;
    smsIncluded: number;
    recordingStorage: string;
    aiFeatures: boolean;
    customBranding: boolean;
    apiAccess: boolean;
  };
}

export const SUBSCRIPTION_PLANS: Record<string, SubscriptionPlan> = {
  starter: {
    id: "starter",
    name: "Starter",
    priceId: process.env["STRIPE_PRICE_STARTER"] ?? "price_starter",
    amount: 4900, // 49.00 EUR
    currency: "eur",
    interval: "month",
    features: {
      agentSeats: 3,
      callsIncluded: 500,
      smsIncluded: 100,
      recordingStorage: "10 GB",
      aiFeatures: false,
      customBranding: false,
      apiAccess: false,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceId: process.env["STRIPE_PRICE_PRO"] ?? "price_pro",
    amount: 14900, // 149.00 EUR
    currency: "eur",
    interval: "month",
    features: {
      agentSeats: 10,
      callsIncluded: 2000,
      smsIncluded: 500,
      recordingStorage: "50 GB",
      aiFeatures: true,
      customBranding: true,
      apiAccess: true,
    },
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    priceId: process.env["STRIPE_PRICE_ENTERPRISE"] ?? "price_enterprise",
    amount: 49900, // 499.00 EUR
    currency: "eur",
    interval: "month",
    features: {
      agentSeats: 50,
      callsIncluded: 10000,
      smsIncluded: 2000,
      recordingStorage: "Illimité",
      aiFeatures: true,
      customBranding: true,
      apiAccess: true,
    },
  },
};

/**
 * Create Stripe subscription
 */
export async function createStripeSubscription(
  customerId: string,
  priceId: string,
  tenantId: number
): Promise<{ subscriptionId: string; clientSecret: string }> {
  try {
    const stripe = getStripeClient();
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice?.payment_intent"],
      metadata: {
        tenantId: tenantId.toString(),
      },
    });

    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = (invoice as unknown)?.payment_intent as Stripe.PaymentIntent;

    return {
      subscriptionId: subscription.id,
      clientSecret: paymentIntent?.client_secret ?? "",
    };
  } catch (error: unknown) {
    logger.error("[Stripe Service] Error creating subscription:", error);
    throw new Error("Failed to create Stripe subscription");
  }
}

/**
 * Update Stripe subscription
 */
export async function updateStripeSubscription(
  subscriptionId: string,
  priceId: string
): Promise<void> {
  try {
    const stripe = getStripeClient();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0]!.id,
          price: priceId,
        },
      ],
      proration_behavior: "always_invoice",
    });
  } catch (error: unknown) {
    logger.error("[Stripe Service] Error updating subscription:", error);
    throw new Error("Failed to update Stripe subscription");
  }
}

/**
 * Cancel Stripe subscription
 */
export async function cancelStripeSubscription(
  subscriptionId: string,
  immediately: boolean = false
): Promise<void> {
  try {
    const stripe = getStripeClient();
    if (immediately) {
      await stripe.subscriptions.cancel(subscriptionId);
    } else {
      await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true,
      });
    }
  } catch (error: unknown) {
    logger.error("[Stripe Service] Error canceling subscription:", error);
    throw new Error("Failed to cancel Stripe subscription");
  }
}

/**
 * Reactivate cancelled subscription
 */
export async function reactivateStripeSubscription(
  subscriptionId: string
): Promise<void> {
  try {
    const stripe = getStripeClient();
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false,
    });
  } catch (error: unknown) {
    logger.error("[Stripe Service] Error reactivating subscription:", error);
    throw new Error("Failed to reactivate Stripe subscription");
  }
}

/**
 * Get subscription details
 */
export async function getSubscriptionDetails(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  try {
    const stripe = getStripeClient();
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch (error: unknown) {
    logger.error("[Stripe Service] Error retrieving subscription:", error);
    throw new Error("Failed to retrieve subscription details");
  }
}

// ============================================
// INVOICE MANAGEMENT
// ============================================

/**
 * Create invoice
 */
export async function createStripeInvoice(
  customerId: string,
  items: Array<{
    description: string;
    amount: number;
    quantity: number;
  }>
): Promise<{ invoiceId: string; invoiceUrl: string }> {
  try {
    const stripe = getStripeClient();
    // Create invoice items
    for (const item of items) {
      await stripe.invoiceItems.create({
        customer: customerId,
        amount: item.amount,
        currency: "eur",
        description: item.description,
        quantity: item.quantity,
      });
    }

    // Create and finalize invoice
    const invoice = await stripe.invoices.create({
      customer: customerId,
      auto_advance: true,
      collection_method: "charge_automatically",
    });

    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

    return {
      invoiceId: finalizedInvoice.id,
      invoiceUrl: finalizedInvoice.hosted_invoice_url ?? "",
    };
  } catch (error: unknown) {
    logger.error("[Stripe Service] Error creating invoice:", error);
    throw new Error("Failed to create Stripe invoice");
  }
}

/**
 * Get invoice
 */
export async function getStripeInvoice(invoiceId: string): Promise<Stripe.Invoice> {
  try {
    const stripe = getStripeClient();
    return await stripe.invoices.retrieve(invoiceId);
  } catch (error: unknown) {
    logger.error("[Stripe Service] Error retrieving invoice:", error);
    throw new Error("Failed to retrieve invoice");
  }
}

/**
 * Get invoice PDF
 */
export async function getInvoicePDF(invoiceId: string): Promise<string> {
  try {
    const stripe = getStripeClient();
    const invoice = await stripe.invoices.retrieve(invoiceId);
    return invoice.invoice_pdf ?? "";
  } catch (error: unknown) {
    logger.error("[Stripe Service] Error getting invoice PDF:", error);
    throw new Error("Failed to get invoice PDF");
  }
}

/**
 * List invoices for customer
 */
export async function listCustomerInvoices(
  customerId: string,
  limit: number = 10
): Promise<Stripe.Invoice[]> {
  try {
    const stripe = getStripeClient();
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit,
    });
    return invoices.data;
  } catch (error: unknown) {
    logger.error("[Stripe Service] Error listing invoices:", error);
    throw new Error("Failed to list invoices");
  }
}

/**
 * Create Stripe Customer Portal session
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  try {
    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
    return session.url;
  } catch (error: unknown) {
    logger.error("[Stripe Service] Error creating portal session:", error);
    throw new Error("Failed to create Stripe portal session");
  }
}

/**
 * Create a Stripe Payment Link for a specific plan
 * ✅ Bloc 6: Monétisation active
 */
export async function createPaymentLink(
  priceId: string,
  tenantId: number,
  successUrl: string,
  cancelUrl: string
): Promise<string> {
  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        tenantId: tenantId.toString(),
      },
    });

    return session.url ?? "";
  } catch (error: unknown) {
    logger.error("[Stripe Service] Error creating payment link:", error);
    throw new Error("Failed to create payment link");
  }
}
