export function FieldError({
  errors,
  id,
}: {
  readonly errors: readonly string[] | undefined;
  readonly id: string;
}) {
  if (errors === undefined || errors.length === 0) return null;
  return (
    <p className="field-error" id={id} role="alert">
      {errors[0]}
    </p>
  );
}
