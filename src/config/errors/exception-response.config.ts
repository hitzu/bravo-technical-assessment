enum ErrorMessages {
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  INSUFFICIENT_ROLE = 'INSUFFICIENT_ROLE',
  TENANT_ID_MISMATCH = 'TENANT_ID_MISMATCH',
  INVALID_COUNTRY = 'INVALID_COUNTRY',
  CREDIT_APPLICATION_NOT_FOUND = 'CREDIT_APPLICATION_NOT_FOUND',
  WEBHOOK_DELIVERY_NOT_FOUND = 'WEBHOOK_DELIVERY_NOT_FOUND',
  APPLICATION_RISK_RESULT_NOT_FOUND = 'APPLICATION_RISK_RESULT_NOT_FOUND',
  // Add more error messages as needed
}

export const EXCEPTION_RESPONSE: Record<
  ErrorMessages,
  { code: number; message: string }
> = {
  [ErrorMessages.USER_NOT_FOUND]: {
    code: 1,
    message: 'user not found',
  },
  [ErrorMessages.INSUFFICIENT_ROLE]: {
    code: 2,
    message: 'insufficient role',
  },
  [ErrorMessages.TENANT_ID_MISMATCH]: {
    code: 3,
    message: 'tenant ID mismatch',
  },
  [ErrorMessages.INVALID_COUNTRY]: {
    code: 4,
    message: 'invalid country',
  },
  [ErrorMessages.CREDIT_APPLICATION_NOT_FOUND]: {
    code: 5,
    message: 'credit application not found',
  },
  [ErrorMessages.WEBHOOK_DELIVERY_NOT_FOUND]: {
    code: 6,
    message: 'webhook delivery not found',
  },
  [ErrorMessages.APPLICATION_RISK_RESULT_NOT_FOUND]: {
    code: 7,
    message: 'application risk result not found',
  },
};
