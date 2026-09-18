import { Router } from 'express';
import { ordersDal } from '../dal/orders-dal.js';
import { ordersService } from '../services/orders-service.js';
import { validateCreateOrderBody } from '../lib/validate-order.js';

export const ordersRouter = Router();

ordersRouter.get('/', (req, res) => {
  const orders = ordersDal.listByMerchant(req.merchantId!, {
    from: typeof req.query.from === 'string' ? req.query.from : undefined,
    to: typeof req.query.to === 'string' ? req.query.to : undefined,
    limit: typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined,
  });
  res.json({ orders });
});

ordersRouter.get('/:id', (req, res) => {
  const order = ordersDal.getById(req.merchantId!, req.params.id);
  if (!order) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ order });
});

ordersRouter.post('/', (req, res) => {
  const input = validateCreateOrderBody(req.body);
  if (!input.ok) {
    res.status(400).json({ error: 'invalid_body' });
    return;
  }
  // The service writes the order and, for a subscribed merchant, its outbox event in one transaction.
  const order = ordersService.createOrder(req.merchantId!, input.value);
  res.status(201).json({ order });
});
