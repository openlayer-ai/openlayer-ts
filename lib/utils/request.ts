export type RequestParameters = { [key: string]: any };

export const resolvedQuery = (
  baseUrl: string,
  endpoint: string,
  args: RequestParameters = {}
): string => `${baseUrl}${endpoint}${queryParameters(args)}`;

export const queryParameters = (args: RequestParameters): string => {
  const filteredArgs: RequestParameters = Object.keys(args)
    .filter((key) => typeof args[key] !== 'undefined')
    .reduce((acc: RequestParameters, arg) => {
      if (Array.isArray(args[arg])) {
        if (args[arg].length === 0) {
          return acc;
        }

        acc[arg] = args[arg].join(`&${arg}=`);
      } else {
        if (
          (typeof args[arg] === 'string' && args[arg].length === 0) ||
          (typeof args[arg] === 'object' &&
            Object.values(args[arg]).length === 0)
        ) {
          return acc;
        }

        acc[arg] = args[arg];
      }

      return acc;
    }, {});

  if (Object.keys(filteredArgs).length === 0) {
    return '';
  }

  const resolvedArgs = Object.keys(filteredArgs)
    .map((key) => `${key}=${filteredArgs[key]}`)
    .join('&');
  return `?${resolvedArgs}`;
};
