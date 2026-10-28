import { DefaultNamingStrategy } from 'typeorm'

const toSnakeCase = (value: string) => value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()

/** Propiedades camelCase en las entidades → columnas snake_case en PostgreSQL (como en el ERD). */
export class SnakeNamingStrategy extends DefaultNamingStrategy {
  override columnName(propertyName: string, customName: string | undefined, embeddedPrefixes: string[]): string {
    return customName ?? toSnakeCase([...embeddedPrefixes, propertyName].join('_'))
  }

  override relationName(propertyName: string): string {
    return toSnakeCase(propertyName)
  }

  override joinColumnName(relationName: string, referencedColumnName: string): string {
    return toSnakeCase(`${relationName}_${referencedColumnName}`)
  }
}
