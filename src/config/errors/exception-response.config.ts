enum ErrorMessages {
  USER_NOT_FOUND = 'USER_NOT_FOUND',
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
};
