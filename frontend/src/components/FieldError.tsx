import React from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * #49 — Mensagem de erro inline associada a um campo de formulário.
 * Renderiza um `<span role="alert">` com `id` fixo para poder ser referenciado
 * por `aria-describedby` no input. Nada é renderizado quando não há mensagem.
 */
export interface FieldErrorProps {
    id: string;
    message?: string;
}

const FieldError: React.FC<FieldErrorProps> = ({ id, message }) =>
    message ? (
        <span className="form-error" id={id} role="alert">
            <AlertCircle size={11} /> {message}
        </span>
    ) : null;

export default FieldError;

/**
 * Props ARIA a espalhar no input controlado por um `FieldError`. Liga o input à
 * mensagem (`aria-describedby`) e marca-o como inválido (`aria-invalid`) apenas
 * quando existe erro.
 */
export function fieldAria(id: string, message?: string): {
    'aria-invalid': boolean;
    'aria-describedby'?: string;
} {
    return {
        'aria-invalid': !!message,
        'aria-describedby': message ? id : undefined,
    };
}
