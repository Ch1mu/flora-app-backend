import { BadRequestException } from '@nestjs/common';
import { PaymentMethod } from '@prisma/client';

export const paymentMethodValues = [
  'Efectivo',
  'Debito Flora',
  'Debito Diego',
  'Transf. Flora',
  'Transf. Diego',
  'Transf. Florencia',
] as const;
export type ApiPaymentMethod = (typeof paymentMethodValues)[number];

export function toPrismaPaymentMethod(value: string): PaymentMethod {
  const mapped = paymentMethodMap[value as ApiPaymentMethod];
  if (mapped) return mapped;
  throw new BadRequestException('paymentMethod invalido');
}

export function fromPrismaPaymentMethod(value: PaymentMethod): string {
  return reversePaymentMethodMap[value] ?? value;
}

const paymentMethodMap: Record<ApiPaymentMethod, PaymentMethod> = {
  Efectivo: PaymentMethod.Efectivo,
  'Debito Flora': PaymentMethod.Debito_Flora,
  'Debito Diego': PaymentMethod.Debito_Diego,
  'Transf. Flora': PaymentMethod.Transf_Flora,
  'Transf. Diego': PaymentMethod.Transf_Diego,
  'Transf. Florencia': PaymentMethod.Transf_Florencia,
};

const reversePaymentMethodMap: Partial<Record<PaymentMethod, string>> = {
  [PaymentMethod.Efectivo]: 'Efectivo',
  [PaymentMethod.Debito]: 'Debito',
  [PaymentMethod.Credito]: 'Credito',
  [PaymentMethod.Transferencia]: 'Transferencia',
  [PaymentMethod.Mercado_Pago]: 'Mercado Pago',
  [PaymentMethod.Debito_Flora]: 'Debito Flora',
  [PaymentMethod.Debito_Diego]: 'Debito Diego',
  [PaymentMethod.Transf_Flora]: 'Transf. Flora',
  [PaymentMethod.Transf_Diego]: 'Transf. Diego',
  [PaymentMethod.Transf_Florencia]: 'Transf. Florencia',
};
