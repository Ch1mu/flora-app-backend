import { BadRequestException } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';

export const paymentMethodValues = ['Efectivo', 'Debito', 'Credito', 'Transferencia', 'Mercado Pago'] as const;
export type ApiPaymentMethod = (typeof paymentMethodValues)[number];

export function toPrismaPaymentMethod(value: string): PaymentMethod {
  if (value === 'Mercado Pago') return PaymentMethod.Mercado_Pago;
  if (Object.values(PaymentMethod).includes(value as PaymentMethod)) return value as PaymentMethod;
  throw new BadRequestException('paymentMethod invalido');
}

export function fromPrismaPaymentMethod(value: PaymentMethod): string {
  return value === PaymentMethod.Mercado_Pago ? 'Mercado Pago' : value;
}
