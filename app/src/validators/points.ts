import { z } from "zod";

export const buyRepsSchema = z.object({
  reputationPoints: z.number().min(5).max(1000),
});

export type BuyRepsSchema = z.infer<typeof buyRepsSchema>;

export const searchPaypalTransactionSchema = z
  .object({
    transactionId: z.string().min(4).max(255),
    transactionDate: z.date(),
  })
  .strict()
  .required();

export type SearchPaypalTransactionSchema = z.infer<
  typeof searchPaypalTransactionSchema
>;
