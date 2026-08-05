import type { OptionsMessagePayload } from '@/types/api/schemas'
import { OptionsUIControlType } from '@/types/enums'
import type OptionsMessage from '@/app/components/chat/OptionsMessage.vue'
import type { Scenario } from '@/app/dev/fixtures/scenario'

type OptionsMessageProps = InstanceType<typeof OptionsMessage>['$props']

export const SAMPLE_IMAGE_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPAAAACWCAIAAABvmpKCAAABTUlEQVR42u3SMQ2AMABFwQYBzEhoEICaLthgrBScsZN0QQA2fpq7PAmvrK1Ftfcrqme8UX33GVU9tqiWAhMxNIYGQ4OhwdAYGgwNhgZDg6ExNBgaDA2GBkNjaDA0GBoMDYbG0GBoMDQYGgyNocHQYGgwNBgaQ4OhwdBgaDA0hgZDg6HB0BgaDA2GBkODoTE0GBoMDYYGQ2NoMDQYGgwNhsbQYGgwNBgaDI2hwdBgaDA0GBpDg6HB0GBoMDSGBkODocHQYGgMDYYGQ4OhMTQYGgwNhgZDY2gwNBgaDA2GxtBgaDA0GBoMjaHB0GBoMDQYGkODocHQYGgwNIYGQ4OhwdBgaAwNhgZDg6ExNBgaDA2GBkNjaDA0GBoMDYbG0GBoMDQYGgyNocHQYGgwNBgaQ4OhwdBgaDA0hgZDg6HB0GBoDA2GBkODocHQGBpy/czeVSpVVH4NAAAAAElFTkSuQmCC'

const RADIO_DEFAULTS = {
  MultiSelectEnabled: false,
  IsPlainTextEnabled: false,
  UIControlType: OptionsUIControlType.RadioButton,
}

interface OptionsFixture {
  id: string
  title: string
  payload: OptionsMessagePayload
  answer: string
  answeredHint?: string
}

const fixtures: OptionsFixture[] = [
  {
    id: 'single-markdown',
    title: 'Single-select — markdown labels',
    payload: {
      ...RADIO_DEFAULTS,
      Text: 'Which **deployment target** should we use?',
      Items: [
        { Key: 'k1', Value: '**Production** — live traffic' },
        { Key: 'k2', Value: 'Staging with `NUXT_PROXY_TARGET` override' },
        { Key: 'k3', Value: '*Local only* — no external calls' },
        { Key: 'k4', Value: 'Plain label, no markup' },
      ],
    },
    answer: 'Staging with `NUXT_PROXY_TARGET` override',
  },
  {
    id: 'single-link',
    title: 'Single-select — link inside a label',
    payload: {
      ...RADIO_DEFAULTS,
      Text: 'Read the terms, then choose:',
      Items: [
        { Key: 'k1', Value: 'I accept the [terms of service](https://example.com/terms)' },
        { Key: 'k2', Value: 'Send me the [summary](https://example.com/summary) instead' },
        { Key: 'k3', Value: 'Not now' },
      ],
    },
    answer: 'Not now',
  },
  {
    id: 'single-image',
    title: 'Single-select — image label',
    payload: {
      ...RADIO_DEFAULTS,
      Text: 'Pick the palette you prefer:',
      Items: [
        { Key: 'k1', Value: `![Vonno palette](${SAMPLE_IMAGE_DATA_URI})` },
        {
          Key: 'k2',
          Value: `Same palette, with a caption\n\n![Vonno palette](${SAMPLE_IMAGE_DATA_URI})`,
        },
        { Key: 'k3', Value: 'Neither' },
      ],
    },
    answer: `![Vonno palette](${SAMPLE_IMAGE_DATA_URI})`,
    answeredHint: 'the image row itself is the selected answer',
  },
  {
    id: 'single-plaintext',
    title: 'Single-select — custom "other" row (IsPlainTextEnabled)',
    payload: {
      ...RADIO_DEFAULTS,
      IsPlainTextEnabled: true,
      Text: 'How did you hear about us?',
      Items: [
        { Key: 'k1', Value: 'A colleague' },
        { Key: 'k2', Value: 'Search engine' },
      ],
    },
    answer: 'A billboard at the airport',
  },
  {
    id: 'multi',
    title: 'Multi-select — wrapping and comma labels',
    payload: {
      ...RADIO_DEFAULTS,
      MultiSelectEnabled: true,
      Text: 'Select every region you operate in:',
      Items: [
        { Key: 'k1', Value: 'Budapest, Hungary' },
        {
          Key: 'k2',
          Value:
            'A deliberately long label that has to wrap onto several lines while the checkbox stays put on the first line — **including bold text** and a `code span` to prove inline markup survives the wrap',
        },
        { Key: 'k3', Value: 'Vienna' },
        { Key: 'k4', Value: 'Bratislava' },
      ],
    },
    answer: 'Budapest, Hungary, Vienna',
    answeredHint: "answers join on ', ', so the comma label cannot re-tick",
  },
  {
    id: 'combobox',
    title: 'Combobox — labels flattened by toPlainText',
    payload: {
      ...RADIO_DEFAULTS,
      UIControlType: OptionsUIControlType.Combobox,
      Text: 'Choose a report format:',
      Items: [
        { Key: 'k1', Value: '**PDF** — print ready' },
        { Key: 'k2', Value: 'Excel (`.xlsx`) with one sheet per region' },
        { Key: 'k3', Value: `![Vonno palette](${SAMPLE_IMAGE_DATA_URI}) Palette swatch` },
      ],
    },
    answer: 'Excel (`.xlsx`) with one sheet per region',
  },
]

export const optionsScenarios: Scenario<OptionsMessageProps>[] = fixtures.flatMap((fixture) => [
  {
    id: fixture.id,
    title: fixture.title,
    props: { payload: fixture.payload, isActive: true },
  },
  {
    id: `${fixture.id}-answered`,
    title: fixture.answeredHint
      ? `${fixture.title} — answered (${fixture.answeredHint})`
      : `${fixture.title} — answered`,
    props: { payload: fixture.payload, isActive: false, selectedAnswer: fixture.answer },
  },
])
