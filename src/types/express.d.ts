type typedResponse = Express.Response & {
    status: (statusCode: number) => typedResponse;
    sendStatus: (statusCode: number) => typedResponse;
    send: (responseBody: any) => typedResponse;
  };
  export type ExpressMiddleware<request = any, response = any> = (
    request: Express.Request & request,
    response: typedResponse & response
  ) => any;