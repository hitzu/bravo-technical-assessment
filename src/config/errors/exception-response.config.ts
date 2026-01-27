enum ErrorMessages {
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  INSUFFICIENT_ROLE = 'INSUFFICIENT_ROLE',
  TENANT_ID_MISMATCH = 'TENANT_ID_MISMATCH',
  INVALID_COUNTRY = 'INVALID_COUNTRY',
  CREDIT_APPLICATION_NOT_FOUND = 'CREDIT_APPLICATION_NOT_FOUND',
  WEBHOOK_DELIVERY_NOT_FOUND = 'WEBHOOK_DELIVERY_NOT_FOUND',
  APPLICATION_RISK_RESULT_NOT_FOUND = 'APPLICATION_RISK_RESULT_NOT_FOUND',
  INVALID_DOCUMENT_FORMAT = 'INVALID_DOCUMENT_FORMAT',
  CREDIT_APPLICATION_STATUS_NOT_ALLOWED = 'CREDIT_APPLICATION_STATUS_NOT_ALLOWED',
  CREDIT_APPLICATION_STATUS_CAN_ONLY_BE_MANUALLY_CHANGED_FROM_IN_REVIEW = 'CREDIT_APPLICATION_STATUS_CAN_ONLY_BE_MANUALLY_CHANGED_FROM_IN_REVIEW',
  CREDIT_APPLICATION_STATUS_MUST_BE_APPROVED_OR_REJECTED_FOR_MANUAL_ADMIN_UPDATE = 'CREDIT_APPLICATION_STATUS_MUST_BE_APPROVED_OR_REJECTED_FOR_MANUAL_ADMIN_UPDATE',
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
  [ErrorMessages.CREDIT_APPLICATION_STATUS_NOT_ALLOWED]: {
    code: 9,
    message: 'estado de solicitud de crédito no permitido',
  },
  [ErrorMessages.CREDIT_APPLICATION_STATUS_CAN_ONLY_BE_MANUALLY_CHANGED_FROM_IN_REVIEW]: {
    code: 10,
    message: 'el estado de la solicitud de crédito solo puede ser cambiado manualmente desde IN_REVIEW',
  },
  [ErrorMessages.CREDIT_APPLICATION_STATUS_MUST_BE_APPROVED_OR_REJECTED_FOR_MANUAL_ADMIN_UPDATE]: {
    code: 11,
    message: 'el estado de la solicitud de crédito debe ser APPROVED o REJECTED para ser cambiado manualmente por un administrador',
  },
};
