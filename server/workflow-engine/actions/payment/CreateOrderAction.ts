/**
 * CREATE ORDER ACTION
 * Crée une commande pour la vente de produits
 */

import { z } from "zod";
import type { ActionHandler, ActionResult } from "../../types";
import type { FinalExecutionContext } from "../../structured-types";
import { Logger } from "../../utils/Logger";
import { OrderService } from "../../../services/orderService";

/** Type d'un article de commande — aligné avec OrderService.createOrder */
interface OrderItem {
  productId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

// Schéma d'un article de commande (avec valeurs par défaut pour la flexibilité)
const OrderItemSchema = z.object({
  productId: z.string().optional(),
  name: z.string().default('Produit'),
  quantity: z.number().positive().default(1),
  unitPrice: z.number().nonnegative().default(0),
  // Alias pour compatibilité avec les configs existantes
  price: z.number().nonnegative().optional(),
});

// Configuration structurée
const CreateOrderConfigSchema = z.object({
  prospect_id: z.number().optional(),
  items: z.array(OrderItemSchema).optional(),
  product_name: z.string().optional(),
  quantity: z.number().optional(),
  unit_price: z.number().optional(),
  total: z.number().optional(),
  reference: z.string().optional(),
  currency: z.string().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
type CreateOrderConfig = z.infer<typeof CreateOrderConfigSchema>;

export class CreateOrderAction implements ActionHandler<CreateOrderConfig, FinalExecutionContext, unknown> {
  name = 'create_order';
  private logger = new Logger('CreateOrderAction');

  async execute(
    context: FinalExecutionContext,
    config: CreateOrderConfig
  ): Promise<ActionResult<unknown>> {
    try {
      const prospectId: number | undefined =
        config.prospect_id ?? context.variables.prospect?.id;

      // Construction des items de commande avec types stricts
      const rawItems = config.items ?? [];
      const items: OrderItem[] = rawItems.length > 0
        ? rawItems.map(item => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice ?? item.price ?? 0,
          }))
        : [
            {
              name: config.product_name ?? 'Produit par défaut',
              quantity: config.quantity ?? 1,
              unitPrice: config.unit_price ?? config.total ?? 0,
            }
          ];

      if (items.length === 0) {
        throw new Error('No items provided for order');
      }

      const totalAmount = config.total ?? this.calculateTotal(items);
      const orderNumber = config.reference ?? `ORD-${Date.now()}`;

      const order = await OrderService.createOrder({
        tenantId: context.tenant.id,
        prospectId,
        orderNumber,
        items,
        totalAmount,
        currency: config.currency ?? 'EUR',
        status: config.status ?? 'pending',
        notes: config.notes,
        metadata: {
          workflow_id: context.workflow.id,
          workflow_execution_id: context.event.id,
          source: 'workflow_action',
          ...(config.metadata ?? {}),
        }
      });

      // Stocker la commande dans le contexte
      context.variables['order'] = order;
      context.variables['order_id'] = (order as { id?: unknown }).id;
      context.variables['order_number'] = (order as { orderNumber?: unknown }).orderNumber;
      context.variables['order_total'] = (order as { totalAmount?: unknown }).totalAmount;

      this.logger.info('Order created and saved', {
        order_number: (order as { orderNumber?: unknown }).orderNumber,
        total_amount: (order as { totalAmount?: unknown }).totalAmount,
        tenant: context.tenant.id
      });

      return { success: true, data: order };
    } catch (error: unknown) {
      this.logger.error('Failed to create order', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private calculateTotal(items: OrderItem[]): number {
    return items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
  }

  validate(config: Record<string, unknown>): boolean {
    const items = config['items'];
    if (items !== undefined) {
      return Array.isArray(items) && items.length > 0;
    }
    // items peut venir de product_name/quantity/unit_price
    return true;
  }
}
