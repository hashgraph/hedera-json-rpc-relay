export function contractResultsByNumberByIndex(number: number, index: number) {
  return `contracts/results?block.number=${number}&transaction.index=${index}&limit=100&order=asc`;
}

export function contractResultsByHashByIndex(hash: string, index: number) {
  return `contracts/results?block.hash=${hash}&transaction.index=${index}&limit=100&order=asc`;
}
