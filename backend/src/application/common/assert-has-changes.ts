import { InvalidInputError } from '../../domain/errors'

/** Un PATCH debe modificar al menos un campo. */
export function assertHasChanges(changes: object): void {
  if (!Object.values(changes).some((value) => value !== undefined)) {
    throw new InvalidInputError('EMPTY_UPDATE', 'Envía al menos un campo a modificar')
  }
}
