export function contractResultsByNumberByIndexURL(number: number, index: number): string {
  return `contracts/results?block.number=${number}&transaction.index=${index}&limit=100&order=asc`;
}

export function contractResultsByHashByIndexURL(hash: string, index: number): string {
  return `contracts/results?block.hash=${hash}&transaction.index=${index}&limit=100&order=asc`;
}

export function balancesByAccountIdByTimestampURL(id: string, timestamp?: string): string {
  const timestampQuery = timestamp ? `&timestamp=${timestamp}` : '';
  return `balances?account.id=${id}${timestampQuery}`;
}
