/** Recorta el texto; vacío (o solo espacios) se guarda como `null`. */
export const emptyToNull = (value: string | null | undefined) => (value?.trim() ? value.trim() : null)
