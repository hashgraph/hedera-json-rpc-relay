export function contractResultsByNumberByIndexURL(number: number, index: number) {
  return `contracts/results?block.number=${number}&transaction.index=${index}&limit=100&order=asc`;
}

export function contractResultsByHashByIndexURL(hash: string, index: number) {
  return `contracts/results?block.hash=${hash}&transaction.index=${index}&limit=100&order=asc`;
}

export function balancesByAccountIdByTimestampURL(id: string, timestamp?: string) {
  return `balances?account.id=${id}${timestamp ? `&timestamp=${timestamp}` : ''}`;
}
