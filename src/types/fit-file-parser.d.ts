declare module 'fit-file-parser' {
  interface FitParserOptions {
    force?: boolean;
    speedUnit?: 'm/s' | 'km/h' | 'mph';
    lengthUnit?: 'm' | 'km' | 'mi';
    temperatureUnit?: 'celsius' | 'kelvin' | 'fahrenheit';
    elapsedRecordField?: boolean;
    mode?: 'cascade' | 'list' | 'both';
  }

  export default class FitParser {
    constructor(options?: FitParserOptions);
    parse(
      content: ArrayBuffer | Buffer,
      callback: (error: string | null, data: any) => void
    ): void;
  }
}
