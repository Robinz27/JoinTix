/** A trimmed text field from a submitted form ("" when it's missing), for server actions */
export const formText = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/** What an admin form's server action returns: a success message, an error to show, or neither */
export type AdminFormState = { ok?: string; error?: string };
