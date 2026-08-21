const ANSWER_DELIMITER = ', '

export interface RestoredMultiSelectAnswer {
  matched: string[]
  unmatched: string[]
}

interface ExactMatch {
  values: string[]
  lengths: number[]
}

function compareExactMatches(a: ExactMatch, b: ExactMatch): number {
  if (a.values.length !== b.values.length) return a.values.length - b.values.length

  for (let index = 0; index < a.lengths.length; index++) {
    const lengthDifference = b.lengths[index]! - a.lengths[index]!
    if (lengthDifference !== 0) return lengthDifference
  }

  return 0
}

function findExactMatch(answer: string, optionValues: readonly string[]): string[] | undefined {
  const values = [...new Set(optionValues)].filter(Boolean).sort((a, b) => b.length - a.length)
  const memo = new Map<number, ExactMatch | null>()

  function findFrom(offset: number): ExactMatch | null {
    if (offset === answer.length) return { values: [], lengths: [] }

    const cached = memo.get(offset)
    if (cached !== undefined) return cached

    let best: ExactMatch | null = null
    for (const value of values) {
      if (!answer.startsWith(value, offset)) continue

      const nextOffset = offset + value.length
      if (nextOffset !== answer.length && !answer.startsWith(ANSWER_DELIMITER, nextOffset)) continue

      const remainder = findFrom(
        nextOffset === answer.length ? nextOffset : nextOffset + ANSWER_DELIMITER.length,
      )
      if (!remainder) continue

      const candidate: ExactMatch = {
        values: [value, ...remainder.values],
        lengths: [value.length, ...remainder.lengths],
      }
      if (!best || compareExactMatches(candidate, best) < 0) best = candidate
    }

    memo.set(offset, best)
    return best
  }

  return findFrom(0)?.values
}

/**
 * Restores legacy multi-select answers that were persisted as comma-separated text.
 * Exact known-label segmentations win; this favors fewer, longer labels when the
 * delimiter also appears in an option value.
 */
export function restoreMultiSelectAnswer(
  answer: string,
  optionValues: readonly string[],
): RestoredMultiSelectAnswer {
  const exactMatch = findExactMatch(answer, optionValues)
  if (exactMatch) return { matched: exactMatch, unmatched: [] }

  const matched: string[] = []
  const unmatched: string[] = []
  const values = [...new Set(optionValues)].filter(Boolean).sort((a, b) => b.length - a.length)
  let offset = 0

  while (offset < answer.length) {
    const value = values.find((candidate) => {
      if (!answer.startsWith(candidate, offset)) return false
      const nextOffset = offset + candidate.length
      return nextOffset === answer.length || answer.startsWith(ANSWER_DELIMITER, nextOffset)
    })

    if (value) {
      matched.push(value)
      offset += value.length
    } else {
      const delimiterIndex = answer.indexOf(ANSWER_DELIMITER, offset)
      const end = delimiterIndex === -1 ? answer.length : delimiterIndex
      unmatched.push(answer.slice(offset, end))
      offset = end
    }

    if (answer.startsWith(ANSWER_DELIMITER, offset)) {
      offset += ANSWER_DELIMITER.length
    }
  }

  return { matched, unmatched: unmatched.filter(Boolean) }
}
