import { describe, expect, it } from 'vitest'
import { restoreMultiSelectAnswer } from '@/app/utils/optionAnswer'

describe('restoreMultiSelectAnswer', () => {
  it('restores existing simple comma-separated selections', () => {
    expect(
      restoreMultiSelectAnswer('Option A, Option C', ['Option A', 'Option B', 'Option C']),
    ).toEqual({
      matched: ['Option A', 'Option C'],
      unmatched: [],
    })
  })

  it('matches a comma-containing label and a normal label', () => {
    expect(
      restoreMultiSelectAnswer('Budapest, Hungary, Vienna', [
        'Budapest, Hungary',
        'Vienna',
        'Bratislava',
      ]),
    ).toEqual({ matched: ['Budapest, Hungary', 'Vienna'], unmatched: [] })
  })

  it('restores a single selected label containing commas', () => {
    expect(restoreMultiSelectAnswer('Washington, D.C., USA', ['Washington, D.C., USA'])).toEqual({
      matched: ['Washington, D.C., USA'],
      unmatched: [],
    })
  })

  it('matches markdown labels by their stored value', () => {
    expect(
      restoreMultiSelectAnswer('**Budapest, Hungary**, Vienna', [
        '**Budapest, Hungary**',
        'Vienna',
      ]),
    ).toEqual({ matched: ['**Budapest, Hungary**', 'Vienna'], unmatched: [] })
  })

  it('keeps unmatched text separate from matched labels for custom input restoration', () => {
    expect(
      restoreMultiSelectAnswer('Budapest, Hungary, Custom integration', [
        'Budapest, Hungary',
        'Vienna',
      ]),
    ).toEqual({ matched: ['Budapest, Hungary'], unmatched: ['Custom integration'] })
  })

  it('prefers fewer, longer labels for ambiguous legacy answers', () => {
    expect(
      restoreMultiSelectAnswer('Budapest, Hungary, Vienna', [
        'Budapest',
        'Hungary',
        'Vienna',
        'Budapest, Hungary',
      ]),
    ).toEqual({ matched: ['Budapest, Hungary', 'Vienna'], unmatched: [] })
  })

  it('returns unmatched legacy parts when no option values match', () => {
    expect(restoreMultiSelectAnswer('Custom one, Custom two', ['Option A', 'Option B'])).toEqual({
      matched: [],
      unmatched: ['Custom one', 'Custom two'],
    })
  })
})
