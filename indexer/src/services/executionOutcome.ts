import { Knex } from 'knex';
import { types } from 'near-lake-framework';

import retry from '#libs/retry';
import { jsonStringify, mapExecutionStatus } from '#libs/utils';
import { ExecutionOutcome, ExecutionOutcomeReceipt } from '#ts/types';

export const storeExecutionOutcomes = async (
  knex: Knex,
  message: types.StreamerMessage,
) => {
  await Promise.all(
    message.shards.map(async (shard) => {
      await storeChunkExecutionOutcomes(
        knex,
        shard.shardId,
        message.block.header.timestampNanosec,
        shard.receiptExecutionOutcomes,
      );
    }),
  );
};

export const storeChunkExecutionOutcomes = async (
  knex: Knex,
  shardId: number,
  blockTimestamp: string,
  executionOutcomes: types.ExecutionOutcomeWithReceipt[],
) => {
  const outcomes: ExecutionOutcome[] = [];
  const outcomeReceipts: ExecutionOutcomeReceipt[] = [];

  executionOutcomes.forEach(async (executionOutcome, indexInChunk) => {
    outcomes.push(
      getExecutionOutcomeData(
        shardId,
        blockTimestamp,
        indexInChunk,
        executionOutcome,
      ),
    );

    const executionOutcomeReceipts =
      executionOutcome.executionOutcome.outcome.receiptIds.map(
        (receiptId, receiptIndex) =>
          getExecutionOutcomeReceiptData(
            executionOutcome.executionOutcome.id,
            receiptId,
            receiptIndex,
          ),
      );

    outcomeReceipts.push(...executionOutcomeReceipts);
  });

  if (outcomes.length) {
    await retry(async () => {
      await knex('execution_outcomes')
        .insert(outcomes)
        .onConflict('receipt_id')
        .ignore();
    });
  }

  if (outcomeReceipts.length) {
    await retry(async () => {
      await knex('execution_outcome_receipts')
        .insert(outcomeReceipts)
        .onConflict([
          'executed_receipt_id',
          'index_in_execution_outcome',
          'produced_receipt_id',
        ])
        .ignore();
    });
  }
};

const getExecutionOutcomeData = (
  shardId: number,
  blockTimestamp: string,
  indexInChunk: number,
  outcome: types.ExecutionOutcomeWithReceipt,
): ExecutionOutcome => ({
  executed_in_block_hash: outcome.executionOutcome.blockHash,
  executed_in_block_timestamp: blockTimestamp,
  index_in_chunk: indexInChunk,
  receipt_id: outcome.executionOutcome.id,
  gas_burnt: outcome.executionOutcome.outcome.gasBurnt,
  tokens_burnt: outcome.executionOutcome.outcome.tokensBurnt,
  executor_account_id: outcome.executionOutcome.outcome.executorId,
  status: mapExecutionStatus(outcome.executionOutcome.outcome.status),
  shard_id: shardId,
  logs: jsonStringify(outcome.executionOutcome.outcome.logs),
});

const getExecutionOutcomeReceiptData = (
  executedReceipt: string,
  producedReceipt: string,
  receiptIndex: number,
): ExecutionOutcomeReceipt => ({
  executed_receipt_id: executedReceipt,
  index_in_execution_outcome: receiptIndex,
  produced_receipt_id: producedReceipt,
});
