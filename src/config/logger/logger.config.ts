/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Params } from 'nestjs-pino';
import { randomUUID } from 'crypto';

export const getLoggerConfigs = (): Params => {
  const isProduction = process.env.NODE_ENV === 'prod';
  const isDevelopment = process.env.NODE_ENV === 'local';
  const prettyLogsEnabled = isDevelopment && process.env.LOG_PRETTY !== 'false';

  const transport =
    prettyLogsEnabled
      ? (() => {
        try {
          // In the Docker demo image we install only production deps.
          // pino-pretty is a devDependency, so it may be missing: fall back to JSON logs.
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          require.resolve('pino-pretty');
          return {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname',
              singleLine: false,
            },
          };
        } catch {
          return undefined;
        }
      })()
      : undefined;

  return {
    pinoHttp: {
      level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
      genReqId: (req) => req.headers['x-request-id'] || randomUUID(),

      transport,

      serializers: {
        req: (req: any) => ({
          id: req.id,
          method: req.method,
          url: req.url,
          query: req.query,
          params: req.params,
        }),
        res: (res: any) => ({
          statusCode: res.statusCode as number,
        }),
      },

      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'password',
          'token',
          'secret',
          'creditCard',
          `documentId`,
          `bankInfo`,
          `fullName`
        ],
        censor: '[REDACTED]',
      },

      base: {
        env: process.env.NODE_ENV,
        service: 'bookandsign-api',
      },
    },
  };
};
