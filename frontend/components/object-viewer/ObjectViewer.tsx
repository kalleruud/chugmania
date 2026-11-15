import ObjectValue from './ObjectValue'

export default function ObjectViewer({ value }: Readonly<{ value: unknown }>) {
  return <ObjectValue value={value} ancestors={[]} expanded />
}
