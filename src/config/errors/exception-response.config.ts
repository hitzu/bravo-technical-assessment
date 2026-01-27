enum ErrorMessages {
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  INSUFFICIENT_ROLE = 'INSUFFICIENT_ROLE',
  TENANT_ID_MISMATCH = 'TENANT_ID_MISMATCH',
  INVALID_COUNTRY = 'INVALID_COUNTRY',
  CREDIT_APPLICATION_NOT_FOUND = 'CREDIT_APPLICATION_NOT_FOUND',
  WEBHOOK_DELIVERY_NOT_FOUND = 'WEBHOOK_DELIVERY_NOT_FOUND',
  APPLICATION_RISK_RESULT_NOT_FOUND = 'APPLICATION_RISK_RESULT_NOT_FOUND',
  INVALID_DOCUMENT_FORMAT = 'INVALID_DOCUMENT_FORMAT',
  // Add more error messages as needed
}

export const EXCEPTION_RESPONSE: Record<
  ErrorMessages,
  { code: number; message: string }
> = {
  [ErrorMessages.USER_NOT_FOUND]: {
    code: 1,
    message: 'usuario no encontrado',
  },
  [ErrorMessages.INSUFFICIENT_ROLE]: {
    code: 2,
    message: 'rol insuficiente',
  },
  [ErrorMessages.TENANT_ID_MISMATCH]: {
    code: 3,
    message: 'el ID del tenant no coincide',
  },
  [ErrorMessages.INVALID_COUNTRY]: {
    code: 4,
    message: 'país inválido',
  },
  [ErrorMessages.CREDIT_APPLICATION_NOT_FOUND]: {
    code: 5,
    message: 'solicitud de crédito no encontrada',
  },
  [ErrorMessages.WEBHOOK_DELIVERY_NOT_FOUND]: {
    code: 6,
    message: 'entrega de webhook no encontrada',
  },
  [ErrorMessages.APPLICATION_RISK_RESULT_NOT_FOUND]: {
    code: 7,
    message: 'resultado de riesgo de la solicitud no encontrado',
  },
  [ErrorMessages.INVALID_DOCUMENT_FORMAT]: {
    code: 8,
    message: 'formato de documento inválido',
  },
};
