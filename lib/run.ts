// Define shared interfaces and utilities here
export interface RunReturn {
  otherFields: { [key: string]: any };
  output: any;
}

// Define an interface for the configuration object
export interface Config {
  inputVariableNames?: string[];
  metadata: {
    outputTimestamp: number;
  };
  outputColumnName: string;
}
