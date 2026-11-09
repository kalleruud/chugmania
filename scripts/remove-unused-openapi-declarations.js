import { readFileSync, writeFileSync } from 'node:fs'
import ts from 'typescript'

const file = 'backend/src/models/webhook.generated.ts'
const source = ts.createSourceFile(
  file,
  readFileSync(file, 'utf8'),
  ts.ScriptTarget.Latest
)
const declarations = source.statements.filter(
  statement =>
    (ts.isInterfaceDeclaration(statement) ||
      ts.isTypeAliasDeclaration(statement)) &&
    !['paths', 'webhooks', '$defs', 'operations'].includes(statement.name.text)
)
const header = source.text.slice(0, source.statements[0].getStart(source))
writeFileSync(
  file,
  header + declarations.map(statement => statement.getFullText(source)).join('')
)
