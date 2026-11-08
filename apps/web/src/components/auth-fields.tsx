"use client";
import { useRef, useState } from "react";
function PasswordEye({ visible }: { visible: boolean }) {
    const paths = visible
        ? [
              "M10.6 5.1A10.9 10.9 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a10 10 0 0 0 5.4-1.6",
              "M9.9 9.9a3 3 0 0 0 4.2 4.2",
              "m3 3 18 18",
          ]
        : [
              "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z",
              "M12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z",
          ];
    return (
        <svg className="ui-icon" viewBox="0 0 24 24" aria-hidden="true">
            {paths.map((d) => (
                <path
                    key={d}
                    d={d}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            ))}
        </svg>
    );
}

export function PasswordField({
    id,
    label,
    value,
    onChange,
    text,
    confirmation = false,
    error,
    hint,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    text: (message: string) => string;
    confirmation?: boolean;
    error?: string;
    hint?: string;
}) {
    const [visible, setVisible] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    return (
        <div className="field">
            <label htmlFor={id}>{label}</label>
            <span className="password-field">
                <input
                    ref={input}
                    id={id}
                    name={confirmation ? "password_confirmation" : "password"}
                    type={visible ? "text" : "password"}
                    autoComplete={
                        confirmation || hint
                            ? "new-password"
                            : "current-password"
                    }
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    maxLength={128}
                    required
                    aria-invalid={!!error}
                    aria-describedby={
                        error ? `${id}-error` : hint ? `${id}-hint` : undefined
                    }
                />
                <button
                    type="button"
                    className="password-visibility"
                    aria-controls={id}
                    aria-pressed={visible}
                    aria-label={text(
                        visible ? "Hide password" : "Show password",
                    )}
                    title={text(visible ? "Hide password" : "Show password")}
                    onClick={() => {
                        setVisible(!visible);
                        requestAnimationFrame(() => input.current?.focus());
                    }}
                >
                    <PasswordEye visible={visible} />
                </button>
            </span>
            {hint && (
                <p id={`${id}-hint`} className="field-hint">
                    {hint}
                </p>
            )}
            {error && (
                <p id={`${id}-error`} className="field-error" role="alert">
                    {text(error)}
                </p>
            )}
        </div>
    );
}
export function EmailField({
    id,
    value,
    onChange,
    text,
    error,
    autoFocus = false,
}: {
    id: string;
    value: string;
    onChange: (value: string) => void;
    text: (message: string) => string;
    error?: string;
    autoFocus?: boolean;
}) {
    return (
        <div className="field">
            <label htmlFor={id}>{text("Email")}</label>
            <input
                id={id}
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                required
                autoFocus={autoFocus}
                aria-invalid={!!error}
                aria-describedby={error ? `${id}-error` : undefined}
            />
            {error && (
                <p id={`${id}-error`} className="field-error" role="alert">
                    {text(error)}
                </p>
            )}
        </div>
    );
}
export function CodeField({
    id,
    label,
    value,
    onChange,
    text,
    error,
    autoFocus = true,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    text: (message: string) => string;
    error?: string;
    autoFocus?: boolean;
}) {
    return (
        <div className="field">
            <label htmlFor={id}>{label}</label>
            <input
                id={id}
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={7}
                value={value}
                onChange={(event) =>
                    onChange(event.target.value.replace(/\s/g, ""))
                }
                required
                autoFocus={autoFocus}
                aria-invalid={!!error}
                aria-describedby={error ? `${id}-error` : undefined}
            />
            {error && (
                <p id={`${id}-error`} className="field-error" role="alert">
                    {text(error)}
                </p>
            )}
        </div>
    );
}
export function focusInvalid(
    form: HTMLFormElement,
    errors: Record<string, string>,
) {
    requestAnimationFrame(() =>
        (
            form.elements.namedItem(
                Object.keys(errors)[0],
            ) as HTMLInputElement | null
        )?.focus(),
    );
}
